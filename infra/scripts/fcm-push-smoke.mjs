import { loadMergedEnv } from './lib/env-file.mjs';
import {
  envValue,
  normalizeApiBaseUrl,
  normalizePlatform,
  positiveIntegerEnv,
} from './lib/fcm-smoke-config.mjs';
import {
  firebaseAdminCredentialsConfigured,
  firebaseApplicationCredentialsConfigured,
  firebaseApplicationCredentialsEnvKey,
  firebaseServiceAccountJsonConfigured,
  firebaseServiceAccountJsonEnvKey,
} from './lib/firebase-admin-credentials.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const deviceToken = envValue(env, 'FCM_SMOKE_DEVICE_TOKEN');
const apiBaseUrl = normalizeApiBaseUrl(envValue(env, 'API_BASE_URL') ?? 'http://localhost:3000/api', fail);
const platform = normalizePlatform(envValue(env, 'FCM_SMOKE_PLATFORM') ?? 'android', fail);
const role = normalizeRole(envValue(env, 'FCM_SMOKE_ROLE') ?? 'CUSTOMER');
const phone = envValue(env, 'FCM_SMOKE_PHONE') ?? (role === 'PROVIDER' ? '+84900000002' : '+84900000001');
const otp = envValue(env, 'FCM_SMOKE_OTP') ?? envValue(env, 'DEV_OTP') ?? '123456';
const adminPhone = envValue(env, 'FCM_SMOKE_ADMIN_PHONE') ?? envValue(env, 'ADMIN_DEMO_PHONE') ?? '+84900000099';
const adminOtp = envValue(env, 'FCM_SMOKE_ADMIN_OTP') ?? envValue(env, 'ADMIN_DEMO_OTP') ?? '123456';
const requestedNotificationId = envValue(env, 'FCM_SMOKE_NOTIFICATION_ID');
const expectedStatus = (envValue(env, 'FCM_SMOKE_EXPECT_STATUS') ?? 'ANY').toUpperCase();
const expectedProvider = (envValue(env, 'FCM_SMOKE_EXPECT_PROVIDER') ?? 'FCM').toUpperCase();
const timeoutMs = positiveIntegerEnv(env, 'FCM_SMOKE_TIMEOUT_MS', 30_000, fail);
const pollIntervalMs = positiveIntegerEnv(env, 'FCM_SMOKE_POLL_INTERVAL_MS', 1_000, fail);
const useRegisteredDevice =
  process.argv.includes('--use-registered-device') ||
  booleanEnv(envValue(env, 'FCM_SMOKE_USE_REGISTERED_DEVICE'), false, 'FCM_SMOKE_USE_REGISTERED_DEVICE');
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
        useRegisteredDevice,
        liveTokenRequirement: liveTokenRequirement(),
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

