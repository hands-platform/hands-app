import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import type { ActionMenuItem } from '../../components/action-menu';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatDateTime, formatRelativeTime, shortId } from '../../lib/admin-format';
import { readSearchParam } from '../../lib/date-range';
import {
  enablePushDeviceConfirmHref,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';
import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
} from './notification-delivery-response';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';
import type { NotificationDeliveryRow, NotificationTableRow } from './notifications-table-section';

const PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
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
  readonly fcmDeliveries: number;
  readonly partnerAlertCount: number;
  readonly policyLabel: string;
};

export const notificationFilterLinks = [
  { label: 'All notifications', href: '/notifications', review: '' },
  { label: 'Failed sends', href: '/notifications?review=failed', review: 'failed' },
  {
    label: 'Disabled devices',
    href: '/notifications?review=disabled-device',
    review: 'disabled-device',
  },
  { label: 'Needs retry', href: '/notifications?review=needs-retry', review: 'needs-retry' },
  { label: 'Skipped', href: '/notifications?review=skipped', review: 'skipped' },
  { label: 'Sent', href: '/notifications?review=sent', review: 'sent' },
  { label: 'Pending', href: '/notifications?review=pending', review: 'pending' },
  {
    label: 'Payout setup',
    href: '/notifications?review=payout-setup',
    review: 'payout-setup',
  },
  {
    label: 'Partner alerts',
    href: '/notifications?review=partner-alerts',
    review: 'partner-alerts',
  },
  { label: 'No-show', href: '/notifications?review=no-show', review: 'no-show' },
  { label: 'FCM', href: '/notifications?review=fcm', review: 'fcm' },
  { label: 'In-app route', href: '/notifications?review=in-app-route', review: 'in-app-route' },
] as const;

export function buildNotificationFilters(params: Record<string, string | string[] | undefined>) {
  return {
    review: readSearchParam(params.review),
    booking: readSearchParam(params.booking),
  };
}

