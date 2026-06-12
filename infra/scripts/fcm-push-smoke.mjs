const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const deviceToken = process.env.FCM_SMOKE_DEVICE_TOKEN?.trim();
const role = normalizeRole(process.env.FCM_SMOKE_ROLE ?? 'CUSTOMER');
const phone = process.env.FCM_SMOKE_PHONE ?? (role === 'PROVIDER' ? '+84900000002' : '+84900000001');
const otp = process.env.FCM_SMOKE_OTP ?? process.env.DEV_OTP ?? '123456';
const adminPhone = process.env.FCM_SMOKE_ADMIN_PHONE ?? process.env.ADMIN_DEMO_PHONE ?? '+84900000099';
const adminOtp = process.env.FCM_SMOKE_ADMIN_OTP ?? process.env.ADMIN_DEMO_OTP ?? '123456';
const requestedNotificationId = process.env.FCM_SMOKE_NOTIFICATION_ID?.trim();
const expectedStatus = (process.env.FCM_SMOKE_EXPECT_STATUS ?? 'ANY').trim().toUpperCase();
const expectedProvider = (process.env.FCM_SMOKE_EXPECT_PROVIDER ?? 'FCM').trim().toUpperCase();
const timeoutMs = Number(process.env.FCM_SMOKE_TIMEOUT_MS ?? 30_000);
const pollIntervalMs = Number(process.env.FCM_SMOKE_POLL_INTERVAL_MS ?? 1_000);
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
        apiBaseUrl,
        role,
        phone,
        hasDeviceToken: Boolean(deviceToken),
        requestedNotificationId: requestedNotificationId || null,
        expectedProvider,
        expectedStatus,
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
  body: JSON.stringify({ token: deviceToken, platform: 'android' }),
});

const notificationId = requestedNotificationId ?? (await findLatestUserNotificationId(auth.accessToken));
if (!notificationId) {
  fail(
    'No notification exists for the selected smoke user. Run a booking/chat flow first, or set FCM_SMOKE_NOTIFICATION_ID to an existing notification.',
  );
}

const before = await findAdminNotification(adminAuth.accessToken, notificationId);
const beforeDeliveryCount = before?.deliveries?.length ?? 0;
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

const latestDelivery = after.deliveries[0];
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

function maskDeviceToken(value) {
  return deviceToken ? value.replaceAll(deviceToken, '<FCM_SMOKE_DEVICE_TOKEN>') : value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: maskDeviceToken(message) }, null, 2));
  process.exit(1);
}
