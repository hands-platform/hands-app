import { loadMergedEnv } from './lib/env-file.mjs';
import {
  firebaseAdminCredentialsConfigured,
  firebaseApplicationCredentialsConfigured,
  firebaseApplicationCredentialsEnvKey,
  firebaseServiceAccountJsonConfigured,
  firebaseServiceAccountJsonEnvKey,
} from './lib/firebase-admin-credentials.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const deviceToken = envValue('FCM_SMOKE_DEVICE_TOKEN');
const apiBaseUrl = normalizeApiBaseUrl(envValue('API_BASE_URL') ?? 'http://localhost:3000/api');
const platform = normalizePlatform(envValue('FCM_SMOKE_PLATFORM') ?? 'android');
const role = normalizeRole(envValue('FCM_SMOKE_ROLE') ?? 'CUSTOMER');
const phone = envValue('FCM_SMOKE_PHONE') ?? (role === 'PROVIDER' ? '+84900000002' : '+84900000001');
const otp = envValue('FCM_SMOKE_OTP') ?? envValue('DEV_OTP') ?? '123456';
const adminPhone = envValue('FCM_SMOKE_ADMIN_PHONE') ?? envValue('ADMIN_DEMO_PHONE') ?? '+84900000099';
const adminOtp = envValue('FCM_SMOKE_ADMIN_OTP') ?? envValue('ADMIN_DEMO_OTP') ?? '123456';
const requestedNotificationId = envValue('FCM_SMOKE_NOTIFICATION_ID');
const expectedStatus = (envValue('FCM_SMOKE_EXPECT_STATUS') ?? 'ANY').toUpperCase();
const expectedProvider = (envValue('FCM_SMOKE_EXPECT_PROVIDER') ?? 'FCM').toUpperCase();
const timeoutMs = positiveIntegerEnv('FCM_SMOKE_TIMEOUT_MS', 30_000);
const pollIntervalMs = positiveIntegerEnv('FCM_SMOKE_POLL_INTERVAL_MS', 1_000);
const dryRun = process.argv.includes('--dry-run');

if (!['ANY', 'SENT', 'FAILED', 'SKIPPED'].includes(expectedStatus)) {
  fail(`Unsupported FCM_SMOKE_EXPECT_STATUS=${expectedStatus}. Use ANY, SENT, FAILED, or SKIPPED.`);
}

if (!['ANY', 'FCM', 'IN_APP_ONLY'].includes(expectedProvider)) {
  fail(`Unsupported FCM_SMOKE_EXPECT_PROVIDER=${expectedProvider}. Use ANY, FCM, or IN_APP_ONLY.`);
}

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
        role,
        phone,
        platform,
        hasDeviceToken: Boolean(deviceToken),
        pushReadiness: {
          hasPushProviderFcm: hasExpectedEnvValue('PUSH_PROVIDER', 'fcm'),
          hasFirebaseAdminCredentials: firebaseAdminConfigured(),
        },
        requestedNotificationId: requestedNotificationId || null,
        expectedProvider,
        expectedStatus,
        nextActions: dryRunNextActions(),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!deviceToken) {
  fail('FCM_SMOKE_DEVICE_TOKEN is required. Use a real Android/iOS FCM token from the app for OS push E2E.');
}

const health = await request('/health');
const ready = await request('/health/ready');
if (!health.ok || !ready.ok) {
  fail(`API is not ready: ${JSON.stringify({ health, ready })}`);
}

const external = await request('/health/external');
const pushCheck = external.checks?.find((check) => check.category === 'push');

const auth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone, otp, role }),
});
const adminAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: adminPhone, otp: adminOtp, role: 'ADMIN' }),
});

const registeredDevice = await request('/notifications/device-token/register', {
  method: 'PATCH',
  headers: { authorization: `Bearer ${auth.accessToken}` },
  body: JSON.stringify({ token: deviceToken, platform }),
});

const notificationId = requestedNotificationId ?? (await findLatestUserNotificationId(auth.accessToken));
if (!notificationId) {
  fail(
    'No notification exists for the selected smoke user. Run a booking/chat flow first, or set FCM_SMOKE_NOTIFICATION_ID to an existing notification.',
  );
}

const before = await findAdminNotification(adminAuth.accessToken, notificationId);
const beforeDeliveries = before?.deliveries ?? [];
const beforeDeliveryCount = beforeDeliveries.length;
const beforeDeliveryIds = new Set(beforeDeliveries.map((delivery) => delivery.id).filter(Boolean));
const beforeLatestAttemptedAt = latestDeliveryTime(beforeDeliveries);
await request(`/admin/notifications/${notificationId}/retry`, {
  method: 'POST',
  headers: { authorization: `Bearer ${adminAuth.accessToken}` },
  body: JSON.stringify({}),
});

const deadline = Date.now() + timeoutMs;
let after = before;
while (Date.now() < deadline) {
  await sleep(pollIntervalMs);
  after = await findAdminNotification(adminAuth.accessToken, notificationId);
  if ((after?.deliveries?.length ?? 0) > beforeDeliveryCount) {
    break;
  }
}

const deliveryCount = after?.deliveries?.length ?? 0;
if (deliveryCount <= beforeDeliveryCount) {
  fail(
    `Notification retry did not record a delivery within ${timeoutMs}ms: ${JSON.stringify({
      notificationId,
      beforeDeliveryCount,
      deliveryCount,
    })}`,
  );
}

