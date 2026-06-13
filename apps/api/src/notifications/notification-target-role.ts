import { Role } from '@prisma/client';

const NOTIFICATION_TARGET_ROLE_KEY = 'targetRole';

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

export function notificationTargetRole(notification: { data?: unknown }) {
  const data = notification.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const targetRole = (data as Record<string, unknown>)[NOTIFICATION_TARGET_ROLE_KEY];
  return isNotificationTargetRole(targetRole) ? targetRole : null;
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
