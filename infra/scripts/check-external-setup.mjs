import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';
import { firebaseAdminCredentialsConfigured } from './lib/firebase-admin-credentials.mjs';
import {
  firebaseProjectAlignment,
  firebaseProjectAlignmentActions,
} from './lib/firebase-project-alignment.mjs';
import {
  buildExternalSetupNextActions,
  referralReleaseReadiness,
  shouldCheckSupabaseReachability,
} from './lib/external-setup-report.mjs';
import { checkSupabaseProjectReachability } from './lib/supabase-project-reachability.mjs';
import { checkSupabaseApiKeyValidity } from './lib/supabase-api-key-validity.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const paymentAdaptersPath = resolve(repoRoot, 'apps', 'api', 'src', 'payments', 'adapters.ts');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const strict = process.argv.includes('--strict');
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) ?? 'advisory';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const projectAlignment = firebaseProjectAlignment(env, { repoRoot });
const dockerContractCommand = 'npm.cmd run docker:contract';

const checks = [];
const mobileReleaseKeystoreEnvKeys = ['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE'];
const momoEnvKeys = ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'];
const momoEndpointEnvKeys = ['MOMO_BASE_URL', 'MOMO_IPN_URL', 'MOMO_REDIRECT_URL'];
const vnpayEnvKeys = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'];
const vnpayEndpointEnvKeys = ['VNPAY_PAYMENT_URL', 'VNPAY_API_URL', 'VNPAY_RETURN_URL'];
const adminWebSecretEnvKeys = [
  'ADMIN_MFA_ENCRYPTION_KEY',
  'ADMIN_WEB_API_TOKEN_SECRET',
  'ADMIN_REALTIME_TOKEN_SECRET',
  'ADMIN_WEB_SESSION_COOKIE_SECRET',
];
const productionPublicUrlEnvKeys = ['PUBLIC_WEB_URL', 'API_PUBLIC_URL', 'ADMIN_PUBLIC_URL'];
const supportedSmsProviders = new Set(['vonage', 'viettel', 'fpt', 'custom']);
const momoCredentialsFix =
  'Create or open the MoMo Merchant Portal sandbox integration, copy MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, and MOMO_SECRET_KEY into the ignored env file, then register the public HTTPS IPN and customer return URLs.';
const vnpayCredentialsFix =
  'Create or open the VNPay Merchant Portal sandbox integration, copy VNPAY_TMN_CODE and VNPAY_HASH_SECRET into the ignored env file, then register a provider-reachable HTTPS GET IPN URL at /api/payments/VNPAY/callback. Localhost cannot receive VNPay IPN requests; register https://api.hands.vn/api/payments/VNPAY/callback only after API hosting and TLS are ready.';
const smsProviderFix =
  'Create or open the Vonage SMS dashboard, or another approved Vietnam-capable SMS provider, then set SMS_PROVIDER to vonage, viettel, fpt, or custom before Supabase Phone Auth E2E.';
const smsApiUrlFix =
  'Copy the selected SMS provider API endpoint into SMS_API_URL before Supabase Phone Auth E2E. For Vonage, use the API endpoint required by the selected SMS/Verify product.';
const smsApiKeyFix =
  'Copy the selected SMS provider API key into SMS_API_KEY before Supabase Phone Auth E2E. For Vonage this is the short API key, not the API secret.';
const smsApiSecretFix =
  'Copy the selected SMS provider API secret into SMS_API_SECRET before Supabase Phone Auth E2E. Keep it in ignored env files or the secret store only.';
const smsSenderIdFix =
  'Copy the approved SMS sender ID or brand name into SMS_SENDER_ID before Supabase Phone Auth E2E. Use the sender value issued by the selected Vietnam-capable SMS provider.';
const supabasePhoneSmokePhoneFix =
  'Set SUPABASE_PHONE_SMOKE_PHONE to the Vietnam E.164 phone that should receive the live Supabase Phone Auth OTP smoke, for example +84900000001.';
const storageRequiredEnvKeys = [
  'STORAGE_PROVIDER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_PUBLIC_BASE_URL',
];
const storageSplitBucketEnvKeys = ['S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET'];
const referralReadiness = referralReleaseReadiness(env);
const referralStoreFix =
  'Set REFERRAL_PUBLIC_BASE_URL and the Google Play URLs for com.massagevn.customer.customer_app and com.massagevn.provider.provider_app before the current Android referral link E2E. Keep automatic referral payout disabled; use the audited admin credit action for wallet posting until automatic payout is explicitly approved.';
