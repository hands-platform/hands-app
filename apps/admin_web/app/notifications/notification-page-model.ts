import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';

const PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
] as const;
const PARTNER_ALERT_TYPE_SET: ReadonlySet<string> = new Set(PARTNER_ALERT_TYPES);

export type NotificationSummary = {
  readonly disabledDevices: number;
  readonly failed: number;
  readonly needsRetry: number;
  readonly noShow: number;
  readonly payoutSetup: number;
  readonly sent: number;
  readonly skipped: number;
};

export type NotificationChannelSummary = {
  readonly inAppDeliveries: number;
  readonly oneSignalDeliveries: number;
  readonly partnerAlertCount: number;
  readonly policyLabel: string;
};

export function buildNotificationSummary(
  notifications: readonly AdminNotification[],
): NotificationSummary {
  return {
    disabledDevices: countDisabledDevices(notifications),
    failed: countDeliveries(notifications, 'FAILED'),
    needsRetry: notifications.filter((notification) => hasRetrySignal(notification)).length,
    noShow: notifications.filter((notification) => notification.type === 'booking.no_show').length,
    payoutSetup: notifications.filter(
      (notification) => notification.type === 'provider.payout_setup_required',
    ).length,
    sent: countDeliveries(notifications, 'SENT'),
    skipped: countDeliveries(notifications, 'SKIPPED'),
  };
}

export function buildNotificationDeliveryOpsQueue(
  notifications: readonly AdminNotification[],
): NotificationDeliveryOpsQueueItem[] {
  const failed = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  ).length;
  const disabledDevices = countDisabledDevices(notifications);
  const skipped = notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'SKIPPED'),
  ).length;
  const pending = notifications.filter((notification) => (notification.deliveries ?? []).length === 0).length;
  const items: NotificationDeliveryOpsQueueItem[] = [];

  if (failed) {
    items.push({
      count: failed,
      detail: 'Push provider returned an error. Check failure reason, token freshness, and credentials.',
      href: '/notifications?review=failed',
      key: 'failed',
      label: 'Failed sends',
      tone: 'pill-warn',
    });
  }
  if (disabledDevices) {
    items.push({
      count: disabledDevices,
      detail: 'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
      href: '/notifications?review=disabled-device',
      key: 'disabled-devices',
      label: 'Disabled devices',
      tone: 'pill-warn',
    });
  }
  if (skipped) {
    items.push({
      count: skipped,
      detail:
        'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
      href: '/notifications?review=skipped',
      key: 'skipped',
      label: 'Skipped',
      tone: 'pill-info',
    });
  }
  if (pending) {
    items.push({
      count: pending,
      detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
      href: '/notifications?review=pending',
      key: 'pending',
      label: 'Pending',
      tone: 'pill-neutral',
    });
  }

  return items;
}

export function buildNotificationChannelSummary(
  notifications: readonly AdminNotification[],
  operationalPolicies: readonly AdminOperationalPolicySetting[],
): NotificationChannelSummary {
  const partnerAlertPolicy = operationalPolicies.find(
    (setting) => setting.key === 'notification.partner_alert_channel',
  );
  const partnerAlerts = notifications.filter((notification) => isPartnerAlertType(notification.type));
  const deliveries = notifications.flatMap((notification) => notification.deliveries ?? []);
  return {
    inAppDeliveries: deliveries.filter((delivery) => delivery.provider === 'IN_APP_ONLY').length,
    oneSignalDeliveries: deliveries.filter((delivery) => delivery.provider === 'ONESIGNAL').length,
    partnerAlertCount: partnerAlerts.length,
    policyLabel: policyOptionLabel(partnerAlertPolicy),
  };
}

export function filterNotifications(
  notifications: readonly AdminNotification[],
  filters: { readonly booking: string; readonly review: string },
): AdminNotification[] {
  return notifications.filter((notification) => {
    if (filters.booking && notificationBookingId(notification) !== filters.booking) {
      return false;
    }
    return notificationMatchesReview(notification, filters.review);
  });
}

