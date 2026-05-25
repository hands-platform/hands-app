import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const format =
  process.argv.find((arg) => arg.startsWith('--format='))?.slice('--format='.length) ?? 'markdown';
const outFile = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);
const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const envPath = resolve(envFile);
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

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
      'Use administration@hands.vn as the owner/admin login for GitHub, Supabase, MapTiler, Geoapify, OneSignal, payment gateways, and storage providers.',
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
        'https://adzpstrkpzwpukuboxzj.supabase.co',
        env.SUPABASE_URL === 'https://adzpstrkpzwpukuboxzj.supabase.co',
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
      'Keep Phone Auth/SMS out of this core step; it is tracked separately with Vonage.',
    ],
    verify: ['npm.cmd run supabase:sql:pack', 'npm.cmd run external:check:supabase'],
  },
  {
    order: 3,
    category: 'Supabase Phone Auth',
    account: 'Supabase Phone Auth + Vonage',
    purpose: 'Deferred real OTP delivery and Supabase access-token exchange for mobile login.',
    consolePath: 'Supabase Dashboard > Authentication > Providers > Phone and Vonage Dashboard',
    env: [
      envItem(
        'AUTH_BACKEND',
        'nest until Phone Auth E2E, then supabase',
        ['nest', 'supabase'].includes(String(env.AUTH_BACKEND ?? '').toLowerCase()),
      ),
      envItem('SMS_PROVIDER', 'vonage', String(env.SMS_PROVIDER ?? '').toLowerCase() === 'vonage'),
      envItem('SMS_API_URL', 'https://<sms-provider-api>', hasValue(env.SMS_API_URL)),
      envItem('SMS_API_KEY', '<sms-api-key>', hasValue(env.SMS_API_KEY)),
    ],
    setup: [
      'Keep AUTH_BACKEND=nest and SMS_PROVIDER=dev for current local/product development.',
      'Configure Vonage only when OTP E2E starts.',
      'After Vonage OTP works, switch AUTH_BACKEND=supabase for the dedicated auth migration pass.',
    ],
    verify: ['npm.cmd run external:check:supabase-auth', 'npm.cmd run auth:supabase-smoke'],
  },
  {
    order: 4,
    category: 'Maps',
    account: 'MapTiler',
    purpose: 'Low-cost map tile/style rendering for customer and provider mobile screens.',
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
    category: 'Payments',
    account: 'MoMo merchant sandbox',
    purpose: 'Vietnam wallet authorization, release, capture, and refund testing.',
    consolePath: 'MoMo Merchant Portal > Integration credentials',
    env: [
      envItem('MOMO_PARTNER_CODE', '<momo-partner-code>', hasValue(env.MOMO_PARTNER_CODE)),
      envItem('MOMO_ACCESS_KEY', '<momo-access-key>', hasValue(env.MOMO_ACCESS_KEY)),
      envItem('MOMO_SECRET_KEY', '<momo-secret-key>', hasValue(env.MOMO_SECRET_KEY)),
    ],
    setup: ['Start with sandbox credentials.', 'Keep cash payment enabled as operational fallback.'],
    verify: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
  },
  {
    order: 7,
    category: 'Payments',
    account: 'VNPay merchant sandbox',
    purpose: 'Vietnam card/bank payment authorization and refund testing.',
    consolePath: 'VNPay Merchant Portal > Integration credentials',
    env: [
      envItem('VNPAY_TMN_CODE', '<vnpay-tmn-code>', hasValue(env.VNPAY_TMN_CODE)),
      envItem('VNPAY_HASH_SECRET', '<vnpay-hash-secret>', hasValue(env.VNPAY_HASH_SECRET)),
    ],
    setup: ['Start with sandbox credentials.', 'Confirm callback and return URLs after domains are chosen.'],
    verify: ['npm.cmd run external:check:payments', 'node infra\\scripts\\api-smoke.mjs'],
  },
  {
    order: 8,
    category: 'Storage',
    account: 'Supabase Storage S3, R2, or S3-compatible bucket',
    purpose: 'Provider verification files, public profile media, and moderation evidence.',
    consolePath: 'Supabase Storage / Cloudflare R2 / S3-compatible console',
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
    order: 9,
    category: 'Push',
    account: 'OneSignal or equivalent push provider',
    purpose: 'Native OS push after Firebase Messaging removal.',
    consolePath: 'OneSignal Dashboard > App Settings',
    env: [
      envItem('PUSH_PROVIDER', 'onesignal', env.PUSH_PROVIDER === 'onesignal'),
      envItem('ONESIGNAL_APP_ID', '<onesignal-app-id>', hasValue(env.ONESIGNAL_APP_ID)),
      envItem(
        'ONESIGNAL_REST_API_KEY',
        '<onesignal-rest-api-key-server-only>',
        hasValue(env.ONESIGNAL_REST_API_KEY),
      ),
    ],
    setup: [
      'Choose the production push provider before launch.',
      'Keep PUSH_PROVIDER=in_app_only locally until provider credentials and mobile SDK setup are ready.',
      'Keep the REST API key server-side only and never send it to Flutter or browser JavaScript.',
    ],
    verify: ['npm.cmd run external:check:production'],
  },
  {
    order: 10,
    category: 'SMS',
    account: 'Vonage SMS provider',
    purpose: 'Real OTP delivery for Supabase Phone Auth or backend OTP after deferred SMS setup.',
    consolePath: 'Vonage Dashboard',
    env: [
      envItem('SMS_PROVIDER', 'vonage', String(env.SMS_PROVIDER ?? '').toLowerCase() === 'vonage'),
      envItem('SMS_API_URL', 'https://<sms-provider-api>', hasValue(env.SMS_API_URL)),
      envItem('SMS_API_KEY', '<sms-api-key>', hasValue(env.SMS_API_KEY)),
      envItem('SMS_SENDER_ID', 'HANDS', hasValue(env.SMS_SENDER_ID)),
    ],
    setup: [
      'Create Vonage credentials under administration@hands.vn when SMS E2E starts.',
      'Confirm Vietnam delivery rates and sender ID rules.',
      'Define OTP resend and abuse limits.',
    ],
    verify: ['npm.cmd run external:check:production'],
  },
  {
    order: 11,
    category: 'Mobile release',
    account: 'Android Play Console signing',
    purpose: 'Separate customer/provider upload keys and fingerprints for production Android distribution.',
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
    ],
    setup: [
      'Create separate upload keys for the HANDS customer and provider apps.',
      'Optional helper: run npm.cmd run android:signing:create to generate local upload keys and key.properties files.',
      'Store keystores outside Git, preferably under C:\\dev\\massage-vn-workspace\\secrets.',
      'Copy apps/customer_app/android/key.properties.example to apps/customer_app/android/key.properties and fill local secret values.',
      'Copy apps/provider_app/android/key.properties.example to apps/provider_app/android/key.properties and fill local secret values.',
      'Release builds automatically use android/key.properties when it exists and fall back to debug signing for local MVP builds.',
      'Record SHA-1 and SHA-256 fingerprints for any provider that requires Android app restrictions.',
    ],
    verify: [
      'cd apps/customer_app && flutter build apk --release',
      'cd apps/provider_app && flutter build apk --release',
    ],
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
    secretFolder: 'C:\\dev\\massage-vn-workspace\\secrets',
    androidApplicationIds: {
      customer: 'com.massagevn.customer.customer_app',
      provider: 'com.massagevn.provider.provider_app',
    },
  },
  summary: {
    total: registrationItems.length,
    ready: registrationItems.filter((item) => item.env.every((entry) => entry.configured)).length,
    pending: registrationItems.filter((item) => item.env.some((entry) => !entry.configured)).length,
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
    `- Provider Android package: \`${pack.project.androidApplicationIds.provider}\``,
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

function hasValue(value) {
  return String(value ?? '').trim().length > 0;
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
    return new URL(normalized).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseEnv(source) {
  const entries = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const index = line.indexOf('=');
    if (index === -1) {
      continue;
    }
    const key = line.slice(0, index).trim();
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    entries[key] = value;
  }
  return entries;
}

function normalizePath(value) {
  return value.replaceAll('/', '\\');
}