const validPhases = new Set([
  'advisory',
  'supabase-core',
  'supabase-auth',
  'maps',
  'payments',
  'push',
  'storage',
  'referrals',
  'production',
]);

if (!validPhases.has(phase)) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: `Unknown phase "${phase}".`,
        validPhases: [...validPhases],
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

addCheck(
  'workspace',
  'project root',
  existsSync(resolve('package.json')),
  'Run this script from C:\\dev\\massage-on-demand-vn.',
);
addRecommended(
  'push',
  'PUSH_PROVIDER',
  hasValue('PUSH_PROVIDER'),
  'Use PUSH_PROVIDER=in_app_only locally; set PUSH_PROVIDER=fcm before production FCM push E2E.',
);
addRecommended(
  'push',
  'Firebase Admin credentials',
  firebaseAdminConfigured(),
  'Fill server-side Firebase Admin credentials before production Android/iOS FCM push launch. If using GOOGLE_APPLICATION_CREDENTIALS, point it to an existing valid service account JSON file.',
);
addRecommended('push', 'Firebase project alignment', projectAlignment.ok, firebaseProjectAlignmentFix());
addPhaseRequired(
  'push',
  'PUSH_PROVIDER=fcm for FCM push',
  hasExpectedValue('PUSH_PROVIDER', 'fcm'),
  'Set PUSH_PROVIDER=fcm before production-like FCM push E2E.',
  ['push', 'production'],
);
addPhaseRequired(
  'push',
  'Firebase Admin credentials for FCM push',
  firebaseAdminConfigured(),
  'Fill FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or an existing valid GOOGLE_APPLICATION_CREDENTIALS service account JSON file before production-like FCM push E2E.',
  ['push', 'production'],
);
addPhaseRequired(
  'push',
  'Firebase Admin project matches mobile apps',
  projectAlignment.ok,
  firebaseProjectAlignmentFix(),
  ['push', 'production'],
);

addRecommended(
  'maps',
  'MAPTILER_API_KEY',
  hasValue('MAPTILER_API_KEY'),
  'Set MAPTILER_API_KEY in .env or the shell before running Flutter with the MapTiler map.',
);
addPhaseRequired(
  'maps',
  'MAPTILER_API_KEY for map screens',
  hasValue('MAPTILER_API_KEY'),
  'Create a MapTiler key and set MAPTILER_API_KEY before real map E2E.',
  ['maps', 'production'],
);
addRecommended(
  'geocoding',
  'GEOAPIFY_API_KEY',
  hasValue('GEOAPIFY_API_KEY'),
  'Set GEOAPIFY_API_KEY in .env or the shell before using address search.',
);
addPhaseRequired(
  'geocoding',
  'GEOAPIFY_API_KEY for address search',
  hasValue('GEOAPIFY_API_KEY'),
  'Create a Geoapify key and set GEOAPIFY_API_KEY before address search E2E.',
  ['maps', 'production'],
);

