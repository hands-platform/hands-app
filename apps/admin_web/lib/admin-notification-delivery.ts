import type { AdminNotification } from './admin-api';
import { marketplaceDisplayText } from './admin-copy';
import { shortId } from './admin-format';

export type AdminNotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];
export type AdminNotificationPushDevice = NonNullable<
  NonNullable<AdminNotification['user']>['pushDevices']
>[number];

export type NotificationDeliveryDisposition =
  | 'delivered'
  | 'failed'
  | 'partial'
  | 'pending'
  | 'skipped';

export function notificationDeliveries(
  notification: AdminNotification,
): readonly AdminNotificationDelivery[] {
  return notification.deliveries ?? [];
}

export function deliveryAttemptMs(delivery: AdminNotificationDelivery) {
  const attemptedAt = Date.parse(delivery.attemptedAt);
  return Number.isFinite(attemptedAt) ? attemptedAt : 0;
}

export function newestNotificationDeliveries(deliveries: readonly AdminNotificationDelivery[]) {
  return [...deliveries].sort((left, right) => deliveryAttemptMs(right) - deliveryAttemptMs(left));
}

export function notificationDeliveryDisposition(
  notification: AdminNotification,
): NotificationDeliveryDisposition {
  const deliveries = newestNotificationDeliveries(notificationDeliveries(notification));
  if (deliveries.some((delivery) => !delivery.pushDevice?.id && !delivery.pushDeviceId)) {
    return dispositionFromLatestDeliveries(deliveries.slice(0, 1));
  }

  const latestByPath = new Map<string, AdminNotificationDelivery>();

  for (const delivery of deliveries) {
    const pathKey =
      delivery.pushDevice?.id ??
      delivery.pushDeviceId ??
      `${delivery.provider}:without-device`;
    if (!latestByPath.has(pathKey)) {
      latestByPath.set(pathKey, delivery);
    }
  }

  return dispositionFromLatestDeliveries([...latestByPath.values()]);
}

function dispositionFromLatestDeliveries(
  latestDeliveries: readonly AdminNotificationDelivery[],
): NotificationDeliveryDisposition {
  if (latestDeliveries.length === 0) return 'pending';

  const hasSent = latestDeliveries.some((delivery) => isSuccessfulDeliveryStatus(delivery.status));
  const hasFailed = latestDeliveries.some((delivery) => delivery.status === 'FAILED');
  if (hasSent && hasFailed) return 'partial';
  if (hasFailed) return 'failed';
  if (hasSent) return 'delivered';
  if (latestDeliveries.some((delivery) => delivery.status === 'SKIPPED')) return 'skipped';
  return 'pending';
}

export function isNotificationDeliveryProvider(delivery: AdminNotificationDelivery, provider: string) {
  return delivery.provider === provider;
}

export function latestFcmSentNotificationDelivery(notifications: readonly AdminNotification[]) {
  return notifications
    .flatMap((notification) =>
      notificationDeliveries(notification)
        .filter((delivery) => isNotificationDeliveryProvider(delivery, 'FCM') && delivery.status === 'SENT')
        .map((delivery) => ({ delivery, notification })),
    )
    .sort((left, right) => deliveryAttemptMs(right.delivery) - deliveryAttemptMs(left.delivery))[0];
}

export function formatFcmSentDeliveryDetail(
  notification: AdminNotification,
  delivery: AdminNotificationDelivery,
) {
  const role = notificationDeliveryRole(notification, delivery);
  const actorLabel = role === 'PROVIDER' ? 'Partner' : 'Customer';
  const phone = notification.user?.phone ?? 'No phone on file';
  const platform = delivery.pushDevice?.platform ?? 'device';
  const deviceLabel = delivery.pushDevice?.id
    ? `device ${shortId(delivery.pushDevice.id)}`
    : 'device unknown';
  const notificationLabel = `${marketplaceDisplayText(humanizeNotificationType(notification.type))} ${shortId(
    notification.id,
  )}`;

  return `${actorLabel} ${phone} / ${platform} / ${notificationLabel} / ${deviceLabel}`;
}

export function humanizeNotificationType(type: string) {
  return type
    .toLowerCase()
    .split(/[_\-.]/g)
    .map((part) => (part === 'backup' ? 'Marketplace' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function notificationDeliveryRole(
  notification: AdminNotification,
  delivery: AdminNotificationDelivery,
): 'CUSTOMER' | 'PROVIDER' {
  const deliveryRole = delivery.pushDevice?.role?.toUpperCase();
  if (deliveryRole === 'PROVIDER') {
    return 'PROVIDER';
  }
  if (deliveryRole === 'CUSTOMER') {
    return 'CUSTOMER';
  }
  return isProviderNotification(notification) ? 'PROVIDER' : 'CUSTOMER';
}

function isProviderNotification(notification: AdminNotification) {
  return (
    Boolean(notification.user?.providerProfile) ||
    (notification.user?.roles ?? []).map((role) => role.toUpperCase()).includes('PROVIDER')
  );
}

function isSuccessfulDeliveryStatus(status: string) {
  return status === 'SENT' || status === 'DELIVERED' || status === 'SUCCESS';
}