if (!deviceToken && !useRegisteredDevice) {
  fail(
    `FCM_SMOKE_DEVICE_TOKEN is required unless FCM_SMOKE_USE_REGISTERED_DEVICE=true. Use a real ${role} ${platform} app token for ${phone}, or reuse an enabled device already registered by that same app session.`,
  );
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

const registeredDevicePreflight =
  useRegisteredDevice && !deviceToken
    ? await findRegisteredDevicePreflight(adminAuth.accessToken)
    : null;
if (registeredDevicePreflight && registeredDevicePreflight.enabledCount === 0) {
  fail(
    `No enabled registered push device is available for the selected smoke app session: ${JSON.stringify(
      registeredDevicePreflight,
    )}`,
  );
}

const registeredDevice = deviceToken
  ? await request('/notifications/device-token/register', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${auth.accessToken}` },
      body: JSON.stringify({ token: deviceToken, platform }),
    })
  : null;

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
      useRegisteredDevice,
      beforeDeliveryCount,
      deliveryCount,
      hint: useRegisteredDevice
        ? 'The selected user may not have an enabled push device registered by the current app session.'
        : undefined,
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
      registeredDevice: registeredDevice
        ? {
            id: registeredDevice.id,
            platform: registeredDevice.platform,
            enabled: registeredDevice.enabled,
          }
        : null,
      reusedRegisteredDevice: !registeredDevice,
      registeredDevicePreflight,
      pushReadiness: pushCheck
        ? {
            status: pushCheck.status,
            detail: pushCheck.detail,
            operatorAction: pushCheck.operatorAction ?? null,
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

async function findRegisteredDevicePreflight(accessToken) {
  const users = await request('/admin/users', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const smokeUser = Array.isArray(users)
    ? users.find((user) => user.phone === phone && userHasRole(user, role))
    : null;
  const matchingDevices = (smokeUser?.pushDevices ?? []).filter(
    (device) => device.platform === platform && deviceRoleMatches(device, role),
  );
  const enabledDevices = matchingDevices.filter((device) => device.enabled);

  return {
    userId: smokeUser?.id ?? null,
    role,
    phone,
    platform,
    matchingCount: matchingDevices.length,
    enabledCount: enabledDevices.length,
    latestDevice: summarizePushDevice(matchingDevices[0]),
  };
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

function userHasRole(user, expectedRole) {
  return (user.roles ?? []).map((item) => String(item).toUpperCase()).includes(expectedRole);
}

function deviceRoleMatches(device, expectedRole) {
  return !device.role || String(device.role).toUpperCase() === expectedRole;
}

function summarizePushDevice(device) {
  if (!device) {
    return null;
  }
  return {
    id: device.id ?? null,
    role: device.role ?? null,
    platform: device.platform ?? null,
    enabled: Boolean(device.enabled),
    lastSeenAt: device.lastSeenAt ?? null,
    updatedAt: device.updatedAt ?? null,
  };
}

function normalizeRole(value) {
  const normalized = value.trim().toUpperCase();
  if (normalized !== 'CUSTOMER' && normalized !== 'PROVIDER') {
    fail(`Unsupported FCM_SMOKE_ROLE=${value}. Use CUSTOMER or PROVIDER.`);
  }
  return normalized;
}

function booleanEnv(value, fallback, key) {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  fail(`Unsupported ${key}=${value}. Use true or false.`);
}

function hasEnvValue(key) {
  return Boolean(envValue(env, key));
}

function hasExpectedEnvValue(key, expected) {
  return (envValue(env, key) ?? '').toLowerCase() === expected.toLowerCase();
}

function firebaseAdminConfigured() {
  return firebaseAdminCredentialsConfigured(env);
}

function liveTokenRequirement() {
  return {
    tokenEnv: 'FCM_SMOKE_DEVICE_TOKEN',
    reuseRegisteredDeviceEnv: 'FCM_SMOKE_USE_REGISTERED_DEVICE',
    roleEnv: 'FCM_SMOKE_ROLE',
    phoneEnv: 'FCM_SMOKE_PHONE',
    platformEnv: 'FCM_SMOKE_PLATFORM',
    expectedRole: role,
    expectedPhone: phone,
    expectedPlatform: platform,
    useRegisteredDevice,
    source: `current ${role.toLowerCase()} ${platform} app session`,
    mustMatchAuthenticatedUser: true,
    note: useRegisteredDevice
      ? 'The selected app session must already have an enabled PushDevice registered through the API.'
      : 'Use a token from the same role, phone, and platform selected for this smoke run.',
  };
}

function dryRunNextActions() {
  const actions = [
    'This dry-run checks merged config only; it does not contact the API or FCM.',
    'Run npm.cmd run fcm:credentials-check to verify Firebase Admin credential file contents.',
    'Run npm.cmd run docker:contract to verify Docker service URLs and Firebase Admin credential mount paths.',
    'Run npm.cmd run external:check:push before the live FCM smoke.',
    'Run npm.cmd run fcm:token-smoke before live push to verify customer/provider token registration.',
  ];

  if (!hasExpectedEnvValue('PUSH_PROVIDER', 'fcm')) {
    actions.push('Set PUSH_PROVIDER=fcm for OS push E2E.');
  }

  if (!firebaseAdminConfigured()) {
    actions.push(firebaseAdminCredentialAction());
  }

  if (!deviceToken && useRegisteredDevice) {
    actions.push(
      `Confirm the current ${role} ${platform} app session for ${phone} has registered an enabled push device, then run live fcm:push-smoke.`,
    );
  }

  if (!deviceToken && !useRegisteredDevice) {
    actions.push(
      `Set FCM_SMOKE_DEVICE_TOKEN to a real token from the current ${role} ${platform} app session for ${phone}, or set FCM_SMOKE_USE_REGISTERED_DEVICE=true after that app session registers its token through the API. Change FCM_SMOKE_ROLE, FCM_SMOKE_PHONE, or FCM_SMOKE_PLATFORM if testing a different app session.`,
    );
  }

  actions.push('Run npm.cmd run fcm:push-smoke without --dry-run when API/Docker are ready.');
  return actions;
}

function firebaseAdminCredentialAction() {
  if (
    hasEnvValue(firebaseServiceAccountJsonEnvKey) &&
    !firebaseServiceAccountJsonConfigured(envValue(env, firebaseServiceAccountJsonEnvKey))
  ) {
    return 'Fill FIREBASE_SERVICE_ACCOUNT_JSON with a valid Firebase service account JSON or base64 payload.';
  }

  if (
    hasEnvValue(firebaseApplicationCredentialsEnvKey) &&
    !firebaseApplicationCredentialsConfigured(envValue(env, firebaseApplicationCredentialsEnvKey))
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