addRecommended(
  'supabase',
  'AUTH_BACKEND',
  hasOneOfExpectedValues('AUTH_BACKEND', ['nest', 'supabase']),
  'Keep AUTH_BACKEND=nest for local/dev OTP; switch to AUTH_BACKEND=supabase only for the real Supabase Phone Auth E2E phase.',
);
addRecommended(
  'supabase',
  'SUPABASE_URL',
  isHttpsUrl('SUPABASE_URL'),
  'Set SUPABASE_URL if using Supabase directly for map/location storage.',
);
addRecommended(
  'supabase',
  'SUPABASE_ANON_KEY',
  hasValue('SUPABASE_ANON_KEY'),
  'Set SUPABASE_ANON_KEY if using Supabase directly from clients.',
);
addRecommended(
  'supabase',
  'SUPABASE_JWT_SECRET',
  hasSecretLikeValue('SUPABASE_JWT_SECRET'),
  'Set SUPABASE_JWT_SECRET on the API before accepting Supabase Auth access tokens.',
);
addRecommended(
  'supabase',
  'SUPABASE_SERVICE_ROLE_KEY',
  hasSecretLikeValue('SUPABASE_SERVICE_ROLE_KEY'),
  'Set SUPABASE_SERVICE_ROLE_KEY on the API only when syncing approved provider roles into Supabase Auth metadata.',
);
addPhaseRequired(
  'supabase',
  'SUPABASE_URL for core Supabase integration',
  isHttpsUrl('SUPABASE_URL'),
  'Set SUPABASE_URL=https://<project-ref>.supabase.co before Supabase-backed storage/auth/location E2E.',
  ['supabase-core', 'supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_ANON_KEY for client reads/auth',
  hasValue('SUPABASE_ANON_KEY'),
  'Set SUPABASE_ANON_KEY from Supabase Project Settings > API.',
  ['supabase-core', 'supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_JWT_SECRET for API token verification',
  hasSecretLikeValue('SUPABASE_JWT_SECRET'),
  'Set SUPABASE_JWT_SECRET from Supabase Project Settings > API > JWT secret.',
  ['supabase-core', 'supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_SERVICE_ROLE_KEY for server-side sync',
  hasSecretLikeValue('SUPABASE_SERVICE_ROLE_KEY'),
  'Set SUPABASE_SERVICE_ROLE_KEY from Supabase Project Settings > API. Keep it server-side only.',
  ['supabase-core', 'supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'AUTH_BACKEND=supabase for Phone Auth',
  hasExpectedValue('AUTH_BACKEND', 'supabase'),
  'Set AUTH_BACKEND=supabase before Supabase Phone Auth E2E.',
  ['supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_PHONE_SMOKE_PHONE for live OTP smoke',
  hasVietnamE164Phone('SUPABASE_PHONE_SMOKE_PHONE'),
  supabasePhoneSmokePhoneFix,
  ['supabase-auth'],
);

addRecommended(
  'sms',
  'SMS_PROVIDER',
  hasValue('SMS_PROVIDER'),
  'Use SMS_PROVIDER=dev locally; configure the chosen Vietnam-capable SMS provider only when Phone Auth/SMS E2E starts.',
);
addPhaseRequired(
  'sms',
  'SMS_PROVIDER for Phone Auth',
  hasRealSmsProvider(),
  smsProviderFix,
  ['supabase-auth', 'production'],
);
addRecommended(
  'sms',
  'SMS_API_URL',
  isHttpsUrl('SMS_API_URL'),
  'Deferred: fill the chosen SMS provider values before real OTP launch.',
);
addPhaseRequired(
  'sms',
  'SMS_API_URL for Phone Auth',
  isHttpsUrl('SMS_API_URL'),
  smsApiUrlFix,
  ['supabase-auth', 'production'],
);
addRecommended(
  'sms',
  'SMS_API_KEY',
  hasValue('SMS_API_KEY'),
  'Deferred: fill the chosen SMS provider API key before real OTP launch.',
);
addPhaseRequired(
  'sms',
  'SMS_API_KEY for Phone Auth',
  hasValue('SMS_API_KEY'),
  smsApiKeyFix,
  ['supabase-auth', 'production'],
);
addRecommended(
  'sms',
  'SMS_API_SECRET',
  hasSecretLikeValue('SMS_API_SECRET'),
  'Deferred: fill the chosen SMS provider API secret before real OTP launch.',
);
addPhaseRequired(
  'sms',
  'SMS_API_SECRET for Phone Auth',
  hasSecretLikeValue('SMS_API_SECRET'),
  smsApiSecretFix,
  ['supabase-auth', 'production'],
);
addRecommended(
  'sms',
  'SMS_SENDER_ID',
  hasValue('SMS_SENDER_ID'),
  'Deferred: fill the approved SMS sender ID before real OTP launch.',
);
addPhaseRequired(
  'sms',
  'SMS_SENDER_ID for Phone Auth',
  hasValue('SMS_SENDER_ID'),
  smsSenderIdFix,
  ['supabase-auth', 'production'],
);

addRecommended(
  'mobile-release',
  'Android customer/partner upload keystores',
  allHaveExistingPath(mobileReleaseKeystoreEnvKeys),
  'Create separate Android upload keystores, store them outside Git, and set valid local keystore paths before Play release.',
);
addPhaseRequired(
  'mobile-release',
  'Android customer/partner upload keystores',
  allHaveExistingPath(mobileReleaseKeystoreEnvKeys),
  'Fill ANDROID_CUSTOMER_UPLOAD_KEYSTORE and ANDROID_PROVIDER_UPLOAD_KEYSTORE with existing local files before production Android release.',
  ['production'],
);

addRecommended(
  'payments',
  'Real MoMo gateway adapter',
  paymentGatewayAdapterImplemented('MomoPaymentAdapter'),
  'Connect the tested MoMo gateway client before accepting MoMo bookings.',
);
addRecommended(
  'payments',
  'Real VNPay gateway adapter',
  paymentGatewayAdapterImplemented('VnpayPaymentAdapter'),
  'Replace the VNPay placeholder with a tested sandbox gateway implementation before accepting VNPay bookings.',
);
addPhaseRequired(
  'payments',
  'Real MoMo gateway adapter',
  paymentGatewayAdapterImplemented('MomoPaymentAdapter'),
  'Connect the tested MoMo gateway client to authorization, status, capture/cancel, refund, and refund-query recovery before sandbox E2E.',
  ['payments', 'production'],
);
addPhaseRequired(
  'payments',
  'Real VNPay gateway adapter',
  paymentGatewayAdapterImplemented('VnpayPaymentAdapter'),
  'Keep VNPAY_GATEWAY_ENABLED=false until signed checkout, IPN/status recovery, matching recovery, and asynchronous refund pass sandbox E2E.',
  ['payments', 'production'],
);
addPhaseRequired(
  'payments',
  'MoMo gateway explicitly enabled',
  hasExpectedValue('MOMO_GATEWAY_ENABLED', 'true'),
  'Set MOMO_GATEWAY_ENABLED=true only after filling the sandbox credentials and HTTPS endpoints and passing checkout, IPN, status, capture/cancel, refund, and refund-query recovery tests.',
  ['payments', 'production'],
);
addPhaseRequired(
  'payments',
  'VNPay gateway explicitly enabled',
  hasExpectedValue('VNPAY_GATEWAY_ENABLED', 'true'),
  'Set VNPAY_GATEWAY_ENABLED=true only after sandbox checkout, IPN, status recovery, and asynchronous refund E2E pass.',
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'MoMo credentials',
  allHaveValue(momoEnvKeys),
  momoCredentialsFix,
);
addPhaseRequired(
  'payments',
  'MoMo credentials',
  allHaveValue(momoEnvKeys),
  momoCredentialsFix,
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'MoMo HTTPS endpoints',
  allAreHttpsUrls(momoEndpointEnvKeys),
  'Set MOMO_BASE_URL, MOMO_IPN_URL, and MOMO_REDIRECT_URL to the HTTPS sandbox endpoints registered with MoMo.',
);
addPhaseRequired(
  'payments',
  'MoMo HTTPS endpoints',
  allAreHttpsUrls(momoEndpointEnvKeys),
  'Register HTTPS IPN and redirect URLs with MoMo and set MOMO_BASE_URL, MOMO_IPN_URL, and MOMO_REDIRECT_URL before sandbox E2E.',
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'VNPay credentials',
  allHaveValue(vnpayEnvKeys),
  vnpayCredentialsFix,
);
addPhaseRequired(
  'payments',
  'VNPay credentials',
  allHaveValue(vnpayEnvKeys),
  vnpayCredentialsFix,
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'VNPay HTTPS endpoints and server IP',
  allAreHttpsUrls(vnpayEndpointEnvKeys) && hasValue('VNPAY_SERVER_IP'),
  'Set the VNPay payment, transaction API, customer return URLs, and the registered merchant server IP before sandbox E2E.',
);
addPhaseRequired(
  'payments',
  'VNPay HTTPS endpoints and server IP',
  allAreHttpsUrls(vnpayEndpointEnvKeys) && hasValue('VNPAY_SERVER_IP'),
  'Set VNPAY_PAYMENT_URL, VNPAY_API_URL, VNPAY_RETURN_URL, and VNPAY_SERVER_IP before sandbox E2E.',
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'Unverified payment callbacks disabled',
  unverifiedPaymentCallbacksDisabled(),
  'Keep ALLOW_UNVERIFIED_PAYMENT_CALLBACKS unset or false. Enable it only for an intentional local fixture callback.',
);
addPhaseRequired(
  'payments',
  'Unverified payment callbacks disabled',
  unverifiedPaymentCallbacksDisabled(),
  'Set ALLOW_UNVERIFIED_PAYMENT_CALLBACKS=false before payment sandbox or production E2E.',
  ['payments', 'production'],
);
addPhaseRequired(
  'payments',
  'Placeholder payment authorizations disabled',
  placeholderPaymentAuthorizationsDisabled(),
  'Set ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS=false before payment sandbox or production E2E.',
  ['payments', 'production'],
);

addRecommended(
  'storage',
  'S3-compatible storage',
  storageConfigured(),
  'Local MinIO is enough for MVP; for staging fill S3_ENDPOINT, S3_REGION, access keys, public base URL, and either S3_BUCKET or both S3_PRIVATE_BUCKET/S3_PUBLIC_BUCKET.',
);
addPhaseRequired(
  'storage',
  'production file storage',
  storageConfigured(),
  'Fill production S3/Supabase Storage/R2 values before production-like storage E2E. Prefer separate private/public buckets.',
  ['storage', 'production'],
);

addRecommended(
  'referrals',
  'Android referral app store URLs',
  referralReadiness.android,
  'Fill the public referral base URL and exact customer/Partner Google Play package URLs before referral E2E.',
);
addDeferred(
  'referrals',
  'iOS referral app store URLs',
  referralReadiness.ios,
  'Deferred until HANDS customer and Partner iOS apps enter release preparation.',
);
addPhaseRequired(
  'referrals',
  'Android referral app store URLs for referral E2E',
  referralReadiness.android,
  referralStoreFix,
  ['referrals', 'production'],
);

addRecommended(
  'admin-security',
  'Admin Web scoped token and session secrets',
  allHaveDistinctSecretValues(adminWebSecretEnvKeys),
  'Set separate non-placeholder ADMIN_MFA_ENCRYPTION_KEY, ADMIN_WEB_API_TOKEN_SECRET, ADMIN_REALTIME_TOKEN_SECRET, and ADMIN_WEB_SESSION_COOKIE_SECRET values.',
);
addPhaseRequired(
  'admin-security',
  'Admin Web scoped token and session secrets',
  allHaveDistinctSecretValues(adminWebSecretEnvKeys),
  'Production requires separate non-placeholder ADMIN_MFA_ENCRYPTION_KEY, ADMIN_WEB_API_TOKEN_SECRET, ADMIN_REALTIME_TOKEN_SECRET, and ADMIN_WEB_SESSION_COOKIE_SECRET values.',
  ['production'],
);
addPhaseRequired(
  'production-network',
  'Production public HTTPS URLs',
  allAreHttpsUrls(productionPublicUrlEnvKeys),
  'Set PUBLIC_WEB_URL, API_PUBLIC_URL, and ADMIN_PUBLIC_URL to their final HTTPS origins before DNS/TLS E2E.',
  ['production'],
);

if (shouldCheckSupabaseReachability({ phase, strict })) {
  const reachability = await checkSupabaseProjectReachability(env.SUPABASE_URL);
  addCheck(
    'supabase',
    'Supabase project hostname resolves',
    reachability.dnsResolved,
    'Confirm the active project in Supabase Dashboard and copy its current Project URL into the ignored environment file.',
  );
  addCheck(
    'supabase',
    'Supabase HTTPS endpoint responds',
    reachability.httpsReachable,
    'Restore or unpause the active Supabase project, then verify its HTTPS endpoint before SQL, location, or OTP E2E.',
  );

  if (reachability.httpsReachable) {
    const [anonKeyValidity, serviceKeyValidity] = await Promise.all([
      checkSupabaseApiKeyValidity(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
      checkSupabaseApiKeyValidity(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
    ]);
    addCheck(
      'supabase',
      'Supabase anonymous API key is accepted by the active project',
      anonKeyValidity.valid,
      'Copy the active project publishable/anon key into the ignored environment file; do not expose it in browser-facing logs.',
    );
    addCheck(
      'supabase',
      'Supabase server API key is accepted by the active project',
      serviceKeyValidity.valid,
      'Rotate or replace SUPABASE_SERVICE_ROLE_KEY with the active project server-side secret, then restart the API. Keep it out of client bundles.',
    );
  }
}

const scopedChecks = checks.filter((check) => checkIncludedInPhase(check.category));
const requiredFailures = scopedChecks.filter((check) => check.required && check.status === 'FAIL');
const recommendedFailures = scopedChecks.filter((check) => !check.required && check.status === 'WARN');

const result = {
  ok: requiredFailures.length === 0 && (!strict || recommendedFailures.length === 0),
  mode: strict ? 'strict' : phase,
  envFile: envFileExists ? envPath : null,
  phase,
  checks: scopedChecks,
  nextActions: buildExternalSetupNextActions({
    phase,
    requiredFailures,
    recommendedFailures,
    dockerContractCommand,
  }),
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

function addCheck(category, name, passed, fix) {
  checks.push({
    category,
    name,
    required: true,
    status: passed ? 'PASS' : 'FAIL',
    fix,
  });
}

function addRecommended(category, name, passed, fix) {
  checks.push({
    category,
    name,
    required: false,
    status: passed ? 'PASS' : 'WARN',
    fix,
  });
}

function addDeferred(category, name, ready, fix) {
  checks.push({
    category,
    name,
    required: false,
    status: ready ? 'PASS' : 'DEFERRED',
    fix,
  });
}

function unverifiedPaymentCallbacksDisabled() {
  return String(env.ALLOW_UNVERIFIED_PAYMENT_CALLBACKS ?? '')
    .trim()
    .toLowerCase() !== 'true';
}

function placeholderPaymentAuthorizationsDisabled() {
  return String(env.ALLOW_PLACEHOLDER_PAYMENT_AUTHORIZATIONS ?? '')
    .trim()
    .toLowerCase() !== 'true';
}

function paymentGatewayAdapterImplemented(adapterName) {
  if (!existsSync(paymentAdaptersPath)) {
    return false;
  }
  const source = readFileSync(paymentAdaptersPath, 'utf8');
  if (adapterName === 'MomoPaymentAdapter') {
    return (
      source.includes('MOMO_GATEWAY_ENABLED') &&
      source.includes('MomoGatewayClient') &&
      source.includes("return this.client().refundPayment") &&
      source.includes("return this.client().queryRefund")
    );
  }
  if (adapterName === 'VnpayPaymentAdapter') {
    return (
      source.includes('VNPAY_GATEWAY_ENABLED') &&
      source.includes('VnpayGatewayClient') &&
      source.includes('requestRefund') &&
      source.includes('checkRefund')
    );
  }
  return !new RegExp(`class\\s+${adapterName}\\s+extends\\s+PlaceholderRedirectAdapter`).test(source);
}

function addPhaseRequired(category, name, passed, fix, phases) {
  if (!phases.includes(phase)) {
    return;
  }
  addCheck(category, name, passed, fix);
}

function checkIncludedInPhase(category) {
  if (phase === 'advisory' || phase === 'production') {
    return true;
  }

  const phaseCategories = {
    maps: new Set(['workspace', 'maps', 'geocoding']),
    payments: new Set(['workspace', 'payments']),
    push: new Set(['workspace', 'push']),
    referrals: new Set(['workspace', 'referrals']),
    storage: new Set(['workspace', 'storage']),
    'supabase-auth': new Set(['workspace', 'supabase', 'sms']),
    'supabase-core': new Set(['workspace', 'supabase']),
  };

  return (phaseCategories[phase] ?? new Set(['workspace'])).has(category);
}

function hasValue(key) {
  return String(env[key] ?? '').trim().length > 0;
}

function hasExpectedValue(key, expected) {
  return (
    String(env[key] ?? '')
      .trim()
      .toLowerCase() === expected.toLowerCase()
  );
}

function hasOneOfExpectedValues(key, expectedValues) {
  const actual = String(env[key] ?? '').trim().toLowerCase();
  return expectedValues.some((expected) => actual === expected.toLowerCase());
}

function hasSecretLikeValue(key) {
  const value = String(env[key] ?? '').trim();
  return value.length >= 16 && !/^change-me$/i.test(value);
}

function isHttpsUrl(key) {
  const value = String(env[key] ?? '').trim();
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function hasVietnamE164Phone(key) {
  const value = String(env[key] ?? '')
    .trim()
    .replace(/[\s().-]/g, '');
  return /^\+84\d{8,10}$/.test(value);
}

function allHaveValue(keys) {
  return keys.every(hasValue);
}

function allHaveDistinctSecretValues(keys) {
  const values = keys.map((key) => String(env[key] ?? '').trim());
  return keys.every(hasSecretLikeValue) && new Set(values).size === values.length;
}

function allAreHttpsUrls(keys) {
  return keys.every(isHttpsUrl);
}

function hasRealSmsProvider() {
  const provider = String(env.SMS_PROVIDER ?? '').trim().toLowerCase();
  return supportedSmsProviders.has(provider);
}

function pathExists(key) {
  return pathValueExists(env[key]);
}

function pathValueExists(value) {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 && existsSync(resolve(normalized));
}

function allHaveExistingPath(keys) {
  return keys.every(pathExists);
}

function firebaseAdminConfigured() {
  return firebaseAdminCredentialsConfigured(env);
}

function firebaseProjectAlignmentFix() {
  return (
    firebaseProjectAlignmentActions(projectAlignment.invalid).at(0) ??
    'Keep Firebase Admin credentials and mobile google-services.json files in the same Firebase project before live FCM push.'
  );
}

function storageConfigured() {
  return (
    allHaveValue(storageRequiredEnvKeys) && (hasValue('S3_BUCKET') || allHaveValue(storageSplitBucketEnvKeys))
  );
}