export function notificationFilterDescription(review: string) {
  if (review === 'failed') {
    return 'delivery attempts that returned a push provider failure.';
  }
  if (review === 'disabled-device') {
    return 'users or partners with disabled push devices.';
  }
  if (review === 'needs-retry') {
    return 'notifications whose delivery path should be reviewed before retry.';
  }
  if (review === 'skipped') {
    return 'alerts that were intentionally skipped or had no available send path.';
  }
  if (review === 'sent') {
    return 'successfully delivered push notifications.';
  }
  if (review === 'pending') {
    return 'notifications without a captured delivery attempt yet.';
  }
  if (review === 'payout-setup') {
    return 'partners who earned revenue and now need tax/address/agreement setup before payout.';
  }
  if (review === 'partner-alerts') {
    return 'booking and payout alerts sent to partners.';
  }
  if (review === 'no-show') {
    return 'customer and partner alerts created when operations marks a booking as no-show.';
  }
  if (review === 'onesignal') {
    return 'notifications that attempted OS push delivery through OneSignal.';
  }
  if (review === 'in-app-route') {
    return 'notifications intentionally kept in the app inbox route.';
  }
  return 'all notification records.';
}

export function emptyNotificationMessage(
  review: string,
  booking: string | undefined,
  shortId: (value: string) => string,
) {
  if (booking) {
    return `No notifications currently match booking ${shortId(booking)}. Confirm the booking created an alert row before retrying delivery.`;
  }
  if (!review) {
    return 'No notifications loaded.';
  }
  return `No notifications currently match this queue. ${notificationFilterDescription(review)}`;
}

function countDeliveries(notifications: readonly AdminNotification[], status: string) {
  return notifications.reduce(
    (total, notification) =>
      total + (notification.deliveries ?? []).filter((delivery) => delivery.status === status).length,
    0,
  );
}

function countDisabledDevices(notifications: readonly AdminNotification[]) {
  const ids = new Set<string>();
  for (const notification of notifications) {
    for (const delivery of notification.deliveries ?? []) {
      if (delivery.pushDevice?.enabled === false) {
        ids.add(delivery.pushDevice.id ?? `${notification.id}-${delivery.id ?? delivery.attemptedAt}`);
      }
    }
  }
  return ids.size;
}

function hasRetrySignal(notification: AdminNotification) {
  return (notification.deliveries ?? []).some(
    (delivery) => delivery.status === 'FAILED' || delivery.pushDevice?.enabled === false,
  );
}

function notificationMatchesReview(notification: AdminNotification, review: string) {
  const deliveries = notification.deliveries ?? [];
  if (!review) {
    return true;
  }
  if (review === 'failed') {
    return deliveries.some((delivery) => delivery.status === 'FAILED');
  }
  if (review === 'disabled-device') {
    return deliveries.some((delivery) => delivery.pushDevice?.enabled === false);
  }
  if (review === 'needs-retry') {
    return hasRetrySignal(notification);
  }
  if (review === 'skipped') {
    return deliveries.some((delivery) => delivery.status === 'SKIPPED');
  }
  if (review === 'sent') {
    return deliveries.some((delivery) => delivery.status === 'SENT');
  }
  if (review === 'pending') {
    return deliveries.length === 0;
  }
  if (review === 'payout-setup') {
    return notification.type === 'provider.payout_setup_required';
  }
  if (review === 'partner-alerts') {
    return isPartnerAlertType(notification.type);
  }
  if (review === 'no-show') {
    return notification.type === 'booking.no_show';
  }
  if (review === 'onesignal') {
    return deliveries.some((delivery) => delivery.provider === 'ONESIGNAL');
  }
  if (review === 'in-app-route') {
    return deliveries.some((delivery) => delivery.provider === 'IN_APP_ONLY');
  }
  return true;
}

function notificationBookingId(notification: AdminNotification) {
  const data = asRecord(notification.data);
  return readString(data?.bookingId) ?? '';
}

function isPartnerAlertType(type: string) {
  return PARTNER_ALERT_TYPE_SET.has(type);
}

function policyOptionLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return 'Not configured';
  }
  const value = String(setting.value);
  return setting.options?.find((option) => option.value === value)?.label ?? value;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
