import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  firebaseAdminCredentialsConfigured,
  firebaseApplicationCredentialsConfigured,
  firebaseServiceAccountJsonConfigured,
  firebaseServiceAccountJsonEnvKey,
} from './lib/firebase-admin-credentials.mjs';
import { firebaseProjectAlignment } from './lib/firebase-project-alignment.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const format =
  process.argv.find((arg) => arg.startsWith('--format='))?.slice('--format='.length) ?? 'markdown';
const outFile = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const { env } = loadMergedEnv(envFile);
const firebaseAdminReady = firebaseAdminCredentialsConfigured(env);
const firebaseAlignment = firebaseProjectAlignment(env, { repoRoot });
const firebasePushReady = firebaseAdminReady && firebaseAlignment.ok;
const storageUsesSplitBuckets = hasValue(env.S3_PRIVATE_BUCKET) && hasValue(env.S3_PUBLIC_BUCKET);
const storageUsesFallbackBucket = hasValue(env.S3_BUCKET);
const supportedSmsProviders = new Set(['vonage', 'viettel', 'fpt', 'custom']);
const realSmsProviderConfigured = hasRealSmsProvider(env.SMS_PROVIDER);
const storageReady =
  hasValue(env.STORAGE_PROVIDER) &&
  hasValue(env.S3_ENDPOINT) &&
  hasValue(env.S3_REGION) &&
  hasValue(env.S3_ACCESS_KEY) &&
  hasValue(env.S3_SECRET_KEY) &&
  hasValue(env.S3_PUBLIC_BASE_URL) &&
  (storageUsesFallbackBucket || storageUsesSplitBuckets);

