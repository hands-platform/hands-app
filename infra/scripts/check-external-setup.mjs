import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const strict = process.argv.includes('--strict');
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.slice('--phase='.length) ?? 'advisory';
const envPath = resolve(envFile);
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

const checks = [];
const validPhases = new Set(['advisory', 'supabase-auth', 'maps', 'payments', 'storage', 'production']);

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
  'Run this script from C:\\dev\\massage-vn-workspace\\repo.',
);
addRecommended(
  'push',
  'PUSH_PROVIDER',
  hasValue('PUSH_PROVIDER'),
  'Use PUSH_PROVIDER=in_app_only locally; set PUSH_PROVIDER=onesignal before production push E2E.',
);
addRecommended(
  'push',
  'OneSignal credentials',
  allHaveValue(['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY']),
  'Choose OneSignal or another OS push provider and fill server-side credentials before production launch.',
);
addPhaseRequired(
  'push',
  'PUSH_PROVIDER=onesignal for OS push',
  hasExpectedValue('PUSH_PROVIDER', 'onesignal'),
  'Set PUSH_PROVIDER=onesignal before production-like OS push E2E.',
  ['production'],
);
addPhaseRequired(
  'push',
  'OneSignal credentials for OS push',
  allHaveValue(['ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY']),
  'Fill ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY before production-like OS push E2E.',
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
  'AUTH_BACKEND=supabase for Phone Auth',
  hasExpectedValue('AUTH_BACKEND', 'supabase'),
  'Set AUTH_BACKEND=supabase before Supabase Phone Auth E2E.',
  ['supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_URL for Phone Auth',
  isHttpsUrl('SUPABASE_URL'),
  'Set SUPABASE_URL=https://<project-ref>.supabase.co before AUTH_BACKEND=supabase E2E.',
  ['supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_ANON_KEY for Flutter OTP',
  hasValue('SUPABASE_ANON_KEY'),
  'Set SUPABASE_ANON_KEY from Supabase Project Settings > API.',
  ['supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_JWT_SECRET for API token verification',
  hasSecretLikeValue('SUPABASE_JWT_SECRET'),
  'Set SUPABASE_JWT_SECRET from Supabase Project Settings > API > JWT secret.',
  ['supabase-auth', 'production'],
);
addPhaseRequired(
  'supabase',
  'SUPABASE_SERVICE_ROLE_KEY for provider role sync',
  hasSecretLikeValue('SUPABASE_SERVICE_ROLE_KEY'),
  'Set SUPABASE_SERVICE_ROLE_KEY from Supabase Project Settings > API. Keep it server-side only.',
  ['supabase-auth', 'production'],
);

addRecommended(
  'sms',
  'SMS_PROVIDER',
  hasValue('SMS_PROVIDER'),
  'Use SMS_PROVIDER=dev locally; configure Vonage only when Supabase Phone Auth/SMS E2E starts.',
);
addRecommended(
  'sms',
  'SMS_API_URL',
  hasValue('SMS_API_URL'),
  'Deferred: fill the Vonage/Supabase Phone Auth SMS values before real OTP launch.',
);
addRecommended(
  'sms',
  'SMS_API_KEY',
  hasValue('SMS_API_KEY'),
  'Deferred: fill the Vonage/Supabase Phone Auth SMS secret before real OTP launch.',
);

addRecommended(
  'mobile-release',
  'Android customer/provider upload keystores',
  allHaveExistingPath(['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE']),
  'Create separate Android upload keystores, store them outside Git, and set valid local keystore paths before Play release.',
);
addPhaseRequired(
  'mobile-release',
  'Android customer/provider upload keystores',
  allHaveExistingPath(['ANDROID_CUSTOMER_UPLOAD_KEYSTORE', 'ANDROID_PROVIDER_UPLOAD_KEYSTORE']),
  'Fill ANDROID_CUSTOMER_UPLOAD_KEYSTORE and ANDROID_PROVIDER_UPLOAD_KEYSTORE with existing local files before production Android release.',
  ['production'],
);

addRecommended(
  'payments',
  'MoMo credentials',
  allHaveValue(['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']),
  'Fill MoMo merchant credentials before MoMo E2E.',
);
addPhaseRequired(
  'payments',
  'MoMo credentials',
  allHaveValue(['MOMO_PARTNER_CODE', 'MOMO_ACCESS_KEY', 'MOMO_SECRET_KEY']),
  'Fill MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, and MOMO_SECRET_KEY before payment E2E.',
  ['payments', 'production'],
);
addRecommended(
  'payments',
  'VNPay credentials',
  allHaveValue(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET']),
  'Fill VNPay merchant credentials before VNPay E2E.',
);
addPhaseRequired(
  'payments',
  'VNPay credentials',
  allHaveValue(['VNPAY_TMN_CODE', 'VNPAY_HASH_SECRET']),
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
  envFile: existsSync(envPath) ? envPath : null,
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

function storageConfigured() {
  return (
    allHaveValue([
      'STORAGE_PROVIDER',
      'S3_ENDPOINT',
      'S3_REGION',
      'S3_ACCESS_KEY',
      'S3_SECRET_KEY',
      'S3_PUBLIC_BASE_URL',
    ]) &&
    (hasValue('S3_BUCKET') || allHaveValue(['S3_PRIVATE_BUCKET', 'S3_PUBLIC_BUCKET']))
  );
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