const latestDelivery = newDelivery(after.deliveries ?? [], {
  beforeDeliveryCount,
  beforeDeliveryIds,
  beforeLatestAttemptedAt,
});
if (!latestDelivery) {
  fail(
    `Notification retry recorded a delivery count increase but no delivery details were returned: ${JSON.stringify(
      {
        notificationId,
        beforeDeliveryCount,
        deliveryCount,
      },
    )}`,
  );
}
const provider = String(latestDelivery.provider ?? '').toUpperCase();
const status = String(latestDelivery.status ?? '').toUpperCase();
const failureCode = latestDelivery.failureCode ?? latestDelivery.response?.failureCode ?? null;
if (expectedProvider !== 'ANY' && provider !== expectedProvider) {
  fail(
    `Unexpected delivery provider: ${JSON.stringify({
      expectedProvider,
      provider,
      status,
      notificationId,
    })}`,
  );
}
if (expectedStatus !== 'ANY' && status !== expectedStatus) {
  fail(
    `Unexpected delivery status: ${JSON.stringify({
      expectedStatus,
      provider,
      status,
      failureCode,
      notificationId,
    })}`,
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      apiBaseUrl,
      role,
      phone,
      notificationId,
      registeredDevice: {
        id: registeredDevice.id,
        platform: registeredDevice.platform,
        enabled: registeredDevice.enabled,
      },
      pushReadiness: pushCheck
        ? {
            status: pushCheck.status,
            message: pushCheck.message,
          }
        : null,
      beforeDeliveryCount,
      deliveryCount,
      latestDelivery: {
        id: latestDelivery.id,
        provider,
        status,
        failureCode,
        pushDeviceId: latestDelivery.pushDeviceId ?? null,
      },
    },
    null,
    2,
  ),
);

async function findLatestUserNotificationId(accessToken) {
  const notifications = await request('/notifications', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(notifications) ? notifications[0]?.id : null;
}

async function findAdminNotification(accessToken, notificationId) {
  const notifications = await request('/admin/notifications', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(notifications)
    ? notifications.find((notification) => notification.id === notificationId)
    : null;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      maskDeviceToken(
        `${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
      ),
    );
  }
  return body;
}

function normalizeRole(value) {
  const normalized = value.trim().toUpperCase();
  if (normalized !== 'CUSTOMER' && normalized !== 'PROVIDER') {
    fail(`Unsupported FCM_SMOKE_ROLE=${value}. Use CUSTOMER or PROVIDER.`);
  }
  return normalized;
}

function normalizePlatform(value) {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'android' && normalized !== 'ios') {
    fail(`Unsupported FCM_SMOKE_PLATFORM=${value}. Use android or ios.`);
  }
  return normalized;
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

function positiveIntegerEnv(key, fallback) {
  const rawValue = envValue(key);
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`Unsupported ${key}=${rawValue}. Use a positive integer in milliseconds.`);
  }

  return value;
}

function envValue(key) {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function hasEnvValue(key) {
  return Boolean(envValue(key));
}

function hasExpectedEnvValue(key, expected) {
  return (envValue(key) ?? '').toLowerCase() === expected.toLowerCase();
}

function firebaseAdminConfigured() {
  return firebaseAdminCredentialsConfigured(env);
}

function dryRunNextActions() {
  const actions = [
    'This dry-run checks merged config only; it does not contact the API or FCM.',
    'Run npm.cmd run external:check:push before the live FCM smoke.',
  ];

  if (!hasExpectedEnvValue('PUSH_PROVIDER', 'fcm')) {
    actions.push('Set PUSH_PROVIDER=fcm for OS push E2E.');
  }

  if (!firebaseAdminConfigured()) {
    actions.push(firebaseAdminCredentialAction());
  }

  if (!deviceToken) {
    actions.push('Set FCM_SMOKE_DEVICE_TOKEN to a real Android/iOS app FCM token.');
  }

  actions.push('Run npm.cmd run fcm:push-smoke without --dry-run when API/Docker are ready.');
  return actions;
}

function firebaseAdminCredentialAction() {
  if (
    hasEnvValue(firebaseServiceAccountJsonEnvKey) &&
    !firebaseServiceAccountJsonConfigured(envValue(firebaseServiceAccountJsonEnvKey))
  ) {
    return 'Fill FIREBASE_SERVICE_ACCOUNT_JSON with a valid Firebase service account JSON or base64 payload.';
  }

  if (
    hasEnvValue(firebaseApplicationCredentialsEnvKey) &&
    !firebaseApplicationCredentialsConfigured(envValue(firebaseApplicationCredentialsEnvKey))
  ) {
    return 'Point GOOGLE_APPLICATION_CREDENTIALS to an existing valid service account JSON file.';
  }

  return 'Configure server-side Firebase Admin credentials for FCM.';
}

function maskDeviceToken(value) {
  return deviceToken ? value.replaceAll(deviceToken, '<FCM_SMOKE_DEVICE_TOKEN>') : value;
}

function newDelivery(deliveries, { beforeDeliveryCount, beforeDeliveryIds, beforeLatestAttemptedAt }) {
  return (
    deliveries.find((delivery) => delivery.id && !beforeDeliveryIds.has(delivery.id)) ??
    newestDelivery(deliveries.filter((delivery) => deliveryTime(delivery) > beforeLatestAttemptedAt)) ??
    newestDelivery(deliveries.slice(0, Math.max(0, deliveries.length - beforeDeliveryCount))) ??
    newestDelivery(deliveries)
  );
}

function newestDelivery(deliveries) {
  return deliveries
    .filter(Boolean)
    .slice()
    .sort((left, right) => deliveryTime(right) - deliveryTime(left))[0];
}

function latestDeliveryTime(deliveries) {
  return deliveries.reduce((latest, delivery) => Math.max(latest, deliveryTime(delivery)), -Infinity);
}

function deliveryTime(delivery) {
  const time = Date.parse(delivery?.attemptedAt ?? '');
  return Number.isFinite(time) ? time : 0;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: maskDeviceToken(message) }, null, 2));
  process.exit(1);
}
