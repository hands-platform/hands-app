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
import {
  firebaseProjectAlignment,
  firebaseProjectAlignmentActions,
  firebaseProjectAlignmentInvalidKeys,
  firebaseProjectAlignmentIssueLabel,
} from './lib/firebase-project-alignment.mjs';

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
const projectAlignment = firebaseProjectAlignment(env, { repoRoot });
const fcmProjectAlignmentBlockerCodes = new Set([
  ...Object.values(firebaseProjectAlignmentInvalidKeys),
  'FIREBASE_PROJECT_ALIGNMENT_NOT_CHECKED',
]);
const fcmSmokePreflightBlockerCopy = {
  NO_NOTIFICATION: {
    label: 'No notification is available for the selected smoke user',
    action:
      'Create a notification for the selected smoke user through a booking/chat flow, or set FCM_SMOKE_NOTIFICATION_ID to an existing notification.',
  },
  NOTIFICATION_NOT_FOUND: {
    label: 'Selected notification is not visible in the Admin notifications queue',
    action:
      'Set FCM_SMOKE_NOTIFICATION_ID to a notification that is visible in the Admin notifications queue.',
  },
  NO_DEVICE_TOKEN_OR_REUSE_MODE: {
    label: 'No live device token or registered-device reuse mode selected',
    action:
      'Set FCM_SMOKE_DEVICE_TOKEN to a real token from the selected role/phone/platform, or set FCM_SMOKE_USE_REGISTERED_DEVICE=true after that same app session registers an enabled FCM device.',
  },
  NO_ENABLED_REGISTERED_DEVICE: {
    label: 'No enabled registered FCM device for the selected app session',
    action: () =>
      `Open the current ${role} ${platform} app session for ${phone} and let it register an enabled FCM token through the API.`,
  },
  PARTNER_ALERT_POLICY_PROVIDER_MISMATCH: {
    label: 'Partner alert policy does not match the expected delivery channel',
    action: ({ alternativeNotificationPreflights }) =>
      alternativeNotificationHint(alternativeNotificationPreflights),
  },
  AUTO_SELECTED_PAYMENT_NOTIFICATION_DEFERRED: {
    label: 'Default FCM smoke selected a payment notification while payments are deferred',
    action: ({ alternativeNotificationPreflights }) =>
      deferredPaymentNotificationHint(alternativeNotificationPreflights),
  },
};

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
          projectAlignment,
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

const auth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone, otp, role }),
});
const adminAuth = await request('/auth/verify-otp', {
  method: 'POST',
  body: JSON.stringify({ phone: adminPhone, otp: adminOtp, role: 'ADMIN' }),
});
const external = await request('/health/external', {
  headers: { authorization: `Bearer ${adminAuth.accessToken}` },
});
const pushCheck = external.checks?.find((check) => check.category === 'push');

const registeredDevicePreflight = await findRegisteredDevicePreflight(adminAuth.accessToken);
const adminNotifications = await listAdminNotifications(adminAuth.accessToken);
const latestUserNotificationId = await findLatestUserNotificationId(auth.accessToken);
const defaultNotificationSelection = await selectDefaultNotification({
  accessToken: adminAuth.accessToken,
  notifications: adminNotifications,
  latestUserNotificationId,
});
const notificationId = defaultNotificationSelection.selectedNotificationId;
const notificationPreflight = defaultNotificationSelection.notificationPreflight;
const partnerAlertPolicyPreflight = defaultNotificationSelection.partnerAlertPolicyPreflight;
const alternativeNotificationPreflights = defaultNotificationSelection.alternativeNotificationPreflights;
const warnings = registeredDevicePreflight.warnings ?? [];

