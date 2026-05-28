import { readFileSync, existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const envFile = process.argv[2] ?? '.env';
const envPath = resolve(envFile);
const isTemplate = basename(envPath) === '.env.example' || process.argv.includes('--template');
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };

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
  'SMS_SENDER_ID',
  'MOMO_PARTNER_CODE',
  'MOMO_ACCESS_KEY',
  'MOMO_SECRET_KEY',
  'VNPAY_TMN_CODE',
  'VNPAY_HASH_SECRET',
  'MAPTILER_API_KEY',
  'GEOAPIFY_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_JWT_SECRET',
  'SUPABASE_JWT_AUDIENCE',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTH_BACKEND',
  'PUSH_PROVIDER',
  'ONESIGNAL_APP_ID',
  'ONESIGNAL_REST_API_KEY',
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

const result = {
  ok: missingRequired.length === 0 && (isTemplate || insecureRequired.length === 0),
  envFile: existsSync(envPath) ? envPath : null,
  mode: isTemplate ? 'template' : 'runtime',
  missingRequired,
  insecureRequired: isTemplate ? [] : insecureRequired,
  missingRecommended,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
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