const registrationItems = [
  {
    order: 1,
    category: 'Identity',
    account: 'HANDS domain and operator email',
    purpose: 'Single ownership identity for all external services and production callbacks.',
    consolePath: 'Domain registrar / DNS provider / email host',
    env: [
      envItem('APP_DOMAIN', 'hands.vn', env.APP_DOMAIN === 'hands.vn'),
      envItem('PUBLIC_WEB_URL', 'https://hands.vn', env.PUBLIC_WEB_URL === 'https://hands.vn'),
      envItem('API_PUBLIC_URL', 'https://api.hands.vn', env.API_PUBLIC_URL === 'https://api.hands.vn'),
      envItem(
        'ADMIN_PUBLIC_URL',
        'https://admin.hands.vn',
        env.ADMIN_PUBLIC_URL === 'https://admin.hands.vn',
      ),
      envItem('ADMIN_EMAIL', 'administration@hands.vn', env.ADMIN_EMAIL === 'administration@hands.vn'),
      envItem('SUPPORT_EMAIL', 'administration@hands.vn', env.SUPPORT_EMAIL === 'administration@hands.vn'),
    ],
    setup: [
      'Use administration@hands.vn as the owner/admin login for GitHub, Supabase, MapTiler, Geoapify, Firebase Cloud Messaging, payment gateways, and storage providers.',
      'Keep DNS in PA Vietnam under the account controlled by administration@hands.vn.',
      'Use api.hands.vn for API callbacks and admin.hands.vn for the admin dashboard after hosting is ready.',
    ],
    verify: ['npm.cmd run external:pack:write', 'npm.cmd run env:check'],
  },
  {
    order: 2,
    category: 'Supabase core',
    account: 'Supabase project',
    purpose: 'PostgreSQL/RLS, Storage, Realtime, and future Auth token verification foundation.',
    consolePath: 'Supabase Dashboard > Project Settings > API and SQL Editor',
    env: [
      envItem(
        'SUPABASE_URL',
        'https://<project-ref>.supabase.co',
        isSupabaseProjectUrl(env.SUPABASE_URL),
      ),
      envItem('SUPABASE_ANON_KEY', '<anon-public-key>', hasValue(env.SUPABASE_ANON_KEY)),
      envItem('SUPABASE_JWT_SECRET', '<project-jwt-secret>', isSecretLikeValue(env.SUPABASE_JWT_SECRET)),
      envItem(
        'SUPABASE_SERVICE_ROLE_KEY',
        '<service-role-key-server-only>',
        isSecretLikeValue(env.SUPABASE_SERVICE_ROLE_KEY),
      ),
    ],
    setup: [
      'Use organization/workspace name HANDS and project name hands-staging.',
      'Run npm.cmd run supabase:sql:pack, then paste infra/supabase/.generated/hands-staging-setup.sql into the SQL editor.',
      'Keep the service role key only in the API environment.',
      'Keep Phone Auth/SMS out of this core step; it is tracked separately with the chosen SMS provider.',
    ],
    verify: [
      'npm.cmd run supabase:sql:pack',
      'npm.cmd run external:check:supabase',
      'npm.cmd run supabase:location-exposure-smoke',
    ],
  },
  {
    order: 3,
    category: 'Supabase Phone Auth',
    account: 'Supabase Phone Auth + SMS provider',
    purpose: 'Real OTP delivery and Supabase access-token exchange for mobile login.',
    consolePath:
      'Supabase Dashboard > Authentication > Providers > Phone and selected SMS provider dashboard',
    env: [
      envItem(
        'AUTH_BACKEND',
        'nest until Phone Auth E2E, then supabase',
        ['nest', 'supabase'].includes(String(env.AUTH_BACKEND ?? '').toLowerCase()),
      ),
      envItem('SMS_PROVIDER', 'vonage | viettel | fpt | custom', realSmsProviderConfigured),
      envItem('SMS_API_URL', 'https://<sms-provider-api>', isHttpsUrl(env.SMS_API_URL)),
      envItem('SMS_API_KEY', '<sms-api-key>', hasValue(env.SMS_API_KEY)),
      envItem('SMS_API_SECRET', '<sms-api-secret>', isSecretLikeValue(env.SMS_API_SECRET)),
      envItem('SMS_SENDER_ID', 'HANDS', hasValue(env.SMS_SENDER_ID)),
    ],
    setup: [
      'Use Nest/dev OTP as the local fallback until live OTP delivery and API token exchange pass.',
      'Vonage is the selected SMS path for the next Phone Auth E2E pass; evaluate Viettel/FPT or a custom Vietnam SMS backend only if delivery or cost requires it.',
      'After real OTP works, keep AUTH_BACKEND=supabase for the dedicated auth migration pass; roll back to nest if the E2E check fails.',
    ],
    verify: [
      'npm.cmd run external:check:supabase-auth',
      'npm.cmd run auth:supabase-phone-smoke -- --dry-run',
      'npm.cmd run auth:supabase-phone-smoke -- --send',
      'npm.cmd run auth:supabase-phone-smoke -- --verify',
      'npm.cmd run auth:supabase-smoke',
    ],
  },
  {
    order: 4,
    category: 'Maps',
    account: 'MapTiler',
    purpose: 'Low-cost map tile/style rendering for customer and partner mobile screens.',
    consolePath: 'MapTiler Cloud > Account > Keys',
    env: [envItem('MAPTILER_API_KEY', '<maptiler-key>', hasValue(env.MAPTILER_API_KEY))],
    setup: [
      'Create a browser/mobile key for HANDS staging.',
      'Use map tiles only; do not enable paid routing/directions for MVP.',
    ],
    verify: [
      'npm.cmd run external:check:maps',
      'powershell -ExecutionPolicy Bypass -File .\\infra\\scripts\\run-hands-emulator.ps1 -App customer',
    ],
  },
  {
    order: 5,
    category: 'Geocoding',
    account: 'Geoapify',
    purpose: 'Vietnam address search and coordinate lookup.',
    consolePath: 'Geoapify Dashboard > API Keys',
    env: [envItem('GEOAPIFY_API_KEY', '<geoapify-key>', hasValue(env.GEOAPIFY_API_KEY))],
    setup: [
      'Create a key for staging mobile address search.',
      'Keep debounce and result caching enabled in the mobile app to control cost.',
    ],
    verify: ['npm.cmd run external:check:maps'],
  },
  {
    order: 6,
    category: 'Operations policy',
    account: 'HANDS Admin policy controls',
    purpose:
      'Runtime-tunable matching, marketplace participation, cancellation, no-show, notification, and wallet-gate policy.',
    consolePath: 'HANDS Admin > Operations Policy',
    env: [
      envItem(
        'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
        '10',
        hasValue(env.MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES),
      ),
      envItem(
        'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
        '10000',
        hasValue(env.MATCHING_BACKUP_PROVIDER_RADIUS_METERS),
      ),
      envItem(
        'MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
        '30',
        hasValue(env.MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES),
      ),
      envItem(
        'MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT',
        '50',
        hasValue(env.MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT),
      ),
      envItem(
        'MATCHING_PREFERRED_ACCEPT_MODE',
        'FIRST_PICK_MATCHES_ON_ACCEPT',
        hasValue(env.MATCHING_PREFERRED_ACCEPT_MODE),
      ),
      envItem(
        'MATCHING_BACKUP_OPEN_MODE',
        'IMMEDIATE_WITHIN_WINDOW',
        hasValue(env.MATCHING_BACKUP_OPEN_MODE),
      ),
      envItem(
        'WALLET_NEGATIVE_BALANCE_GATE',
        'BLOCK_MARKETPLACE_PARTICIPATION',
        hasValue(env.WALLET_NEGATIVE_BALANCE_GATE),
      ),
      envItem(
        'CANCELLATION_AFTER_MATCH_POLICY',
        'ADMIN_REVIEW_FOR_MVP',
        hasValue(env.CANCELLATION_AFTER_MATCH_POLICY),
      ),
      envItem(
        'NO_SHOW_PARTNER_REPORT_POLICY',
        'ADMIN_REVIEW_REQUIRED',
        hasValue(env.NO_SHOW_PARTNER_REPORT_POLICY),
      ),
      envItem(
        'NOTIFICATION_PARTNER_ALERT_CHANNEL',
        'IN_APP_WITH_PUSH_LATER',
        hasValue(env.NOTIFICATION_PARTNER_ALERT_CHANNEL),
      ),
    ],
    setup: [
      'Use the env defaults only as initial seed values; day-to-day changes should be made from /operations-policy so they are audited.',
      'Recommended MVP: 10 minute first-pick response, marketplace participation visibility, customer final confirmation, and configured wallet settlement gates.',
      'Do not hardcode Vietnam tax, commission, cancellation, or no-show rules in mobile screens; read the backend/admin policy snapshot instead.',
    ],
    verify: [
      'Open http://localhost:3101/operations-policy',
      'node infra\\scripts\\api-smoke.mjs',
      'npm.cmd run admin:web-smoke',
    ],
  },
  {
    order: 7,
    category: 'Storage',
    account: 'Supabase Storage S3, R2, or S3-compatible bucket',
    purpose: 'Provider verification files, public profile media, and moderation evidence.',
    consolePath: 'Supabase Storage / Cloudflare R2 / S3-compatible console',
    ready: storageReady,
    statusNote: storageReady
      ? storageUsesSplitBuckets
        ? 'Ready via separate private and public buckets.'
        : 'Ready via S3_BUCKET fallback; split buckets remain a production-hardening step.'
      : 'Pending until storage provider settings and either S3_BUCKET or split buckets are filled.',
    env: [
      envItem('STORAGE_PROVIDER', 'supabase-storage-s3', hasValue(env.STORAGE_PROVIDER)),
      envItem(
        'S3_ENDPOINT',
        'https://<project-ref>.storage.supabase.co/storage/v1/s3',
        hasValue(env.S3_ENDPOINT),
      ),
      envItem('S3_REGION', 'auto', hasValue(env.S3_REGION)),
      envItem('S3_BUCKET', '<single-bucket-fallback-for-local-or-r2>', hasValue(env.S3_BUCKET)),
      envItem('S3_PRIVATE_BUCKET', 'hands-private', hasValue(env.S3_PRIVATE_BUCKET)),
      envItem('S3_PUBLIC_BUCKET', 'hands-public', hasValue(env.S3_PUBLIC_BUCKET)),
      envItem('S3_ACCESS_KEY', '<storage-access-key>', hasValue(env.S3_ACCESS_KEY)),
      envItem('S3_SECRET_KEY', '<storage-secret-key>', hasValue(env.S3_SECRET_KEY)),
      envItem('S3_PUBLIC_BASE_URL', '<public-cdn-or-bucket-url>', hasValue(env.S3_PUBLIC_BASE_URL)),
    ],
    setup: [
      'Keep verification files private.',
      'Serve approved provider public media through CDN/public bucket URL.',
      'For Supabase Storage, prefer S3_PRIVATE_BUCKET=hands-private and S3_PUBLIC_BUCKET=hands-public instead of placing private verification files in a public bucket.',
    ],
    verify: [
      'npm.cmd run external:check:storage',
      'npm.cmd run storage:smoke',
      'powershell -ExecutionPolicy Bypass -File .\\infra\\scripts\\verify-local.ps1 -WithServices',
    ],
  },
  {
    order: 8,
    category: 'Push',
    account: 'Firebase Cloud Messaging',
    purpose: 'Android/iOS FCM push. Firebase DB/Auth/Firestore are not part of HANDS MVP.',
    consolePath: 'Firebase Console > Project settings > Service accounts and Cloud Messaging',
    ready: firebasePushReady,
    statusNote: firebasePushReady
      ? 'Ready via Firebase Admin credentials and Firebase project alignment.'
      : 'Pending until one Firebase Admin credential mode and mobile project alignment pass.',
    env: [
      envItem('PUSH_PROVIDER', 'fcm', env.PUSH_PROVIDER === 'fcm'),
      envItem('FIREBASE_PROJECT_ID', '<firebase-project-id>', hasValue(env.FIREBASE_PROJECT_ID)),
      envItem('FIREBASE_CLIENT_EMAIL', '<firebase-client-email>', hasValue(env.FIREBASE_CLIENT_EMAIL)),
      envItem(
        'FIREBASE_PRIVATE_KEY',
        '<firebase-private-key-server-only>',
        hasValue(env.FIREBASE_PRIVATE_KEY),
      ),
      envItem(
        'FIREBASE_SERVICE_ACCOUNT_JSON',
        '<service-account-json-or-base64-server-only>',
        firebaseServiceAccountJsonConfigured(env[firebaseServiceAccountJsonEnvKey]),
      ),
      envItem(
        'GOOGLE_APPLICATION_CREDENTIALS',
        '<existing-service-account-json-path>',
        firebaseApplicationCredentialsConfigured(env.GOOGLE_APPLICATION_CREDENTIALS),
      ),
      envItem(
        'FIREBASE_ADMIN_CREDENTIALS_HOST_PATH',
        'C:\\dev\\hands-secrets\\firebase\\hands-vn-mvp-firebase-admin.json',
        firebaseApplicationCredentialsConfigured(env.FIREBASE_ADMIN_CREDENTIALS_HOST_PATH),
      ),
      envItem(
        'FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH',
        '/run/secrets/firebase-admin.json',
        hasValue(env.FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH),
      ),
    ],
    setup: [
      'Use FCM only for push notifications. Do not use Firebase Realtime Database, Firestore, or Firebase Auth.',
      'Use PUSH_PROVIDER=in_app_only for inbox-only local work; use PUSH_PROVIDER=fcm for intentional FCM push E2E or staging rollout.',
      'Treat google-services.json as mobile client config only; it does not replace server-side Firebase Admin credentials.',
      'Download Firebase Admin SDK JSON from the same Firebase project as the customer and Partner google-services.json files.',
      'If using FIREBASE_SERVICE_ACCOUNT_JSON, provide raw or base64 service account JSON with project_id, client_email, and private_key.',
      'If using GOOGLE_APPLICATION_CREDENTIALS, point it to an existing valid service account JSON file available to the API process or Docker container.',
      'For Docker, set FIREBASE_ADMIN_CREDENTIALS_HOST_PATH to the host JSON path and keep FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH as /run/secrets/firebase-admin.json unless the compose mount changes.',
      'Keep Firebase Admin service account values server-side only and never send them to Flutter or browser JavaScript.',
    ],
    verify: [
      'npm.cmd run external:check:push',
      'npm.cmd run fcm:env-contract',
      ...(firebasePushReady
        ? []
        : [
            'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -CheckOnly',
            'npm.cmd run fcm:credentials:install -- -SourcePath C:\\Users\\<you>\\Downloads\\<firebase-admin-key>.json -UpdateEnv',
          ]),
      'npm.cmd run security:secrets',
      'npm.cmd run fcm:credentials-check',
      'npm.cmd run docker:contract',
      'npm.cmd run fcm:token-smoke -- --dry-run',
      'npm.cmd run fcm:token-recovery-smoke -- --dry-run',
      'npm.cmd run fcm:token-recovery-smoke',
      'npm.cmd run fcm:push-smoke -- --dry-run',
      'npm.cmd run fcm:push-smoke -- --preflight',
      'npm.cmd run fcm:push-smoke -- --preflight --use-registered-device',
      'Set FCM_SMOKE_DEVICE_TOKEN for the same app session, or set FCM_SMOKE_USE_REGISTERED_DEVICE=true after that app session registers an enabled device, then run npm.cmd run fcm:push-smoke.',
    ],
  },
  {
    order: 9,
    category: 'SMS',
    account: 'Vietnam-capable SMS provider',
    purpose: 'Real OTP delivery for Supabase Phone Auth or backend OTP after deferred SMS setup.',
    consolePath: 'Vonage, Viettel, FPT, or selected SMS provider dashboard',
    env: [
      envItem('SMS_PROVIDER', 'vonage | viettel | fpt | custom', realSmsProviderConfigured),
      envItem('SMS_API_URL', 'https://<sms-provider-api>', isHttpsUrl(env.SMS_API_URL)),
      envItem('SMS_API_KEY', '<sms-api-key>', hasValue(env.SMS_API_KEY)),
      envItem('SMS_API_SECRET', '<sms-api-secret>', isSecretLikeValue(env.SMS_API_SECRET)),
      envItem('SMS_SENDER_ID', 'HANDS', hasValue(env.SMS_SENDER_ID)),
    ],
    setup: [
      'Create SMS service credentials under administration@hands.vn when SMS E2E starts.',
      'For Vonage, create or open the SMS/Verify product in the dashboard and copy the selected endpoint/credential pair into ignored env only.',
      'Set SMS_PROVIDER, SMS_API_URL, SMS_API_KEY, SMS_API_SECRET, and SMS_SENDER_ID before switching AUTH_BACKEND=supabase for Phone Auth E2E.',
      'Confirm Vietnam delivery rates and sender ID rules.',
      'Define OTP resend and abuse limits.',
    ],
    verify: ['npm.cmd run external:check:production'],
  },
  {
    order: 10,
    category: 'Mobile release',
    account: 'Android Play Console signing',
    purpose: 'Separate customer/partner upload keys and fingerprints for production Android distribution.',
    consolePath: 'Google Play Console > Setup > App integrity',
    env: [
      envItem('ANDROID_CUSTOMER_APPLICATION_ID', 'com.massagevn.customer.customer_app', true),
      envItem('ANDROID_PROVIDER_APPLICATION_ID', 'com.massagevn.provider.provider_app', true),
      envItem(
        'ANDROID_CUSTOMER_UPLOAD_KEYSTORE',
        '<local-secret-keystore-path>',
        hasValue(env.ANDROID_CUSTOMER_UPLOAD_KEYSTORE),
      ),
      envItem(
        'ANDROID_PROVIDER_UPLOAD_KEYSTORE',
        '<local-secret-keystore-path>',
        hasValue(env.ANDROID_PROVIDER_UPLOAD_KEYSTORE),
      ),
      envItem(
        'REFERRAL_PUBLIC_BASE_URL',
        'https://hands.vn',
        env.REFERRAL_PUBLIC_BASE_URL === 'https://hands.vn',
      ),
      envItem(
        'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
        'https://play.google.com/store/apps/details?id=com.massagevn.customer.customer_app',
        isPlayStoreUrl(
          env.REFERRAL_CUSTOMER_ANDROID_STORE_URL,
          'com.massagevn.customer.customer_app',
        ),
      ),
      envItem(
        'REFERRAL_PARTNER_ANDROID_STORE_URL',
        'https://play.google.com/store/apps/details?id=com.massagevn.provider.provider_app',
        isPlayStoreUrl(
          env.REFERRAL_PARTNER_ANDROID_STORE_URL,
          'com.massagevn.provider.provider_app',
        ),
      ),
    ],
    setup: [
      'Create separate upload keys for the HANDS customer and partner apps.',
      'Optional helper: run npm.cmd run android:signing:create to generate local upload keys and key.properties files.',
      'Store keystores outside Git, preferably under C:\\dev\\hands-secrets.',
      'Copy apps/customer_app/android/key.properties.example to apps/customer_app/android/key.properties and fill local secret values.',
      'Copy apps/provider_app/android/key.properties.example to apps/provider_app/android/key.properties and fill local secret values.',
      'Release builds automatically use android/key.properties when it exists and fall back to debug signing for local MVP builds.',
      'Record SHA-1 and SHA-256 fingerprints for any provider that requires Android app restrictions.',
      'Create both Play Console app listings before referral launch, then use the exact package-specific Google Play URLs.',
      'Keep iOS referral Store URLs deferred until iOS customer and Partner release preparation starts.',
    ],
    verify: [
      'cd apps/customer_app && flutter build appbundle --release',
      'cd apps/provider_app && flutter build appbundle --release',
      'npm.cmd run external:check:referrals',
      'npm.cmd run referrals:public-link-smoke -- --dry-run',
    ],
  },
  {
    order: 11,
    category: 'Payments',
    account: 'MoMo merchant sandbox',
    purpose: 'Vietnam wallet authorization, release, capture, and refund testing.',
    consolePath: 'MoMo Merchant Portal > Integration credentials',
    env: [
      envItem('MOMO_PARTNER_CODE', '<momo-partner-code>', hasValue(env.MOMO_PARTNER_CODE)),
      envItem('MOMO_ACCESS_KEY', '<momo-access-key>', hasValue(env.MOMO_ACCESS_KEY)),
      envItem('MOMO_SECRET_KEY', '<momo-secret-key>', hasValue(env.MOMO_SECRET_KEY)),
    ],
    setup: [
      'Start with sandbox credentials.',
      'Register local callback http://localhost:3000/api/payments/MOMO/callback for local E2E.',
      'Register production callback https://api.hands.vn/api/payments/MOMO/callback after API hosting is ready.',
      'Keep cash payment enabled as operational fallback.',
    ],
    verify: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
  },
  {
    order: 12,
    category: 'Payments',
    account: 'VNPay merchant sandbox',
    purpose: 'Vietnam card/bank payment authorization and refund testing.',
    consolePath: 'VNPay Merchant Portal > Integration credentials',
    env: [
      envItem('VNPAY_GATEWAY_ENABLED', 'false', hasValue(env.VNPAY_GATEWAY_ENABLED)),
      envItem('VNPAY_TMN_CODE', '<vnpay-tmn-code>', hasValue(env.VNPAY_TMN_CODE)),
      envItem('VNPAY_HASH_SECRET', '<vnpay-hash-secret>', hasValue(env.VNPAY_HASH_SECRET)),
      envItem(
        'VNPAY_PAYMENT_URL',
        'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
        hasValue(env.VNPAY_PAYMENT_URL),
      ),
      envItem(
        'VNPAY_API_URL',
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
        hasValue(env.VNPAY_API_URL),
      ),
      envItem('VNPAY_RETURN_URL', '<public-https-return-url>', hasValue(env.VNPAY_RETURN_URL)),
      envItem('VNPAY_SERVER_IP', '<api-public-ip>', hasValue(env.VNPAY_SERVER_IP)),
    ],
    setup: [
      'Start with sandbox credentials.',
      'Keep VNPAY_GATEWAY_ENABLED=false until signed sandbox checkout, IPN, query recovery, and asynchronous refund E2E pass.',
      'Register a VNPay-reachable HTTPS IPN URL using GET /api/payments/VNPAY/callback; localhost cannot receive provider IPN requests.',
      'Register production IPN https://api.hands.vn/api/payments/VNPAY/callback only after API hosting and TLS are ready.',
      'Set VNPAY_RETURN_URL to the public customer return page and VNPAY_SERVER_IP to the API egress/public IP used for query and refund requests.',
    ],
    verify: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
  },
];