if (preflight) {
  const retryAuditPreflight = await findNotificationRetryAuditPreflight(
    adminAuth.accessToken,
    notificationId,
  );
  const retryAuditActions = retryAuditPreflightNextActions(retryAuditPreflight);
  const blockers = preflightBlockers({
    notificationId,
    notificationPreflight,
    registeredDevicePreflight,
    partnerAlertPolicyPreflight,
    projectAlignment,
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
        projectAlignment,
        registeredDevicePreflight,
        notificationSelection: summarizeNotificationSelection(defaultNotificationSelection),
        notificationPreflight,
        partnerAlertPolicyPreflight,
        retryAuditPreflight,
        alternativeNotificationPreflights: blockedAlternativeNotificationPreflights,
        liveReady: blockers.length === 0,
        warnings,
        warningLabels: warnings.map((warning) => warning.label),
        blockers,
        blockerLabels: blockers.map(fcmSmokeBlockerLabel),
        nextActions: preflightNextActions(
          blockers,
          blockedAlternativeNotificationPreflights,
          warnings,
          retryAuditActions,
        ),
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
const deferredPaymentBlocker = deferredPaymentNotificationBlocker(notificationPreflight);
if (deferredPaymentBlocker) {
  fail(deferredPaymentNotificationHint(alternativeNotificationPreflights));
}
const projectAlignmentBlocker = fcmProjectAlignmentBlocker(projectAlignment);
if (projectAlignmentBlocker) {
  fail(
    `FCM project alignment is not ready for live smoke: ${JSON.stringify({
      blocker: projectAlignmentBlocker,
      blockerLabel: firebaseProjectAlignmentIssueLabel(projectAlignmentBlocker),
      projectAlignment,
      nextActions: firebaseProjectAlignmentActions(projectAlignment.invalid),
    })}`,
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

const newDeliveries = newDeliveryBatch(after.deliveries ?? [], {
  beforeDeliveryCount,
  beforeDeliveryIds,
  beforeLatestAttemptedAt,
});
const latestDelivery =
  selectDeliveryForExpectation(newDeliveries, { expectedProvider, expectedStatus }) ??
  newestDelivery(newDeliveries) ??
  newDelivery(after.deliveries ?? [], {
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
if (
  expectedProvider !== 'ANY' &&
  !newDeliveries.some((delivery) => deliveryProvider(delivery) === expectedProvider)
) {
  fail(
    `Unexpected delivery provider: ${JSON.stringify({
      expectedProvider,
      providers: deliveryCountsBy(newDeliveries, deliveryProvider),
      notificationId,
    })}`,
  );
}
if (
  expectedStatus !== 'ANY' &&
  !newDeliveries.some(
    (delivery) =>
      (expectedProvider === 'ANY' || deliveryProvider(delivery) === expectedProvider) &&
      deliveryStatus(delivery) === expectedStatus,
  )
) {
  fail(
    `Unexpected delivery status: ${JSON.stringify({
      expectedStatus,
      expectedProvider,
      statuses: deliveryCountsBy(newDeliveries, deliveryStatus),
      failureCodes: deliveryCountsBy(newDeliveries, deliveryFailureCode),
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
      notificationSelection: summarizeNotificationSelection(defaultNotificationSelection),
      registeredDevice: registeredDevice
        ? {
            id: registeredDevice.id,
            platform: registeredDevice.platform,
            enabled: registeredDevice.enabled,
          }
        : null,
      reusedRegisteredDevice: useRegisteredDevice && !registeredDevice,
      selectedRegisteredDevice: selectedRegisteredDeviceOutput(registeredDevice, registeredDevicePreflight),
      registeredDevicePreflight,
      pushReadiness: pushReadinessOutput(pushCheck),
      warnings,
      warningLabels: warnings.map((warning) => warning.label),
      beforeDeliveryCount,
      deliveryCount,
      newDeliveryCount: newDeliveries.length,
      newDeliveries: newDeliveries.map(summarizeSmokeDelivery),
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

async function selectDefaultNotification({ accessToken, notifications, latestUserNotificationId }) {
  let selectedNotificationId = requestedNotificationId ?? latestUserNotificationId ?? null;
  let notificationPreflight = selectedNotificationId
    ? summarizeNotification(findNotification(notifications, selectedNotificationId))
    : null;
  let partnerAlertPolicyPreflight = await findPartnerAlertPolicyPreflight(accessToken, notificationPreflight);
  let alternativeNotificationPreflights = findAlternativeNotificationPreflights(
    notifications,
    selectedNotificationId,
  );
  let autoSelectedAlternative = false;

  if (
    !requestedNotificationId &&
    (expectedProviderBlocker(partnerAlertPolicyPreflight) ||
      deferredPaymentNotificationBlocker(notificationPreflight)) &&
    alternativeNotificationPreflights[0]?.id
  ) {
    selectedNotificationId = alternativeNotificationPreflights[0].id;
    notificationPreflight = summarizeNotification(findNotification(notifications, selectedNotificationId));
    partnerAlertPolicyPreflight = await findPartnerAlertPolicyPreflight(accessToken, notificationPreflight);
    alternativeNotificationPreflights = findAlternativeNotificationPreflights(
      notifications,
      selectedNotificationId,
    );
    autoSelectedAlternative = true;
  }

  return {
    requestedNotificationId: requestedNotificationId ?? null,
    latestUserNotificationId: latestUserNotificationId ?? null,
    selectedNotificationId,
    autoSelectedAlternative,
    notificationPreflight,
    partnerAlertPolicyPreflight,
    alternativeNotificationPreflights,
  };
}

function summarizeNotificationSelection(selection) {
  return {
    requestedNotificationId: selection.requestedNotificationId,
    latestUserNotificationId: selection.latestUserNotificationId,
    selectedNotificationId: selection.selectedNotificationId,
    autoSelectedAlternative: selection.autoSelectedAlternative,
  };
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

async function listAdminAuditLogs(accessToken) {
  const auditLogs = await request('/admin/audit-logs', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return Array.isArray(auditLogs) ? auditLogs : [];
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
    .filter((notification) => !isDeferredPaymentNotification(notification))
    .map(summarizeNotification)
    .slice(0, 3);
}

function notificationBelongsToSmokeUser(notification) {
  return notification.user?.phone === phone && userHasRole(notification.user, role);
}

function isDeferredPaymentNotification(notification) {
  return String(notification?.type ?? '')
    .toLowerCase()
    .startsWith('payment.');
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
  const latestDevice = matchingDevices[0];
  const latestEnabledDevice = enabledDevices[0];

  return {
    userId: smokeUser?.id ?? null,
    profileId: smokeProfileId(smokeUser),
    role,
    phone,
    platform,
    deviceSource,
    matchingCount: matchingDevices.length,
    enabledCount: enabledDevices.length,
    latestDevice: summarizePushDevice(latestDevice),
    latestEnabledDevice: summarizePushDevice(latestEnabledDevice),
    warnings: registeredDeviceWarnings(latestDevice, latestEnabledDevice),
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

function registeredDeviceWarnings(latestDevice, latestEnabledDevice) {
  if (
    !latestDevice ||
    !latestEnabledDevice ||
    latestDevice.enabled ||
    latestDevice.id === latestEnabledDevice.id ||
    pushDeviceTimestampMs(latestDevice) <= pushDeviceTimestampMs(latestEnabledDevice)
  ) {
    return [];
  }

  return [
    {
      code: 'NEWER_DISABLED_DEVICE',
      label:
        'The newest matching push device is disabled while preflight will reuse an older enabled device.',
      operatorAction:
        'Ask the same app session to refresh its FCM token or confirm the older enabled device before live FCM retry.',
      latestDeviceId: latestDevice.id ?? null,
      latestEnabledDeviceId: latestEnabledDevice.id ?? null,
    },
  ];
}

function pushDeviceTimestampMs(device) {
  const updatedAt = Date.parse(device.updatedAt ?? '');
  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }

  const lastSeenAt = Date.parse(device.lastSeenAt ?? '');
  return Number.isFinite(lastSeenAt) ? lastSeenAt : 0;
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

async function findNotificationRetryAuditPreflight(accessToken, notificationId) {
  if (!notificationId) {
    return {
      source: '/admin/audit-logs',
      notificationId: null,
      scannedCount: 0,
      matchingCount: 0,
      latestRetryAudit: null,
      evidence: 'NO_NOTIFICATION_SELECTED',
      staleTokenEvidenceReady: false,
      operatorAction: 'Select a notification before checking retry audit evidence.',
    };
  }

  const auditLogs = await listAdminAuditLogs(accessToken);
  const matchingRetryLogs = auditLogs.filter(
    (log) => log.action === 'notification.retry' && retryAuditNotificationId(log) === notificationId,
  );
  const latestRetryAudit = summarizeRetryAuditLog(matchingRetryLogs[0]);
  const evidence = retryAuditEvidence(latestRetryAudit);

  return {
    source: '/admin/audit-logs',
    notificationId,
    scannedCount: auditLogs.length,
    matchingCount: matchingRetryLogs.length,
    latestRetryAudit,
    evidence,
    staleTokenEvidenceReady: evidence === 'HAS_PUSH_DEVICE_LAST_SEEN_AT',
    operatorAction: retryAuditPreflightOperatorAction(evidence),
    auditHref: `/audit-log?bucket=Notification&range=7d&q=${encodeURIComponent(notificationId)}`,
    notificationHref: `/notifications?review=fcm&notificationId=${encodeURIComponent(notificationId)}`,
  };
}

function summarizeRetryAuditLog(log) {
  if (!log) {
    return null;
  }

  const metadata = auditMetadata(log);
  const latestDelivery = recordValue(metadata.latestDelivery);
  const retryJob = recordValue(metadata.retryJob);

  return {
    id: log.id ?? null,
    createdAt: log.createdAt ?? null,
    action: log.action ?? null,
    target: log.target ?? null,
    notificationId: stringValue(metadata.notificationId),
    retryRisk: stringValue(metadata.retryRisk),
    retryAlreadyDelivered: booleanValue(metadata.retryAlreadyDelivered),
    operatorAction: metadata.operatorAction ? fcmSmokeDisplayText(metadata.operatorAction) : null,
    latestDelivery: summarizeRetryAuditLatestDelivery(latestDelivery),
    retryJob: summarizeRetryAuditJob(retryJob),
  };
}

function summarizeRetryAuditLatestDelivery(delivery) {
  if (!delivery) {
    return null;
  }

  return {
    id: stringValue(delivery.id),
    provider: stringValue(delivery.provider),
    status: stringValue(delivery.status),
    attemptedAt: stringValue(delivery.attemptedAt),
    failureCode: stringValue(delivery.failureCode),
    pushDeviceId: stringValue(delivery.pushDeviceId),
    pushDeviceEnabled: booleanValue(delivery.pushDeviceEnabled),
    pushDeviceLastSeenAt: stringValue(delivery.pushDeviceLastSeenAt),
    pushDevicePlatform: stringValue(delivery.pushDevicePlatform),
    hasPushDeviceLastSeenAt: Object.hasOwn(delivery, 'pushDeviceLastSeenAt'),
  };
}

function summarizeRetryAuditJob(job) {
  if (!job) {
    return null;
  }

  return {
    queueName: stringValue(job.queueName),
    jobName: stringValue(job.jobName),
    attempts: numberValue(job.attempts),
    backoffMs: numberValue(job.backoffMs),
    queuedJobId: stringValue(job.queuedJobId),
  };
}

function retryAuditEvidence(latestRetryAudit) {
  if (!latestRetryAudit) {
    return 'NO_RETRY_AUDIT';
  }
  if (!latestRetryAudit.latestDelivery) {
    return 'NO_DELIVERY_EVIDENCE';
  }
  if (!latestRetryAudit.latestDelivery.hasPushDeviceLastSeenAt) {
    return 'LEGACY_AUDIT_WITHOUT_PUSH_DEVICE_LAST_SEEN_AT';
  }
  if (!latestRetryAudit.latestDelivery.pushDeviceLastSeenAt) {
    return 'NO_PUSH_DEVICE_LAST_SEEN_AT';
  }
  return 'HAS_PUSH_DEVICE_LAST_SEEN_AT';
}

function retryAuditPreflightOperatorAction(evidence) {
  if (evidence === 'NO_RETRY_AUDIT') {
    return 'No retry audit exists yet. Run live retry only after confirming FCM side effects are intended.';
  }
  if (evidence === 'LEGACY_AUDIT_WITHOUT_PUSH_DEVICE_LAST_SEEN_AT') {
    return 'Latest retry audit is from older metadata. Restart the API if this build is not running yet; otherwise only a new live retry will create fresh stale-token evidence.';
  }
  if (evidence === 'NO_DELIVERY_EVIDENCE') {
    return 'Confirm notification workers and queue processing before retrying.';
  }
  if (evidence === 'NO_PUSH_DEVICE_LAST_SEEN_AT') {
    return 'Refresh the app FCM token before relying on retry delivery.';
  }
  return 'Retry audit includes push-device freshness evidence for stale-token review.';
}

function retryAuditPreflightNextActions(preflight) {
  if (!preflight?.operatorAction || preflight.evidence === 'HAS_PUSH_DEVICE_LAST_SEEN_AT') {
    return [];
  }

  return [preflight.operatorAction];
}

function retryAuditNotificationId(log) {
  return stringValue(auditMetadata(log).notificationId);
}

function auditMetadata(log) {
  return recordValue(log?.metadata) ?? {};
}

function recordValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function stringValue(value) {
  return typeof value === 'string' ? value : null;
}

function booleanValue(value) {
  return typeof value === 'boolean' ? value : null;
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
  const source = readFileSync(resolve(repoRoot, 'packages/shared-types/src/index.ts'), 'utf8');
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
  if (fcmProjectAlignmentBlocker(projectAlignment)) {
    actions.push(...firebaseProjectAlignmentActions(projectAlignment.invalid));
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
  projectAlignment,
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
  const deferredPaymentBlocker = deferredPaymentNotificationBlocker(notificationPreflight);
  if (deferredPaymentBlocker) {
    blockers.push(deferredPaymentBlocker);
  }
  const projectAlignmentBlocker = fcmProjectAlignmentBlocker(projectAlignment);
  if (projectAlignmentBlocker) {
    blockers.push(projectAlignmentBlocker);
  }

  return blockers;
}

function fcmProjectAlignmentBlocker(projectAlignment) {
  if (!requiresFcmDeliveryCredentials()) {
    return null;
  }
  return projectAlignment.ok
    ? null
    : (projectAlignment.invalid[0] ?? 'FIREBASE_PROJECT_ALIGNMENT_NOT_CHECKED');
}

function fcmSmokeBlockerLabel(blocker) {
  if (isFcmProjectAlignmentBlockerCode(blocker)) {
    return firebaseProjectAlignmentIssueLabel(blocker);
  }
  return fcmSmokePreflightBlockerCopy[blocker]?.label ?? blocker;
}

function isFcmProjectAlignmentBlockerCode(blocker) {
  return fcmProjectAlignmentBlockerCodes.has(blocker);
}

function fcmSmokeBlockerAction(blocker, options) {
  if (isFcmProjectAlignmentBlockerCode(blocker)) {
    return firebaseProjectAlignmentActions([blocker]);
  }

  const action = fcmSmokePreflightBlockerCopy[blocker]?.action;
  if (!action) {
    return [];
  }
  return [typeof action === 'function' ? action(options) : action];
}

function requiresFcmDeliveryCredentials() {
  return hasExpectedEnvValue('PUSH_PROVIDER', 'fcm') && expectedProvider !== 'IN_APP_ONLY';
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

function deferredPaymentNotificationBlocker(notification) {
  if (requestedNotificationId || !isDeferredPaymentNotification(notification)) {
    return null;
  }

  return 'AUTO_SELECTED_PAYMENT_NOTIFICATION_DEFERRED';
}

function preflightNextActions(
  blockers,
  alternativeNotificationPreflights = [],
  warnings = [],
  advisoryActions = [],
) {
  const warningActions = warnings
    .map((warning) => warning.operatorAction)
    .filter((action) => typeof action === 'string' && action.length > 0);
  const safeAdvisoryActions = advisoryActions.filter(
    (action) => typeof action === 'string' && action.length > 0,
  );

  if (blockers.length === 0) {
    return [
      ...warningActions,
      ...safeAdvisoryActions,
      'Run npm.cmd run fcm:push-smoke without --preflight when ready to send a live FCM retry.',
    ];
  }

  return [
    ...blockers.flatMap((blocker) => fcmSmokeBlockerAction(blocker, { alternativeNotificationPreflights })),
    ...warningActions,
    ...safeAdvisoryActions,
  ];
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

function selectedRegisteredDeviceOutput(registeredDevice, registeredDevicePreflight) {
  if (registeredDevice) {
    return summarizeSmokeDevice(registeredDevice);
  }
  if (useRegisteredDevice) {
    return registeredDevicePreflight.latestEnabledDevice ?? null;
  }
  return null;
}

function summarizeSmokeDevice(device) {
  if (!device) {
    return null;
  }
  return {
    id: device.id ?? null,
    role: device.role ?? null,
    platform: device.platform ?? null,
    enabled: typeof device.enabled === 'boolean' ? device.enabled : null,
    lastSeenAt: device.lastSeenAt ?? null,
    updatedAt: device.updatedAt ?? null,
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
    'Set FCM_SMOKE_NOTIFICATION_ID to a standard notification, set FCM_SMOKE_EXPECT_PROVIDER to the policy-routed provider, or intentionally update the policy before live FCM retry.';
  const [firstAlternative] = alternativeNotificationPreflights;
  if (!firstAlternative?.id) {
    return `The selected notification is a Partner alert controlled by ${partnerAlertPolicyKey}. ${fallback}`;
  }

  return `The selected notification is a Partner alert controlled by ${partnerAlertPolicyKey}. Set FCM_SMOKE_NOTIFICATION_ID=${firstAlternative.id} to use the latest standard notification for this same role/phone, or intentionally update the policy before live FCM retry.`;
}

function deferredPaymentNotificationHint(alternativeNotificationPreflights) {
  const [firstAlternative] = alternativeNotificationPreflights;
  if (firstAlternative?.id) {
    return `Set FCM_SMOKE_NOTIFICATION_ID=${firstAlternative.id} to use the latest non-payment notification for this same role/phone before live FCM retry.`;
  }

  return 'Create or select a non-payment notification with FCM_SMOKE_NOTIFICATION_ID before live FCM retry; payment notifications are deferred for this pass.';
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

function newDeliveryBatch(deliveries, { beforeDeliveryCount, beforeDeliveryIds, beforeLatestAttemptedAt }) {
  const byId = deliveries.filter((delivery) => delivery.id && !beforeDeliveryIds.has(delivery.id));
  if (byId.length > 0) {
    return sortDeliveries(byId);
  }

  const byTime = deliveries.filter((delivery) => deliveryTime(delivery) > beforeLatestAttemptedAt);
  if (byTime.length > 0) {
    return sortDeliveries(byTime);
  }

  return sortDeliveries(deliveries.slice(0, Math.max(0, deliveries.length - beforeDeliveryCount)));
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
  return sortDeliveries(deliveries)[0];
}

function sortDeliveries(deliveries) {
  return deliveries
    .filter(Boolean)
    .slice()
    .sort((left, right) => deliveryTime(right) - deliveryTime(left));
}

function selectDeliveryForExpectation(deliveries, { expectedProvider, expectedStatus }) {
  return (
    deliveries.find(
      (delivery) =>
        (expectedProvider === 'ANY' || deliveryProvider(delivery) === expectedProvider) &&
        (expectedStatus === 'ANY' || deliveryStatus(delivery) === expectedStatus),
    ) ?? null
  );
}

function summarizeSmokeDelivery(delivery) {
  return {
    id: delivery.id ?? null,
    provider: deliveryProvider(delivery),
    status: deliveryStatus(delivery),
    failureCode: deliveryFailureCode(delivery),
    pushDeviceId: delivery.pushDeviceId ?? null,
    attemptedAt: delivery.attemptedAt ?? null,
  };
}

function deliveryProvider(delivery) {
  return String(delivery?.provider ?? '').toUpperCase();
}

function deliveryStatus(delivery) {
  return String(delivery?.status ?? '').toUpperCase();
}

function deliveryFailureCode(delivery) {
  return delivery?.failureCode ?? delivery?.response?.failureCode ?? null;
}

function deliveryCountsBy(deliveries, keyFn) {
  return deliveries.reduce((counts, delivery) => {
    const key = keyFn(delivery) ?? 'NONE';
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
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
