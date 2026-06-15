import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';
import { firebaseAdminCredentialsConfigured } from './lib/firebase-admin-credentials.mjs';
import {
  firebaseProjectAlignment,
  firebaseProjectAlignmentActions,
} from './lib/firebase-project-alignment.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const strict = process.argv.includes('--strict');
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) ?? 'advisory';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const projectAlignment = firebaseProjectAlignment(env, { repoRoot });

const checks = [];
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
  'push',
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

const scopedChecks = checks.filter((check) => checkIncludedInPhase(check.category));
const requiredFailures = scopedChecks.filter((check) => check.required && check.status !== 'PASS');
const recommendedFailures = scopedChecks.filter((check) => !check.required && check.status !== 'PASS');

const result = {
  ok: requiredFailures.length === 0 && (!strict || recommendedFailures.length === 0),
  mode: strict ? 'strict' : phase,
  envFile: envFileExists ? envPath : null,
  phase,
  checks: scopedChecks,
  nextActions: buildNextActions(requiredFailures, recommendedFailures),
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

function checkIncludedInPhase(category) {
  if (phase === 'advisory' || phase === 'production') {
    return true;
  }

  const phaseCategories = {
    maps: new Set(['workspace', 'maps', 'geocoding']),
    payments: new Set(['workspace', 'payments']),
    push: new Set(['workspace', 'push']),
    storage: new Set(['workspace', 'storage']),
    'supabase-auth': new Set(['workspace', 'supabase', 'sms']),
    'supabase-core': new Set(['workspace', 'supabase']),
  };

  return (phaseCategories[phase] ?? new Set(['workspace'])).has(category);
}

function buildNextActions(requiredFailures, recommendedFailures) {
  const actions = [...requiredFailures, ...(strict ? recommendedFailures : [])].map((check) => check.fix);
  if (phase === 'push') {
    actions.push('Run npm.cmd run fcm:credentials-check to verify Firebase Admin credential file contents.');
    actions.push(
      'Run npm.cmd run docker:contract to verify Docker service URLs and Firebase Admin credential mount paths.',
    );
    actions.push('Run npm.cmd run fcm:token-smoke -- --dry-run to verify token registration smoke inputs.');
    actions.push(
      'Run npm.cmd run fcm:push-smoke -- --dry-run for config-only readiness after Firebase Admin credentials are configured.',
    );
  }
  return [...new Set(actions)];
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
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function allHaveValue(keys) {
  return keys.every(hasValue);
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
