import { basename } from 'node:path';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv[2] ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const isTemplate = basename(envPath) === '.env.example' || process.argv.includes('--template');

const required = [
  'NODE_ENV',
  'API_PORT',
  'APP_DOMAIN',
  'PUBLIC_WEB_URL',
  'API_PUBLIC_URL',
  'ADMIN_PUBLIC_URL',
  'ADMIN_EMAIL',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_API_BASE_URL',
];

const recommended = [
  'SUPPORT_EMAIL',
  'STORAGE_PROVIDER',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_PUBLIC_BASE_URL',
  'SMS_PROVIDER',
  'SMS_API_URL',
  'SMS_API_KEY',
  'SMS_API_SECRET',
  'SMS_SENDER_ID',
  'MOMO_PARTNER_CODE',
  'MOMO_ACCESS_KEY',
  'MOMO_SECRET_KEY',
  'VNPAY_TMN_CODE',
  'VNPAY_HASH_SECRET',
  'VNPAY_GATEWAY_ENABLED',
  'VNPAY_PAYMENT_URL',
  'VNPAY_API_URL',
  'VNPAY_RETURN_URL',
  'VNPAY_SERVER_IP',
  'MAPTILER_API_KEY',
  'GEOAPIFY_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'SUPABASE_JWT_AUDIENCE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTH_BACKEND',
  'PUSH_PROVIDER',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_ADMIN_CREDENTIALS_HOST_PATH',
  'FIREBASE_ADMIN_CREDENTIALS_CONTAINER_PATH',
  'PROVIDER_SEARCH_RADIUS_METERS',
  'PROVIDER_STALE_AFTER_MINUTES',
  'PROVIDER_HIDE_AFTER_HOURS',
  'MATCHING_TRAVEL_BUFFER_MINUTES',
  'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES',
  'MATCHING_BACKUP_PROVIDER_RADIUS_METERS',
  'MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
  'MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT',
  'MATCHING_PREFERRED_ACCEPT_MODE',
  'MATCHING_BACKUP_OPEN_MODE',
  'WALLET_NEGATIVE_BALANCE_GATE',
  'CANCELLATION_AFTER_MATCH_POLICY',
  'NO_SHOW_PARTNER_REPORT_POLICY',
  'NOTIFICATION_PARTNER_ALERT_CHANNEL',
  'PROVIDER_AGREEMENT_VERSION',
  'ANDROID_CUSTOMER_UPLOAD_KEYSTORE',
  'ANDROID_PROVIDER_UPLOAD_KEYSTORE',
];

const insecureValues = new Set(['change-me', 'changeme', 'secret', 'password', '']);
const missingRequired = required.filter((key) => !env[key]);
const insecureRequired = required.filter((key) => insecureValues.has(String(env[key] ?? '').trim()));
const missingRecommended = recommended.filter((key) => !env[key]);
const previewSecretInvalid = env.NODE_ENV === 'production' &&
  String(env.SITE_CONTENT_PREVIEW_SECRET ?? '').length < 32;

const result = {
  ok: missingRequired.length === 0 &&
    (isTemplate || (insecureRequired.length === 0 && !previewSecretInvalid)),
  envFile: envFileExists ? envPath : null,
  mode: isTemplate ? 'template' : 'runtime',
  missingRequired,
  insecureRequired: isTemplate ? [] : insecureRequired,
  missingRecommended,
  previewSecret: isTemplate || !previewSecretInvalid ? 'valid-or-not-required' : 'missing-or-short',
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}
