import type { AdminNotification } from './admin-api';

export const STALE_PUSH_DEVICE_AGE_DAYS = 30;

const STALE_PUSH_DEVICE_AGE_MS = STALE_PUSH_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000;

type AdminNotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];

export function isStaleNotificationPushDeviceDelivery(delivery: AdminNotificationDelivery) {
  return delivery.pushDevice?.enabled !== false && hasOldPushTokenTimestamp(delivery);
}

export function notificationPushDeviceFreshnessLabel(delivery: AdminNotificationDelivery) {
  if (hasOldPushTokenTimestamp(delivery)) {
    return `${STALE_PUSH_DEVICE_AGE_DAYS}+ day token timestamp`;
  }
  if (!delivery.pushDevice?.lastSeenAt) {
    return 'Token timestamp unknown';
  }
  return 'Token timestamp current';
}

function hasOldPushTokenTimestamp(delivery: AdminNotificationDelivery) {
  const lastSeenAt = Date.parse(delivery.pushDevice?.lastSeenAt ?? '');
  const attemptedAt = Date.parse(delivery.attemptedAt);
  if (!Number.isFinite(lastSeenAt) || !Number.isFinite(attemptedAt)) {
    return false;
  }
  return attemptedAt - lastSeenAt >= STALE_PUSH_DEVICE_AGE_MS;
}
