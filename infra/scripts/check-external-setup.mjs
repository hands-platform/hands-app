import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const strict = process.argv.includes('--strict');
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) ?? 'advisory';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const checks = [];
const firebaseAdminEnvKeys = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const mobileReleaseKeystoreEnvKeys = ['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE'];
const momoEnvKeys = ['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY'];
const vnpayEnvKeys = ['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET'];
const storageRequiredEnvKeys = [
  'STORAGE_PROVIDER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_PUBLIC_BASE_URL',
];
const storageSplitBucketEnvKeys = ['S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET'];
const validPhases = new Set([
  'advisory',
  'supabase-core',
  'supabase-auth',
  'maps',
  'payments',
  'storage',
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
  'Use PUSH_PROVIDER=in_app_only locally; set PUSH_PROVIDER=fcm before production push E2E.',
);
addRecommended(
  'push',
  'Firebase Admin credentials',
  firebaseAdminConfigured(),
  'Fill server-side Firebase Admin credentials before production Android/iOS push launch.',
);
addPhaseRequired(
  'push',
  'PUSH_PROVIDER=fcm for OS push',
  hasExpectedValue('PUSH_PROVIDER', 'fcm'),
  'Set PUSH_PROVIDER=fcm before production-like OS push E2E.',
  ['production'],
);
addPhaseRequired(
  'push',
  'Firebase Admin credentials for OS push',
  firebaseAdminConfigured(),
  'Fill FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY, or GOOGLE_APPLICATION_CREDENTIALS before production-like OS push E2E.',
  ['production'],
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
  hasExpectedValue('AUTH_BACKEND', 'supabase'),
  'Set AUTH_BACKEND=supabase when running the real Supabase mobile OTP flow.',
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

addRecommended(
  'sms',
  'SMS_PROVIDER',
  hasValue('SMS_PROVIDER'),
  'Use SMS_PROVIDER=dev locally; configure the chosen Vietnam-capable SMS provider only when Phone Auth/SMS E2E starts.',
);
addRecommended(
  'sms',
  'SMS_API_URL',
  hasValue('SMS_API_URL'),
  'Deferred: fill the chosen SMS provider values before real OTP launch.',
);
addRecommended(
  'sms',
  'SMS_API_KEY',
  hasValue('SMS_API_KEY'),
  'Deferred: fill the chosen SMS provider secret before real OTP launch.',
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
  'MoMo credentials',
  allHaveValue(momoEnvKeys),
  'Fill MoMo merchant credentials before MoMo E2E.',
);
addPhaseRequired(
  'payments',
  'MoMo credentials',
  allHaveValue(momoEnvKeys),
  'Fill MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, and MOMO_SECRET_KEY before payment E2E.',
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'VNPay credentials',
  allHaveValue(vnpayEnvKeys),
  'Fill VNPay merchant credentials before VNPay E2E.',
);
addPhaseRequired(
  'payments',
  'VNPay credentials',
  allHaveValue(vnpayEnvKeys),
  'Fill VNPAY_TMN_CODE and VNPAY_HASH_SECRET before VNPay E2E.',
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

const requiredFailures = checks.filter((check) => check.required && check.status !== 'PASS');
const recommendedFailures = checks.filter((check) => !check.required && check.status !== 'PASS');

const result = {
  ok: requiredFailures.length === 0 && (!strict || recommendedFailures.length === 0),
  mode: strict ? 'strict' : phase,
  envFile: envFileExists ? envPath : null,
  phase,
  checks,
  nextActions: [...requiredFailures, ...(strict ? recommendedFailures : [])].map((check) => check.fix),
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

function addPhaseRequired(category, name, passed, fix, phases) {
  if (!phases.includes(phase)) {
    return;
  }
  addCheck(category, name, passed, fix);
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
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function allHaveValue(keys) {
  return keys.every(hasValue);
}

function pathExists(key) {
  const value = String(env[key] ?? '').trim();
  return value.length > 0 && existsSync(resolve(value));
}

function allHaveExistingPath(keys) {
  return keys.every(pathExists);
}

function firebaseAdminConfigured() {
  return (
    hasValue('FIREBASE_SERVICE_ACCOUNT_JSON') ||
    allHaveValue(firebaseAdminEnvKeys) ||
    hasValue('GOOGLE_APPLICATION_CREDENTIALS')
  );
}

function storageConfigured() {
  return (
    allHaveValue(storageRequiredEnvKeys) && (hasValue('S3_BUCKET') || allHaveValue(storageSplitBucketEnvKeys))
  );
}
