import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

const repoRoot = resolve(import.meta.dirname, '..', '..');
const partnerAlertTypes = readPartnerAlertTypes();
const partnerAlertPolicyKey = 'notification.partner_alert_channel';
const partnerAlertFcmValues = new Set(['FCM_FOR_ALL_BOOKINGS', 'ONESIGNAL_FOR_ALL_BOOKINGS']);
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const deviceToken = envValue(env, 'FCM_SMOKE_DEVICE_TOKEN');
const apiBaseUrl = normalizeApiBaseUrl(envValue(env, 'API_BASE_URL') ?? 'http://localhost:3000/api', fail);
const platform = normalizePlatform(envValue(env, 'FCM_SMOKE_PLATFORM') ?? 'android', fail);
const role = normalizeRole(envValue(env, 'FCM_SMOKE_ROLE') ?? 'CUSTOMER');
const phone = envValue(env, 'FCM_SMOKE_PHONE') ?? (role === 'PROVIDER' ? '+84900000002' : '+84900000001');
const otp = envValue(env, 'FCM_SMOKE_OTP') ?? envValue(env, 'DEV_OTP') ?? '123456';
const adminPhone =
  envValue(env, 'FCM_SMOKE_ADMIN_PHONE') ?? envValue(env, 'ADMIN_DEMO_PHONE') ?? '+84900000099';
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
const preflight = process.argv.includes('--preflight');

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

