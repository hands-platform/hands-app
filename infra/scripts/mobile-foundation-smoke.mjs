import { PrismaClient } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const syntheticTokenPrefix = 'hands-mobile-foundation-smoke-';
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const apiBaseUrl = normalizeApiBaseUrl(env.API_BASE_URL ?? 'http://localhost:3000/api');
const otp = env.MOBILE_FOUNDATION_SMOKE_OTP ?? env.DEV_OTP ?? '123456';
const customerPhone = env.MOBILE_FOUNDATION_SMOKE_CUSTOMER_PHONE ?? '+84900000001';
const providerPhone = env.MOBILE_FOUNDATION_SMOKE_PROVIDER_PHONE ?? '+84900000002';
const appVersionChecks = [
  { appType: 'CUSTOMER', platform: 'ANDROID' },
  { appType: 'CUSTOMER', platform: 'IOS' },
  { appType: 'PARTNER', platform: 'ANDROID' },
  { appType: 'PARTNER', platform: 'IOS' },
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        scope: 'mobile-foundation-config-only',
        envFile: { path: envPath, exists: envFileExists },
        apiBaseUrl,
        actors: [
          { role: 'CUSTOMER', phone: customerPhone },
          { role: 'PROVIDER', phone: providerPhone },
        ],
        appVersionChecks,
        tokenPrefix: syntheticTokenPrefix,
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

const appVersions = [];
for (const check of appVersionChecks) {
  const policy = await request(
    `/mobile/app-version?appType=${encodeURIComponent(check.appType)}&platform=${encodeURIComponent(
      check.platform,
    )}`,
  );
  if (
    policy.appType !== check.appType ||
    policy.platform !== check.platform ||
    policy.forceUpdate !== false ||
    policy.source !== 'DATABASE'
  ) {
    fail(`Unexpected app-version policy. Run prisma:seed before this smoke: ${JSON.stringify(policy)}`);
  }
  appVersions.push({
    appType: policy.appType,
    platform: policy.platform,
    forceUpdate: policy.forceUpdate,
    source: policy.source,
  });
}

const startedAt = Date.now();
const registrations = [];
for (const actor of [
  { role: 'CUSTOMER', phone: customerPhone, appType: 'CUSTOMER' },
  { role: 'PROVIDER', phone: providerPhone, appType: 'PARTNER' },
]) {
  const auth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: actor.phone, otp, role: actor.role }),
  });
  const refreshedAuth = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });

  for (const platform of ['ANDROID', 'IOS']) {
    const token = `${syntheticTokenPrefix}${actor.role.toLowerCase()}-${platform.toLowerCase()}-${startedAt}`;
    const registeredDevice = await request('/mobile/devices/register', {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshedAuth.accessToken}` },
      body: JSON.stringify({
        token,
        platform,
        pushProvider: 'FCM',
        appVersion: 'smoke-test',
        osVersion: platform === 'IOS' ? 'iOS smoke' : 'Android smoke',
        deviceModel: `${actor.role} ${platform} smoke device`,
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      }),
    });

    assertRegisteredDevice(actor, auth.user.id, platform, registeredDevice, token);

    const registeredAgain = await request('/mobile/devices/register', {
      method: 'POST',
      headers: { authorization: `Bearer ${refreshedAuth.accessToken}` },
      body: JSON.stringify({
        token,
        platform,
        pushProvider: 'FCM',
        appVersion: 'smoke-test-reregistered',
        locale: 'vi-VN',
      }),
    });

    assertRegisteredDevice(actor, auth.user.id, platform, registeredAgain, token);
    if (
      registeredAgain.id !== registeredDevice.id ||
      registeredAgain.appVersion !== 'smoke-test-reregistered'
    ) {
      fail(
        `${actor.role} ${platform} re-registration did not upsert the existing token: ${JSON.stringify(
          maskTokenFields(registeredAgain, token),
        )}`,
      );
    }

    const disabled = await request('/mobile/devices', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${refreshedAuth.accessToken}` },
      body: JSON.stringify({ token }),
    });
    if (!disabled.ok || disabled.disabled < 1) {
      fail(`${actor.role} ${platform} mobile token disable failed: ${JSON.stringify(disabled)}`);
    }

    registrations.push({
      role: actor.role,
      platform,
      storedPlatform: registeredAgain.platform,
      pushProvider: registeredAgain.pushProvider,
      upserted: registeredAgain.id === registeredDevice.id,
      disabled: disabled.disabled,
    });
  }
}

const syntheticCleanup = await cleanupSyntheticSmokeDevices();

console.log(
  JSON.stringify(
    {
      ok: true,
      apiBaseUrl,
      appVersions,
      registrations,
      syntheticCleanup,
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

function assertRegisteredDevice(actor, userId, platform, registeredDevice, token) {
  if (
    registeredDevice.userId !== userId ||
    registeredDevice.role !== actor.role ||
    registeredDevice.platform !== platform.toLowerCase() ||
    registeredDevice.pushProvider !== 'FCM' ||
    registeredDevice.enabled !== true
  ) {
    fail(
      `${actor.role} ${platform} mobile device registration returned an unexpected payload: ${JSON.stringify(
        maskTokenFields(registeredDevice, token),
      )}`,
    );
  }
}

function normalizeApiBaseUrl(value) {
  return String(value ?? '').replace(/\/+$/, '');
}

function maskTokenFields(value, token) {
  return JSON.parse(JSON.stringify(value).replaceAll(token, '<MOBILE_FOUNDATION_SMOKE_TOKEN>'));
}

async function cleanupSyntheticSmokeDevices() {
  const prisma = new PrismaClient();
  try {
    const result = await prisma.pushDevice.deleteMany({
      where: {
        token: { startsWith: syntheticTokenPrefix },
        enabled: false,
        deliveries: { none: {} },
      },
    });
    return {
      deleted: result.count,
      tokenPrefix: syntheticTokenPrefix,
      safety: 'disabled synthetic smoke devices without delivery records only',
    };
  } finally {
    await prisma.$disconnect();
  }
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