export function sortNotifications(notifications: AdminNotification[]) {
  return [...notifications].sort((left, right) => {
    const signalDiff = notificationPriority(right) - notificationPriority(left);
    if (signalDiff !== 0) {
      return signalDiff;
    }
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export function buildNotificationTableRows(
  notifications: readonly AdminNotification[],
): NotificationTableRow[] {
  return notifications.map((notification) => {
    const partnerProfile = notification.user?.providerProfile;
    const partnerLabel = partnerProfile
      ? `Partner ${
          partnerProfile.displayName
            ? marketplaceDisplayText(partnerProfile.displayName)
            : shortId(partnerProfile.id)
        }`
      : null;

    return {
      actionLabel: `Notification actions for ${shortId(notification.id)}`,
      actions: notificationActionMenuItems(notification),
      body: marketplaceDisplayText(notification.body),
      bookingDataHint: notificationDataHint(notification),
      createdAtLabel: formatDateTime(notification.createdAt),
      deliveryRows: buildNotificationDeliveryRows(notification),
      id: notification.id,
      opsHint: opsHint(notification),
      opsSignal: opsSignal(notification),
      partnerHref: partnerProfile ? `/partners/${partnerProfile.id}` : null,
      partnerLabel,
      partnerStatus: partnerProfile?.status ?? null,
      relativeCreatedAtLabel: formatRelativeTime(notification.createdAt, { justNow: 'Updated just now' }),
      signalClassName: signalClass(notification),
      title: marketplaceDisplayText(notification.title),
      typeLabel: marketplaceDisplayText(humanizeType(notification.type)),
      typeMeaning: typeMeaning(notification.type),
      userLabel: notificationUserLabel(notification),
      userPhone: notification.user?.phone ?? 'No phone on file',
    };
  });
}

export function buildNotificationSummary(notifications: readonly AdminNotification[]): NotificationSummary {
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
    inAppDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'IN_APP_ONLY')).length,
    fcmDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'FCM')).length,
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
  if (review === 'fcm') {
    return 'notifications that attempted OS push delivery through FCM.';
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

function buildNotificationDeliveryRows(notification: AdminNotification): NotificationDeliveryRow[] {
  return (notification.deliveries ?? []).map((delivery) => ({
    attemptedAtLabel: formatDateTime(delivery.attemptedAt),
    deviceStateLabel: delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled',
    enableDeviceHref:
      delivery.pushDevice?.enabled === false && delivery.pushDevice.id
        ? enablePushDeviceConfirmHref(delivery.pushDevice.id)
        : null,
    failureCodeLabel: notificationDeliveryFailureCode(delivery) ?? '-',
    failureReasonLabel: notificationDeliveryFailureReason(delivery) ?? '-',
    httpStatusLabel: String(delivery.response?.statusCode ?? '-'),
    id: delivery.id ?? `${notification.id}-${delivery.attemptedAt}`,
    platformLabel: delivery.pushDevice?.platform ?? 'device',
    provider: delivery.provider,
    status: delivery.status,
  }));
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
  return hasDeliveryStatus(notification, 'FAILED') || hasDisabledPushDevice(notification);
}

function notificationPriority(notification: AdminNotification) {
  if (hasDeliveryStatus(notification, 'FAILED')) {
    return 4;
  }
  if (hasDisabledPushDevice(notification)) {
    return 3;
  }
  if (hasDeliveryStatus(notification, 'SKIPPED')) {
    return 2;
  }
  if (hasDeliveryStatus(notification, 'SENT')) {
    return 1;
  }
  return 0;
}

function notificationActionMenuItems(notification: AdminNotification): readonly ActionMenuItem[] {
  const bookingId = notificationBookingId(notification);
  const partnerId = notification.user?.providerProfile?.id ?? '';
  const actions: ActionMenuItem[] = [];

  if (bookingId) {
    actions.push({
      href: `/bookings/${bookingId}`,
      kind: 'link',
      label: 'Open booking',
      tone: 'neutral',
    });
  }

  if (partnerId) {
    actions.push({
      href: `/partners/${partnerId}`,
      kind: 'link',
      label: 'Open Partner',
      tone: 'neutral',
    });
  }

  actions.push({
    description: hasRetrySignal(notification)
      ? 'Review the delivery issue before retrying this notification.'
      : 'Retry only if operations needs to resend this alert.',
    href: retryNotificationConfirmHref(notification.id),
    kind: 'link',
    label: 'Retry',
    tone: hasRetrySignal(notification) ? 'warning' : 'info',
  });

  return actions;
}

function humanizeType(type: string) {
  return type
    .toLowerCase()
    .split(/[_\-.]/g)
    .map((part) => (part === 'backup' ? 'Marketplace' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function notificationUserLabel(notification: AdminNotification) {
  const label = notification.user?.fullName ?? notification.user?.phone ?? '-';
  return notification.user?.providerProfile ? marketplaceDisplayText(label) : label;
}

function typeMeaning(type: string) {
  if (type.includes('no_show')) {
    return 'No-show support review alert';
  }
  if (type.includes('booking')) {
    return 'Booking lifecycle alert';
  }
  if (type.includes('payment')) {
    return 'Payment or refund alert';
  }
  if (type.includes('payout_batch')) {
    return 'Partner payout batch lifecycle alert';
  }
  if (type.includes('payout') || type.includes('tax')) {
    return 'Partner tax or payout setup alert';
  }
  if (type.includes('chat')) {
    return 'Realtime conversation alert';
  }
  return 'Operational customer or partner alert';
}

function notificationDataHint(notification: AdminNotification) {
  const data = asRecord(notification.data);
  if (isPartnerAlertType(notification.type) || data?.bookingId) {
    const parts = [];
    if (data?.bookingId) {
      parts.push(`booking ${shortId(String(data.bookingId))}`);
    }
    if (data?.providerProfileId) {
      parts.push(`partner ${shortId(String(data.providerProfileId))}`);
    }
    if (data?.payoutBatchId) {
      parts.push(`payout batch ${shortId(String(data.payoutBatchId))}`);
    }
    if (data?.distanceMeters !== undefined && data?.distanceMeters !== null) {
      parts.push(`distance ${formatMeters(data.distanceMeters)}`);
    }
    if (data?.backupProviderRadiusMeters !== undefined && data?.backupProviderRadiusMeters !== null) {
      parts.push(`marketplace radius ${formatMeters(data.backupProviderRadiusMeters)}`);
    }
    if (data?.backupOpenMode) {
      parts.push(`marketplace mode ${String(data.backupOpenMode)}`);
    }
    if (parts.length > 0) {
      return parts.join(' / ');
    }
  }

  if (notification.type !== 'provider.payout_setup_required') {
    return null;
  }
  const missing = asRecord(data?.missing);
  if (!missing) {
    return 'Missing payout setup details were not included.';
  }
  const parts = [];
  if (missing.taxProfileApproved === true) {
    parts.push('tax profile approval');
  }
  if (missing.residentialAddress === true) {
    parts.push('residential address');
  }
  if (Array.isArray(missing.agreements) && missing.agreements.length > 0) {
    parts.push(`agreements: ${missing.agreements.map(String).join(', ')}`);
  }
  return parts.length ? `Missing: ${parts.join(' / ')}` : 'Payout setup appears complete.';
}

function formatMeters(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return String(value);
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${Math.round(amount).toLocaleString()} m`;
}

function notificationMatchesReview(notification: AdminNotification, review: string) {
  const deliveries = notification.deliveries ?? [];
  if (!review) {
    return true;
  }
  if (review === 'failed') {
    return hasDeliveryStatus(notification, 'FAILED');
  }
  if (review === 'disabled-device') {
    return hasDisabledPushDevice(notification);
  }
  if (review === 'needs-retry') {
    return hasRetrySignal(notification);
  }
  if (review === 'skipped') {
    return hasDeliveryStatus(notification, 'SKIPPED');
  }
  if (review === 'sent') {
    return hasDeliveryStatus(notification, 'SENT');
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
  if (review === 'fcm') {
    return hasDeliveryProvider(notification, 'FCM');
  }
  if (review === 'in-app-route') {
    return hasDeliveryProvider(notification, 'IN_APP_ONLY');
  }
  return true;
}

function notificationBookingId(notification: AdminNotification) {
  const data = asRecord(notification.data);
  return readString(data?.bookingId) ?? '';
}

function signalClass(notification: AdminNotification) {
  if (hasDeliveryStatus(notification, 'FAILED')) {
    return 'signal signal-warn';
  }
  if (hasDisabledPushDevice(notification)) {
    return 'signal signal-warn';
  }
  if (hasDeliveryStatus(notification, 'SENT')) {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(notification: AdminNotification) {
  if (hasDeliveryStatus(notification, 'FAILED')) {
    return 'Retry needed';
  }
  if (hasDisabledPushDevice(notification)) {
    return 'Device disabled';
  }
  if (hasDeliveryStatus(notification, 'SKIPPED')) {
    return 'Skipped delivery';
  }
  if (hasDeliveryStatus(notification, 'SENT')) {
    return 'Delivered';
  }
  return 'Pending';
}

function opsHint(notification: AdminNotification) {
  if (hasDeliveryStatus(notification, 'FAILED')) {
    return 'Review failure code, confirm token health, then retry only after the device path makes sense.';
  }
  if (hasDisabledPushDevice(notification)) {
    return 'This user has at least one disabled push device. Re-enable only if a fresh token arrives.';
  }
  if (hasDeliveryStatus(notification, 'SKIPPED')) {
    return 'Skipped alerts usually mean no available push path or a delivery decision to avoid duplicate sends.';
  }
  if (hasDeliveryStatus(notification, 'SENT')) {
    return 'Delivery path is healthy. Use this row as a reference if the user still reports a miss.';
  }
  return 'Notification exists, but no delivery attempt was captured yet.';
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

function hasDeliveryStatus(notification: AdminNotification, status: string) {
  return (notification.deliveries ?? []).some((delivery) => delivery.status === status);
}

function hasDisabledPushDevice(notification: AdminNotification) {
  return (notification.deliveries ?? []).some((delivery) => delivery.pushDevice?.enabled === false);
}

function hasDeliveryProvider(notification: AdminNotification, provider: string) {
  return (notification.deliveries ?? []).some((delivery) => isDeliveryProvider(delivery, provider));
}

function isDeliveryProvider(
  delivery: NonNullable<AdminNotification['deliveries']>[number],
  provider: string,
) {
  return delivery.provider === provider;
}