const output = {
  ok: true,
  project: {
    appName: 'HANDS',
    domain: env.APP_DOMAIN ?? 'hands.vn',
    adminEmail: env.ADMIN_EMAIL ?? 'administration@hands.vn',
    registrar: 'PA Vietnam (https://www.pavietnam.vn)',
    dnsProvider: 'PA Vietnam direct DNS management',
    dnsPermission: 'Operator can add and delete DNS records directly',
    githubOrganization: 'hands-platform',
    githubRepository: 'https://github.com/hands-platform/hands-app',
    serviceArea: 'Vietnam nationwide',
    workspace: normalizePath(repoRoot),
    secretFolder: 'C:\\dev\\hands-secrets',
    androidApplicationIds: {
      customer: 'com.massagevn.customer.customer_app',
      provider: 'com.massagevn.provider.provider_app',
    },
  },
  summary: {
    total: registrationItems.length,
    ready: registrationItems.filter(itemReady).length,
    pending: registrationItems.filter((item) => !itemReady(item)).length,
  },
  registrationItems,
};

const renderedOutput = format === 'json' ? JSON.stringify(output, null, 2) : toMarkdown(output);

if (outFile) {
  const outputPath = resolve(outFile);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${renderedOutput}\n`);
  console.log(
    JSON.stringify(
      {
        ok: true,
        output: normalizePath(relative(repoRoot, outputPath)),
        format,
        summary: output.summary,
        nextSteps: [
          'Open the generated registration pack when filling external console values.',
          'Keep real credentials in .env or the local secrets folder, never in the generated pack.',
          'Run npm.cmd run external:check after filling values.',
        ],
      },
      null,
      2,
    ),
  );
} else {
  console.log(renderedOutput);
}

function toMarkdown(pack) {
  const lines = [
    '# HANDS External Registration Pack',
    '',
    `- App: ${pack.project.appName}`,
    `- Domain: \`${pack.project.domain}\``,
    `- Admin email: \`${pack.project.adminEmail}\``,
    `- Registrar: ${pack.project.registrar}`,
    `- DNS provider: ${pack.project.dnsProvider}`,
    `- DNS permission: ${pack.project.dnsPermission}`,
    `- GitHub organization: \`${pack.project.githubOrganization}\``,
    `- GitHub repository: ${pack.project.githubRepository}`,
    `- Service area: ${pack.project.serviceArea}`,
    `- Workspace: \`${pack.project.workspace}\``,
    `- Secret folder: \`${pack.project.secretFolder}\``,
    `- Customer Android package: \`${pack.project.androidApplicationIds.customer}\``,
    `- Partner Android package: \`${pack.project.androidApplicationIds.provider}\``,
    '',
    `Status: ${pack.summary.ready}/${pack.summary.total} account group(s) configured, ${pack.summary.pending} pending.`,
    '',
  ];

  for (const item of pack.registrationItems) {
    lines.push(`## ${item.order}. ${item.category}: ${item.account}`);
    lines.push('');
    lines.push(`Purpose: ${item.purpose}`);
    lines.push('');
    lines.push(`Console: ${item.consolePath}`);
    if (item.statusNote) {
      lines.push('');
      lines.push(`Status note: ${item.statusNote}`);
    }
    lines.push('');
    lines.push('Environment values:');
    for (const entry of item.env) {
      lines.push(`- [${entry.configured ? 'x' : ' '}] \`${entry.name}\` = \`${entry.example}\``);
    }
    lines.push('');
    lines.push('Setup notes:');
    for (const note of item.setup) {
      lines.push(`- ${note}`);
    }
    lines.push('');
    lines.push('Verify:');
    for (const command of item.verify) {
      lines.push(`- \`${command}\``);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function envItem(name, example, configured) {
  return { name, example, configured };
}

function itemReady(item) {
  if (typeof item.ready === 'boolean') {
    return item.ready;
  }
  return item.env.every((entry) => entry.configured);
}

function hasValue(value) {
  return String(value ?? '').trim().length > 0;
}

function hasRealSmsProvider(value) {
  const provider = String(value ?? '')
    .trim()
    .toLowerCase();
  return supportedSmsProviders.has(provider);
}

function isSecretLikeValue(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length >= 16 && !/^change-me$/i.test(normalized);
}

function isHttpsUrl(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return false;
  }
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSupabaseProjectUrl(value) {
  if (!isHttpsUrl(value)) {
    return false;
  }

  const hostname = new URL(String(value).trim()).hostname.toLowerCase();
  return /^[a-z0-9]{10,}\.supabase\.co$/.test(hostname);
}

function isPlayStoreUrl(value, expectedPackageId) {
  if (!isHttpsUrl(value)) {
    return false;
  }

  const url = new URL(String(value).trim());
  return url.hostname === 'play.google.com' && url.searchParams.get('id') === expectedPackageId;
}

function normalizePath(value) {
  return value.replaceAll('/', '\\');
}
