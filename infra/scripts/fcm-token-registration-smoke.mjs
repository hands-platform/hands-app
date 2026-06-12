import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const apiBaseUrl = normalizeApiBaseUrl(envValue('API_BASE_URL') ?? 'http://localhost:3000/api');
const platform = normalizePlatform(envValue('FCM_SMOKE_PLATFORM') ?? 'android');
const otp = envValue('FCM_SMOKE_OTP') ?? envValue('DEV_OTP') ?? '123456';
const customerPhone = envValue('FCM_TOKEN_SMOKE_CUSTOMER_PHONE') ?? '+84900000001';
const providerPhone = envValue('FCM_TOKEN_SMOKE_PROVIDER_PHONE') ?? '+84900000002';
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        scope: 'config-only',
        contactsApi: false,
        contactsFcm: false,
        envFile: {
          path: envPath,
          exists: envFileExists,
        },
        apiBaseUrl,
        platform,
        actors: [
          { role: 'CUSTOMER', phone: customerPhone },
          { role: 'PROVIDER', phone: providerPhone },
        ],
        nextActions: [
          'Run npm.cmd run fcm:token-smoke when API/Docker are ready to verify customer/provider token registration.',
          'Then set FCM_SMOKE_DEVICE_TOKEN to a real app token and run npm.cmd run fcm:push-smoke -- --dry-run before live OS push.',
        ],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const health = await request('/health');
const ready = await request('/health/ready');
if (!health.ok || !ready.ok) {
  fail(`API is not ready: ${JSON.stringify({ health, ready })}`);
}

const startedAt = Date.now();
const results = [];
for (const actor of [
  { role: 'CUSTOMER', phone: customerPhone },
  { role: 'PROVIDER', phone: providerPhone },
]) {
  const auth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: actor.phone, otp, role: actor.role }),
  });
  const token = `hands-fcm-token-smoke-${actor.role.toLowerCase()}-${startedAt}`;
  const registeredDevice = await request('/notifications/device-token/register', {
    method: actor.role === 'CUSTOMER' ? 'PATCH' : 'POST',
    headers: { authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({ token, platform }),
  });

  if (
    registeredDevice.userId !== auth.user.id ||
    registeredDevice.platform !== platform ||
    registeredDevice.enabled !== true
  ) {
    fail(
      `${actor.role} device-token registration returned an unexpected payload: ${JSON.stringify(
        maskTokenFields(registeredDevice, token),
      )}`,
    );
  }

  const disabled = await request('/notifications/device-token', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({ token }),
  });
  if (!disabled.ok || disabled.disabled < 1) {
    fail(`${actor.role} device-token disable failed: ${JSON.stringify(disabled)}`);
  }

  results.push({
    role: actor.role,
    platform: registeredDevice.platform,
    registered: true,
    disabled: disabled.disabled,
  });
}

console.log(
  JSON.stringify(
    {
      ok: true,
      apiBaseUrl,
      platform,
      results,
    },
    null,
    2,
  ),
);

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function envValue(key) {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function normalizeApiBaseUrl(value) {
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    fail(`Unsupported API_BASE_URL=${value}. Use an absolute http(s) URL such as http://localhost:3000/api.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`Unsupported API_BASE_URL protocol=${url.protocol}. Use http or https.`);
  }

  return url.toString().replace(/\/$/, '');
}

function normalizePlatform(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'android' && normalized !== 'ios') {
    fail(`Unsupported FCM_SMOKE_PLATFORM=${value}. Use android or ios.`);
  }
  return normalized;
}

function maskTokenFields(value, token) {
  return JSON.parse(JSON.stringify(value).replaceAll(token, '<TOKEN_REGISTRATION_SMOKE_TOKEN>'));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