if (!deviceToken && !useRegisteredDevice && !preflight) {
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

const registeredDevicePreflight = await findRegisteredDevicePreflight(adminAuth.accessToken);
const adminNotifications = await listAdminNotifications(adminAuth.accessToken);
const notificationId = requestedNotificationId ?? (await findLatestUserNotificationId(auth.accessToken));
const notificationPreflight = notificationId
  ? summarizeNotification(findNotification(adminNotifications, notificationId))
  : null;
const partnerAlertPolicyPreflight = await findPartnerAlertPolicyPreflight(
  adminAuth.accessToken,
  notificationPreflight,
);
const alternativeNotificationPreflights = findAlternativeNotificationPreflights(
  adminNotifications,
  notificationId,
);

if (preflight) {
  const blockers = preflightBlockers({
    notificationId,
    notificationPreflight,
    registeredDevicePreflight,
    partnerAlertPolicyPreflight,
  });
  const blockedAlternativeNotificationPreflights = blockers.includes('PARTNER_ALERT_POLICY_PROVIDER_MISMATCH')
    ? alternativeNotificationPreflights
    : [];
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'preflight',
        scope: 'api-only',
        contactsApi: true,
        contactsFcm: false,
        apiBaseUrl,
        role,
        phone,
        platform,
        hasDeviceToken: Boolean(deviceToken),
        useRegisteredDevice,
        pushReadiness: pushReadinessOutput(pushCheck),
        registeredDevicePreflight,
        notificationPreflight,
        partnerAlertPolicyPreflight,
        alternativeNotificationPreflights: blockedAlternativeNotificationPreflights,
        liveReady: blockers.length === 0,
        blockers,
        nextActions: preflightNextActions(blockers, blockedAlternativeNotificationPreflights),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (useRegisteredDevice && !deviceToken && registeredDevicePreflight.enabledCount === 0) {
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

if (!notificationId) {
  fail(
    'No notification exists for the selected smoke user. Run a booking/chat flow first, or set FCM_SMOKE_NOTIFICATION_ID to an existing notification.',
  );
}
if (notificationId && !notificationPreflight) {
  fail('Selected notification was not found in the Admin notifications queue.');
}

const partnerAlertPolicyBlocker = expectedProviderBlocker(partnerAlertPolicyPreflight);
if (partnerAlertPolicyBlocker) {
  fail(
    `Selected notification is routed to ${partnerAlertPolicyPreflight.resolvedProvider} by ${partnerAlertPolicyKey}, but FCM_SMOKE_EXPECT_PROVIDER=${expectedProvider}. ${alternativeNotificationHint(
      alternativeNotificationPreflights,
    )}`,
  );
}

const before = findNotification(adminNotifications, notificationId);
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
      pushReadiness: pushReadinessOutput(pushCheck),
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
  return findNotification(await listAdminNotifications(accessToken), notificationId);
}

async function listAdminNotifications(accessToken) {
  const notifications = await request('/admin/notifications', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(notifications) ? notifications : [];
}

function findNotification(notifications, notificationId) {
  return notifications.find((notification) => notification.id === notificationId) ?? null;
}

function findAlternativeNotificationPreflights(notifications, selectedNotificationId) {
  if (expectedProvider !== 'FCM') {
    return [];
  }

  return notifications
    .filter((notification) => notification.id !== selectedNotificationId)
    .filter((notification) => notificationBelongsToSmokeUser(notification))
    .filter((notification) => !partnerAlertTypes.has(notification.type))
    .map(summarizeNotification)
    .slice(0, 3);
}

function notificationBelongsToSmokeUser(notification) {
  return notification.user?.phone === phone && userHasRole(notification.user, role);
}

async function findPartnerAlertPolicyPreflight(accessToken, notification) {
  if (!notification) {
    return null;
  }

  const applies = partnerAlertTypes.has(notification.type);
  if (!applies) {
    return {
      key: partnerAlertPolicyKey,
      notificationType: notification.type,
      applies,
      value: null,
      resolvedProvider: null,
      expectedProvider,
      matchesExpectedProvider: true,
    };
  }

  const settings = await request('/admin/operational-policy', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const setting = Array.isArray(settings)
    ? settings.find((item) => item.key === partnerAlertPolicyKey)
    : null;
  const value = setting?.value ?? 'IN_APP_WITH_PUSH_LATER';
  const resolvedProvider = partnerAlertFcmValues.has(String(value)) ? 'FCM' : 'IN_APP_ONLY';

  return {
    key: partnerAlertPolicyKey,
    notificationType: notification.type,
    applies,
    value,
    resolvedProvider,
    expectedProvider,
    matchesExpectedProvider: !expectedProviderBlocker({ applies, resolvedProvider }),
  };
}

async function findRegisteredDevicePreflight(accessToken) {
  const users = await request('/admin/users', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  const smokeUser = Array.isArray(users)
    ? users.find((user) => user.phone === phone && userHasRole(user, role))
    : null;
  const detail = smokeUser ? await findSmokeUserDetail(accessToken, smokeUser) : null;
  const deviceSource = detail ? 'admin-detail' : 'admin-users-summary';
  const devices = detail?.user?.pushDevices ?? smokeUser?.pushDevices ?? [];
  const matchingDevices = devices.filter(
    (device) => device.platform === platform && deviceRoleMatches(device, role),
  );
  const enabledDevices = matchingDevices.filter((device) => device.enabled);

  return {
    userId: smokeUser?.id ?? null,
    profileId: smokeProfileId(smokeUser),
    role,
    phone,
    platform,
    deviceSource,
    matchingCount: matchingDevices.length,
    enabledCount: enabledDevices.length,
    latestDevice: summarizePushDevice(matchingDevices[0]),
    latestEnabledDevice: summarizePushDevice(enabledDevices[0]),
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

async function findSmokeUserDetail(accessToken, user) {
  const profileId = smokeProfileId(user);
  if (!profileId) {
    return null;
  }

  const path = role === 'PROVIDER' ? `/admin/partners/${profileId}` : `/admin/customers/${profileId}`;
  return request(path, {
    headers: { authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
}

function smokeProfileId(user) {
  return role === 'PROVIDER' ? user.providerProfile?.id : user.customerProfile?.id;
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

function summarizeNotification(notification) {
  if (!notification) {
    return null;
  }
  return {
    id: notification.id,
    type: notification.type,
    createdAt: notification.createdAt,
    deliveryCount: (notification.deliveries ?? []).length,
    latestDelivery: summarizeDelivery((notification.deliveries ?? [])[0]),
  };
}

function summarizeDelivery(delivery) {
  if (!delivery) {
    return null;
  }
  return {
    id: delivery.id ?? null,
    provider: delivery.provider ?? null,
    status: delivery.status ?? null,
    attemptedAt: delivery.attemptedAt ?? null,
    pushDeviceId: delivery.pushDeviceId ?? null,
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

function readPartnerAlertTypes() {
  const source = readFileSync(
    resolve(repoRoot, 'packages/shared-types/src/index.ts'),
    'utf8',
  );
  const match = source.match(/const\s+PARTNER_ALERT_EVENTS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!match) {
    throw new Error('Unable to read partner alert notification types from shared-types.');
  }
  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]));
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
    'Run npm.cmd run fcm:token-smoke before live FCM push to verify customer/Partner token registration.',
  ];

  if (!hasExpectedEnvValue('PUSH_PROVIDER', 'fcm')) {
    actions.push('Set PUSH_PROVIDER=fcm for FCM push E2E.');
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

function preflightBlockers({
  notificationId,
  notificationPreflight,
  registeredDevicePreflight,
  partnerAlertPolicyPreflight,
}) {
  const blockers = [];

  if (!notificationId) {
    blockers.push('NO_NOTIFICATION');
  }
  if (notificationId && !notificationPreflight) {
    blockers.push('NOTIFICATION_NOT_FOUND');
  }

  if (!deviceToken && !useRegisteredDevice) {
    blockers.push('NO_DEVICE_TOKEN_OR_REUSE_MODE');
  }

  if (useRegisteredDevice && registeredDevicePreflight.enabledCount === 0) {
    blockers.push('NO_ENABLED_REGISTERED_DEVICE');
  }

  const partnerAlertBlocker = expectedProviderBlocker(partnerAlertPolicyPreflight);
  if (partnerAlertBlocker) {
    blockers.push(partnerAlertBlocker);
  }

  return blockers;
}

function expectedProviderBlocker(partnerAlertPolicyPreflight) {
  if (
    !partnerAlertPolicyPreflight?.applies ||
    expectedProvider === 'ANY' ||
    partnerAlertPolicyPreflight.resolvedProvider === expectedProvider
  ) {
    return null;
  }

  return 'PARTNER_ALERT_POLICY_PROVIDER_MISMATCH';
}

function preflightNextActions(blockers, alternativeNotificationPreflights = []) {
  if (blockers.length === 0) {
    return ['Run npm.cmd run fcm:push-smoke without --preflight when ready to send a live FCM retry.'];
  }

  const actions = [];
  if (blockers.includes('NO_NOTIFICATION')) {
    actions.push(
      'Create a notification for the selected smoke user through a booking/chat flow, or set FCM_SMOKE_NOTIFICATION_ID to an existing notification.',
    );
  }
  if (blockers.includes('NOTIFICATION_NOT_FOUND')) {
    actions.push(
      'Set FCM_SMOKE_NOTIFICATION_ID to a notification that is visible in the Admin notifications queue.',
    );
  }
  if (blockers.includes('NO_DEVICE_TOKEN_OR_REUSE_MODE')) {
    actions.push(
      'Set FCM_SMOKE_DEVICE_TOKEN to a real token from the selected role/phone/platform, or set FCM_SMOKE_USE_REGISTERED_DEVICE=true after that same app session registers an enabled FCM device.',
    );
  }
  if (blockers.includes('NO_ENABLED_REGISTERED_DEVICE')) {
    actions.push(
      `Open the current ${role} ${platform} app session for ${phone} and let it register an enabled FCM token through the API.`,
    );
  }
  if (blockers.includes('PARTNER_ALERT_POLICY_PROVIDER_MISMATCH')) {
    actions.push(alternativeNotificationHint(alternativeNotificationPreflights));
  }
  return actions;
}

function pushReadinessOutput(pushCheck) {
  if (!pushCheck) {
    return null;
  }

  return {
    status: pushCheck.status,
    detail: fcmSmokeDisplayText(pushCheck.detail),
    operatorAction: pushCheck.operatorAction ? fcmSmokeDisplayText(pushCheck.operatorAction) : null,
  };
}

function fcmSmokeDisplayText(value) {
  return String(value)
    .replace(/\bAndroid\/iOS OS push\b/g, 'Android/iOS FCM push')
    .replace(/\bOS push\b/g, 'FCM push')
    .replace(/\bpush readiness\b/g, 'FCM push readiness')
    .replace(/\bcustomer\/provider\b/g, 'customer/Partner')
    .replace(/\bCustomer\/provider\b/g, 'Customer/Partner');
}

function alternativeNotificationHint(alternativeNotificationPreflights) {
  const fallback =
    'Set FCM_SMOKE_NOTIFICATION_ID to a non-Partner-alert notification, set FCM_SMOKE_EXPECT_PROVIDER to the policy-routed provider, or intentionally update the policy before live FCM retry.';
  const [firstAlternative] = alternativeNotificationPreflights;
  if (!firstAlternative?.id) {
    return `The selected notification is a Partner alert controlled by ${partnerAlertPolicyKey}. ${fallback}`;
  }

  return `The selected notification is a Partner alert controlled by ${partnerAlertPolicyKey}. Set FCM_SMOKE_NOTIFICATION_ID=${firstAlternative.id} to use the latest non-Partner-alert ${firstAlternative.type} notification for this same role/phone, or intentionally update the policy before live FCM retry.`;
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
