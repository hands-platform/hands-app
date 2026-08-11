import { Role } from '@prisma/client';

const NOTIFICATION_TARGET_ROLE_KEY = 'targetRole';
export const LEGACY_CUSTOMER_NOTIFICATION_TYPES = [
  'booking.opened',
  'booking.rejected',
  'payment.updated',
  'provider.accepted',
  'provider.joined',
  'provider.rejected',
  'service.completed',
] as const;
export const LEGACY_PROVIDER_NOTIFICATION_TYPES = [
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
] as const;
const LEGACY_CUSTOMER_NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set(
  LEGACY_CUSTOMER_NOTIFICATION_TYPES,
);
const LEGACY_PROVIDER_NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set(
  LEGACY_PROVIDER_NOTIFICATION_TYPES,
);

export type NotificationTargetRole = Extract<Role, 'CUSTOMER' | 'PROVIDER'>;

export function notificationDataWithTargetRole(data: unknown, targetRole?: Role) {
  if (!isNotificationTargetRole(targetRole)) {
    return data;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { [NOTIFICATION_TARGET_ROLE_KEY]: targetRole };
  }

  return { ...(data as Record<string, unknown>), [NOTIFICATION_TARGET_ROLE_KEY]: targetRole };
}

export function notificationTargetRole(notification: { type?: string; data?: unknown }) {
  const data = notification.data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const targetRole = (data as Record<string, unknown>)[NOTIFICATION_TARGET_ROLE_KEY];
    if (isNotificationTargetRole(targetRole)) {
      return targetRole;
    }
  }

  return legacyNotificationTargetRole(notification.type);
}

export function pushDeviceMatchesTargetRole(
  device: { role?: Role | null },
  targetRole: NotificationTargetRole | null,
) {
  return !targetRole || device.role === targetRole;
}

export function isNotificationTargetRole(value: unknown): value is NotificationTargetRole {
  return value === Role.CUSTOMER || value === Role.PROVIDER;
}

function legacyNotificationTargetRole(notificationType: string | undefined) {
  if (notificationType && LEGACY_CUSTOMER_NOTIFICATION_TYPE_SET.has(notificationType)) {
    return Role.CUSTOMER;
  }
  if (notificationType && LEGACY_PROVIDER_NOTIFICATION_TYPE_SET.has(notificationType)) {
    return Role.PROVIDER;
  }
  return null;
}
