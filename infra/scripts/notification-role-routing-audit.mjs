import { PrismaClient, Role } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const strict = process.argv.includes('--strict');
const deliveryLimit = positiveIntegerArg('--delivery-limit=', 250);
const deviceLimit = positiveIntegerArg('--device-limit=', 500);
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const LEGACY_CUSTOMER_NOTIFICATION_TYPES = new Set([
  'booking.opened',
  'booking.rejected',
  'payment.updated',
  'provider.accepted',
  'provider.joined',
  'provider.rejected',
  'service.completed',
]);
const LEGACY_PROVIDER_NOTIFICATION_TYPES = new Set([
  'booking.backup_available',
  'booking.requested',
  'earning.created',
  'provider.account.blocked',
  'provider.account.unblocked',
  'provider.media.approved',
  'provider.media.rejected',
  'provider.payout_batch.updated',
  'provider.payout_setup_required',
  'provider.verification.approved',
  'provider.verification.rejected',
]);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for notification role routing audit.');
}

const prisma = new PrismaClient();

try {
  const [deliveryAudit, deviceAudit] = await Promise.all([
    auditDeliveries(),
    auditEnabledDevices(),
  ]);
  const strictOk =
    deliveryAudit.targetRoleMismatchCount === 0 && deviceAudit.roleOutsideUserRolesCount === 0;

  const result = {
    ok: true,
    strict,
    strictOk,
    envFile: { path: envPath, exists: envFileExists },
    deliveryAudit,
    deviceAudit,
    nextActions: strictOk
      ? []
      : [
          'Review listed delivery/device ids in Admin before enabling strict release gating.',
          'Have each affected app session register a fresh FCM token through the API.',
        ],
  };

  console[strictOk ? 'log' : 'warn'](JSON.stringify(result, null, 2));

  if (strict && !strictOk) {
    process.exit(1);
  }
} finally {
  await prisma.$disconnect();
}

async function auditDeliveries() {
  const deliveries = await prisma.notificationDelivery.findMany({
    orderBy: { attemptedAt: 'desc' },
    take: deliveryLimit,
    select: {
      id: true,
      attemptedAt: true,
      provider: true,
      status: true,
      notification: {
        select: {
          id: true,
          type: true,
          data: true,
          userId: true,
        },
      },
      pushDevice: {
        select: {
          id: true,
          userId: true,
          role: true,
          platform: true,
          enabled: true,
        },
      },
    },
  });

  const targetRoleMismatches = deliveries
    .map((delivery) => {
      const targetRole = notificationTargetRole(delivery.notification);
      if (!targetRole || delivery.pushDevice.role === targetRole) {
        return null;
      }
      return {
        deliveryId: delivery.id,
        attemptedAt: delivery.attemptedAt,
        notificationId: delivery.notification.id,
        notificationType: delivery.notification.type,
        targetRole,
        notificationUserId: delivery.notification.userId,
        pushDeviceId: delivery.pushDevice.id,
        pushDeviceUserId: delivery.pushDevice.userId,
        pushDeviceRole: delivery.pushDevice.role,
        platform: delivery.pushDevice.platform,
        provider: delivery.provider,
        status: delivery.status,
      };
    })
    .filter(Boolean);

  const knownTargetRoleCount = deliveries.filter((delivery) =>
    Boolean(notificationTargetRole(delivery.notification)),
  ).length;

  return {
    scannedDeliveries: deliveries.length,
    deliveryLimit,
    knownTargetRoleCount,
    ambiguousTargetRoleCount: deliveries.length - knownTargetRoleCount,
    targetRoleMismatchCount: targetRoleMismatches.length,
    targetRoleMismatches: targetRoleMismatches.slice(0, 25),
  };
}

async function auditEnabledDevices() {
  const devices = await prisma.pushDevice.findMany({
    where: { enabled: true },
    orderBy: { lastSeenAt: 'desc' },
    take: deviceLimit,
    select: {
      id: true,
      userId: true,
      role: true,
      platform: true,
      lastSeenAt: true,
      user: { select: { roles: true } },
    },
  });

  const roleOutsideUserRoles = devices
    .filter((device) => !device.user.roles.includes(device.role))
    .map((device) => ({
      pushDeviceId: device.id,
      userId: device.userId,
      pushDeviceRole: device.role,
      userRoles: device.user.roles,
      platform: device.platform,
      lastSeenAt: device.lastSeenAt,
    }));

  const enabledByRole = devices.reduce(
    (summary, device) => {
      summary[device.role] = (summary[device.role] ?? 0) + 1;
      return summary;
    },
    {},
  );

  return {
    scannedEnabledDevices: devices.length,
    deviceLimit,
    enabledByRole,
    roleOutsideUserRolesCount: roleOutsideUserRoles.length,
    roleOutsideUserRoles: roleOutsideUserRoles.slice(0, 25),
  };
}

function notificationTargetRole(notification) {
  const data = notification.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const targetRole = data.targetRole;
    if (isNotificationTargetRole(targetRole)) {
      return targetRole;
    }
  }

  return legacyNotificationTargetRole(notification.type);
}

function legacyNotificationTargetRole(notificationType) {
  if (LEGACY_CUSTOMER_NOTIFICATION_TYPES.has(notificationType)) {
    return Role.CUSTOMER;
  }
  if (LEGACY_PROVIDER_NOTIFICATION_TYPES.has(notificationType)) {
    return Role.PROVIDER;
  }
  return null;
}

function isNotificationTargetRole(value) {
  return value === Role.CUSTOMER || value === Role.PROVIDER;
}

function positiveIntegerArg(prefix, fallback) {
  const raw = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    fail(`${prefix}${raw} must be a positive integer.`);
  }
  return value;
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
