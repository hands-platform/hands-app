import { PrismaClient } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';
import { envValue, normalizeApiBaseUrl, normalizePlatform } from './lib/fcm-smoke-config.mjs';

const syntheticTokenPrefix = 'hands-fcm-token-recovery-smoke-';
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const apiBaseUrl = normalizeApiBaseUrl(envValue(env, 'API_BASE_URL') ?? 'http://localhost:3000/api', fail);
const platform = normalizePlatform(envValue(env, 'FCM_SMOKE_PLATFORM') ?? 'android', fail);
const otp = envValue(env, 'FCM_SMOKE_OTP') ?? envValue(env, 'DEV_OTP') ?? '123456';
const customerPhone = envValue(env, 'FCM_TOKEN_SMOKE_CUSTOMER_PHONE') ?? '+84900000001';
const providerPhone = envValue(env, 'FCM_TOKEN_SMOKE_PROVIDER_PHONE') ?? '+84900000002';
const dryRun = process.argv.includes('--dry-run');

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'dry-run',
        scope: 'api-and-db-contract',
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
        validates: [
          'Synthetic stale token can be registered through the API.',
          'Disabled synthetic stale token can be re-registered and re-enabled through the API.',
          'Replacement token can be registered while the disabled stale token remains disabled.',
          'Synthetic rows without delivery records are cleaned up after the smoke.',
        ],
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

const startedAt = Date.now();
const results = [];

for (const actor of [
  { role: 'CUSTOMER', phone: customerPhone, method: 'PATCH' },
  { role: 'PROVIDER', phone: providerPhone, method: 'POST' },
]) {
  const auth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: actor.phone, otp, role: actor.role }),
  });
  const refreshedAuth = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: auth.refreshToken }),
  });
  const headers = { authorization: `Bearer ${refreshedAuth.accessToken}` };
  const staleToken = `${syntheticTokenPrefix}${actor.role.toLowerCase()}-stale-${startedAt}`;
  const replacementToken = `${syntheticTokenPrefix}${actor.role.toLowerCase()}-replacement-${startedAt}`;

  const firstRegistration = await registerToken({
    method: actor.method,
    headers,
    token: staleToken,
  });
  assertRegisteredDevice(firstRegistration, {
    actor,
    userId: auth.user.id,
    token: staleToken,
    expectedExistingId: null,
  });

  const firstDisable = await disableToken({ headers, token: staleToken });
  assertDisabled(`${actor.role} stale token first disable`, firstDisable);
  const disabledStaleDevice = await findSyntheticDevice(staleToken);
  if (!disabledStaleDevice || disabledStaleDevice.enabled !== false) {
    fail(
      `${actor.role} stale token was not disabled as expected: ${JSON.stringify(
        maskDevice(disabledStaleDevice, staleToken),
      )}`,
    );
  }

  const reRegistration = await registerToken({
    method: actor.method,
    headers,
    token: staleToken,
  });
  assertRegisteredDevice(reRegistration, {
    actor,
    userId: auth.user.id,
    token: staleToken,
    expectedExistingId: firstRegistration.id,
  });

  const secondDisable = await disableToken({ headers, token: staleToken });
  assertDisabled(`${actor.role} stale token second disable`, secondDisable);

  const replacementRegistration = await registerToken({
    method: actor.method,
    headers,
    token: replacementToken,
  });
  assertRegisteredDevice(replacementRegistration, {
    actor,
    userId: auth.user.id,
    token: replacementToken,
    expectedExistingId: null,
  });

  const staleAfterReplacement = await findSyntheticDevice(staleToken);
  if (!staleAfterReplacement || staleAfterReplacement.enabled !== false) {
    fail(
      `${actor.role} stale token should remain disabled after replacement registration: ${JSON.stringify(
        maskDevice(staleAfterReplacement, staleToken),
      )}`,
    );
  }

  const replacementDisable = await disableToken({ headers, token: replacementToken });
  assertDisabled(`${actor.role} replacement token disable`, replacementDisable);

  results.push({
    role: actor.role,
    platform,
    staleTokenReEnabled: true,
    staleTokenRemainedDisabledAfterReplacement: true,
    replacementRegistered: true,
    tokenValuesMasked: true,
  });
}

const syntheticCleanup = await cleanupSyntheticSmokeDevices();

console.log(
  JSON.stringify(
    {
      ok: true,
      apiBaseUrl,
      platform,
      results,
      syntheticCleanup,
    },
    null,
    2,
  ),
);

async function registerToken({ method, headers, token }) {
  return request('/notifications/device-token/register', {
    method,
    headers,
    body: JSON.stringify({ token, platform }),
  });
}

async function disableToken({ headers, token }) {
  return request('/notifications/device-token', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ token }),
  });
}

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

function assertRegisteredDevice(device, { actor, userId, token, expectedExistingId }) {
  const idMatches = expectedExistingId === null || device.id === expectedExistingId;
  if (
    !idMatches ||
    device.userId !== userId ||
    device.role !== actor.role ||
    device.platform !== platform ||
    device.enabled !== true
  ) {
    fail(
      `${actor.role} token recovery registration returned an unexpected payload: ${JSON.stringify(
        maskDevice(device, token),
      )}`,
    );
  }
}

function assertDisabled(label, response) {
  if (!response.ok || response.disabled < 1) {
    fail(`${label} failed: ${JSON.stringify(response)}`);
  }
}

async function findSyntheticDevice(token) {
  const prisma = new PrismaClient();
  try {
    return prisma.pushDevice.findUnique({
      where: { token },
      select: {
        id: true,
        userId: true,
        role: true,
        platform: true,
        enabled: true,
        lastSeenAt: true,
        updatedAt: true,
        token: true,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

function maskDevice(value, token) {
  if (!value) {
    return value;
  }
  return JSON.parse(JSON.stringify(value).replaceAll(token, '<FCM_TOKEN_RECOVERY_SMOKE_TOKEN>'));
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
      safety: 'disabled synthetic recovery-smoke devices without delivery records only',
    };
  } finally {
    await prisma.$disconnect();
  }
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
