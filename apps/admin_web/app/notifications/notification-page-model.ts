import type { AdminNotification, AdminOperationalPolicySetting } from '../../lib/admin-api';
import type { AdminPageMetric } from '../../components/admin-page-template';
import type { ActionMenuItem } from '../../components/action-menu';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { formatDateTime, formatRelativeTime, shortId } from '../../lib/admin-format';
import {
  isStaleNotificationPushDeviceDelivery,
  notificationPushDeviceFreshnessLabel,
  STALE_PUSH_DEVICE_AGE_DAYS,
} from '../../lib/admin-notification-push-device';
import { readSearchParam } from '../../lib/date-range';
import {
  ADMIN_PARTNER_ALERT_LEGACY_OS_PUSH_FOR_ALL_BOOKINGS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerAlertChannelRoutesToFcm,
} from '../../lib/operations-policy';
import {
  buildNotificationActionConfirmation,
  enablePushDeviceConfirmHref,
  readNotificationConfirmationAction,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';
import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
} from './notification-delivery-response';
import type { NotificationDeliveryRow } from './notification-delivery-cell';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';
import type { NotificationTableRow } from './notification-table-row';

type AdminNotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];

type NotificationPageParams = Record<string, string | string[] | undefined>;

type BuildNotificationPageModelInput = {
  readonly notifications: readonly AdminNotification[];
  readonly operationalPolicies: readonly AdminOperationalPolicySetting[];
  readonly params: NotificationPageParams;
};

const PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const;
const PARTNER_ALERT_TYPE_SET: ReadonlySet<string> = new Set(PARTNER_ALERT_TYPES);
const notificationReviewDescriptions: Readonly<Record<string, string>> = {
  'disabled-device': 'users or partners with disabled push devices.',
  failed: 'delivery attempts that returned an FCM push failure.',
  fcm: 'notifications that attempted FCM push delivery.',
  'in-app-route': 'notifications intentionally kept in the app inbox route.',
  'needs-retry': 'notifications whose delivery path should be reviewed before retry.',
  'no-show': 'customer and partner alerts created when operations marks a booking as no-show.',
  'partner-alerts': 'booking and payout alerts sent to partners.',
  'payout-setup': 'partners who earned revenue and now need tax/address/agreement setup before payout.',
  pending: 'notifications without a captured delivery attempt yet.',
  sent: 'successfully delivered push notifications.',
  skipped: 'alerts that were intentionally skipped or had no available send path.',
  'stale-device': 'delivery attempts made with old push token timestamps.',
};
const notificationReviewMatchers: Readonly<Record<string, (notification: AdminNotification) => boolean>> = {
  'disabled-device': hasDisabledPushDevice,
  failed: (notification) => hasDeliveryStatus(notification, 'FAILED'),
  fcm: (notification) => hasDeliveryProvider(notification, 'FCM'),
  'in-app-route': (notification) => hasDeliveryProvider(notification, 'IN_APP_ONLY'),
  'needs-retry': hasRetrySignal,
  'no-show': (notification) => notification.type === 'booking.no_show',
  'partner-alerts': (notification) => isPartnerAlertType(notification.type),
  'payout-setup': (notification) => notification.type === 'provider.payout_setup_required',
  pending: hasNoDeliveryAttempts,
  sent: (notification) => hasDeliveryStatus(notification, 'SENT'),
  skipped: (notification) => hasDeliveryStatus(notification, 'SKIPPED'),
  'stale-device': hasStalePushDeviceDelivery,
};

export type NotificationSummary = {
  readonly disabledDevices: number;
  readonly failed: number;
  readonly needsRetry: number;
  readonly noShow: number;
  readonly payoutSetup: number;
  readonly pending: number;
  readonly sent: number;
  readonly skipped: number;
  readonly staleDevices: number;
};

export type NotificationChannelSummary = {
  readonly inAppDeliveries: number;
  readonly fcmDeliveries: number;
  readonly partnerAlertCount: number;
  readonly policyLabel: string;
};

export type NotificationDeliveryStats = {
  readonly disabledDevices: number;
  readonly failedDeliveries: number;
  readonly failedNotifications: number;
  readonly pendingNotifications: number;
  readonly sentDeliveries: number;
  readonly skippedDeliveries: number;
  readonly skippedNotifications: number;
  readonly stalePushDeviceDeliveries: number;
};

export type NotificationPartnerAlertSmokeFallback = {
  readonly partnerAlertNotificationId: string;
  readonly partnerAlertType: string;
  readonly partnerAlertTypeLabel: string;
  readonly preflightCommand: string | null;
  readonly suggestedNotificationId: string | null;
  readonly suggestedType: string | null;
  readonly detail: string;
};

export const notificationFilterLinks = [
  { label: 'All notifications', href: '/notifications', review: '' },
  { label: 'Failed sends', href: '/notifications?review=failed', review: 'failed' },
  {
    label: 'Disabled devices',
    href: '/notifications?review=disabled-device',
    review: 'disabled-device',
  },
  {
    label: 'Stale devices',
    href: '/notifications?review=stale-device',
    review: 'stale-device',
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

export function buildNotificationPageModel({
  notifications: rawNotifications,
  operationalPolicies,
  params,
}: BuildNotificationPageModelInput) {
  const filters = buildNotificationFilters(params);
  const allNotifications = sortNotifications(rawNotifications);
  const notifications = filterNotifications(allNotifications, filters);
  const summary = buildNotificationSummary(allNotifications);
  const channelSummary = buildNotificationChannelSummary(allNotifications, operationalPolicies);
  const partnerAlertSmokeFallback = buildNotificationPartnerAlertSmokeFallback(
    allNotifications,
    operationalPolicies,
  );
  const activeFilter = notificationFilterLinks.find((item) => item.review === filters.review);

  return {
    activeBookingId: filters.booking,
    activeFilter,
    allNotifications,
    channelSummary,
    confirmation: buildNotificationActionConfirmation(
      allNotifications,
      readNotificationConfirmationAction(readSearchParam(params.confirm)),
      {
        notificationId: readSearchParam(params.notificationId),
        pushDeviceId: readSearchParam(params.pushDeviceId),
      },
    ),
    filters,
    metrics: buildNotificationMetrics(allNotifications.length, summary, channelSummary),
    notificationRows: buildNotificationTableRows(notifications),
    notifications,
    opsQueue: buildNotificationDeliveryOpsQueue(allNotifications),
    partnerAlertSmokeFallback,
    summary,
  };
}

export function buildNotificationMetrics(
  totalCount: number,
  summary: NotificationSummary,
  channelSummary: NotificationChannelSummary,
): readonly AdminPageMetric[] {
  return [
    { label: 'Total', value: totalCount, helper: 'Notification rows loaded.' },
    { label: 'Needs retry', value: summary.needsRetry, helper: 'Failed or disabled delivery paths.' },
    { label: 'Sent', value: summary.sent, helper: 'Successful push delivery attempts.' },
    { label: 'Skipped', value: summary.skipped, helper: 'Intentionally skipped delivery attempts.' },
    { label: 'Pending', value: summary.pending, helper: 'Rows without delivery attempts.' },
    { label: 'Failed', value: summary.failed, helper: 'Push failures needing review.' },
    { label: 'Disabled devices', value: summary.disabledDevices, helper: 'Push devices disabled.' },
    { label: 'Stale devices', value: summary.staleDevices, helper: 'Old token timestamps at send.' },
    { label: 'Payout setup', value: summary.payoutSetup, helper: 'Partner payout setup alerts.' },
    {
      label: 'Partner alerts',
      value: channelSummary.partnerAlertCount,
      helper: 'Partner-facing alerts.',
    },
    { label: 'No-show alerts', value: summary.noShow, helper: 'No-show support review alerts.' },
    { label: 'FCM route', value: channelSummary.fcmDeliveries, helper: 'FCM push attempts.' },
  ];
}

export function sortNotifications(notifications: readonly AdminNotification[]) {
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
  const deliveryStats = buildNotificationDeliveryStats(notifications);

  return {
    disabledDevices: deliveryStats.disabledDevices,
    failed: deliveryStats.failedDeliveries,
    needsRetry: notifications.filter((notification) => hasRetrySignal(notification)).length,
    noShow: notifications.filter((notification) => notification.type === 'booking.no_show').length,
    payoutSetup: notifications.filter(
      (notification) => notification.type === 'provider.payout_setup_required',
    ).length,
    pending: deliveryStats.pendingNotifications,
    sent: deliveryStats.sentDeliveries,
    skipped: deliveryStats.skippedDeliveries,
    staleDevices: deliveryStats.stalePushDeviceDeliveries,
  };
}

export function buildNotificationDeliveryStats(
  notifications: readonly AdminNotification[],
): NotificationDeliveryStats {
  return {
    disabledDevices: countDisabledDevices(notifications),
    failedDeliveries: countDeliveries(notifications, 'FAILED'),
    failedNotifications: countNotificationsWithDeliveryStatus(notifications, 'FAILED'),
    pendingNotifications: countPendingNotifications(notifications),
    sentDeliveries: countDeliveries(notifications, 'SENT'),
    skippedDeliveries: countDeliveries(notifications, 'SKIPPED'),
    skippedNotifications: countNotificationsWithDeliveryStatus(notifications, 'SKIPPED'),
    stalePushDeviceDeliveries: countStalePushDeviceDeliveries(notifications),
  };
}

export function buildNotificationDeliveryOpsQueue(
  notifications: readonly AdminNotification[],
): NotificationDeliveryOpsQueueItem[] {
  const deliveryStats = buildNotificationDeliveryStats(notifications);
  const queueItems: NotificationDeliveryOpsQueueItem[] = [
    {
      count: deliveryStats.failedNotifications,
      detail: 'Push provider returned an error. Check failure reason, token freshness, and credentials.',
      href: '/notifications?review=failed',
      key: 'failed',
      label: 'Failed sends',
      tone: 'pill-warn',
    },
    {
      count: deliveryStats.disabledDevices,
      detail: 'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
      href: '/notifications?review=disabled-device',
      key: 'disabled-devices',
      label: 'Disabled devices',
      tone: 'pill-warn',
    },
    {
      count: deliveryStats.stalePushDeviceDeliveries,
      detail: `Push token timestamp is ${STALE_PUSH_DEVICE_AGE_DAYS}+ days old at delivery attempt. Confirm the app has refreshed its FCM token before retrying.`,
      href: '/notifications?review=stale-device',
      key: 'stale-devices',
      label: 'Stale devices',
      tone: 'pill-warn',
    },
    {
      count: deliveryStats.skippedNotifications,
      detail:
        'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
      href: '/notifications?review=skipped',
      key: 'skipped',
      label: 'Skipped',
      tone: 'pill-info',
    },
    {
      count: deliveryStats.pendingNotifications,
      detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
      href: '/notifications?review=pending',
      key: 'pending',
      label: 'Pending',
      tone: 'pill-neutral',
    },
  ];

  return queueItems.filter((item) => item.count > 0);
}

export function buildNotificationChannelSummary(
  notifications: readonly AdminNotification[],
  operationalPolicies: readonly AdminOperationalPolicySetting[],
): NotificationChannelSummary {
  const partnerAlertPolicy = findPartnerAlertPolicy(operationalPolicies);
  const partnerAlerts = notifications.filter((notification) => isPartnerAlertType(notification.type));
  const deliveries = notifications.flatMap(notificationDeliveries);
  return {
    inAppDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'IN_APP_ONLY')).length,
    fcmDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'FCM')).length,
    partnerAlertCount: partnerAlerts.length,
    policyLabel: policyOptionLabel(partnerAlertPolicy),
  };
}

export function buildNotificationPartnerAlertSmokeFallback(
  notifications: readonly AdminNotification[],
  operationalPolicies: readonly AdminOperationalPolicySetting[],
): NotificationPartnerAlertSmokeFallback | null {
  const partnerAlertPolicy = findPartnerAlertPolicy(operationalPolicies);
  if (adminPartnerAlertChannelRoutesToFcm(partnerAlertPolicy?.value)) {
    return null;
  }

  const partnerAlert = newestNotifications(
    notifications.filter(
      (notification) =>
        isProviderNotification(notification) &&
        isPartnerAlertType(notification.type) &&
        hasDeliveryProvider(notification, 'IN_APP_ONLY'),
    ),
  )[0];
  if (!partnerAlert) {
    return null;
  }

  const suggestedNotification = newestNotifications(
    notifications.filter(
      (notification) =>
        notification.id !== partnerAlert.id &&
        isSameNotificationUser(notification, partnerAlert) &&
        !isPartnerAlertType(notification.type),
    ),
  )[0];

  return {
    partnerAlertNotificationId: partnerAlert.id,
    partnerAlertType: partnerAlert.type,
    partnerAlertTypeLabel: marketplaceDisplayText(humanizeType(partnerAlert.type)),
    preflightCommand: suggestedNotification
      ? smokeFallbackPreflightCommand(suggestedNotification, partnerAlert)
      : null,
    suggestedNotificationId: suggestedNotification?.id ?? null,
    suggestedType: suggestedNotification?.type ?? null,
    detail: suggestedNotification
      ? `Use FCM_SMOKE_NOTIFICATION_ID=${suggestedNotification.id} for the same Partner/phone FCM smoke preflight.`
      : 'Create or select a standard notification for the same Partner before expecting FCM smoke to pass.',
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
  return notificationReviewDescriptions[review] ?? 'all notification records.';
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
  return newestDeliveries(notificationDeliveries(notification)).map((delivery) => ({
    attemptedAtLabel: formatDateTime(delivery.attemptedAt),
    deviceFreshnessLabel: notificationPushDeviceFreshnessLabel(delivery),
    deviceLastSeenAtLabel: delivery.pushDevice?.lastSeenAt
      ? formatDateTime(delivery.pushDevice.lastSeenAt)
      : '-',
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
    statusClassName: deliveryStatusClassName(delivery.status),
  }));
}

function countDeliveries(notifications: readonly AdminNotification[], status: string) {
  return notifications.reduce(
    (total, notification) =>
      total + notificationDeliveries(notification).filter((delivery) => delivery.status === status).length,
    0,
  );
}

function countNotificationsWithDeliveryStatus(notifications: readonly AdminNotification[], status: string) {
  return notifications.filter((notification) => hasDeliveryStatus(notification, status)).length;
}

function deliveryStatusClassName(status: string) {
  if (status === 'FAILED') {
    return 'pill pill-warn';
  }
  if (status === 'SENT') {
    return 'pill pill-success';
  }
  if (status === 'SKIPPED') {
    return 'pill pill-info';
  }
  return 'pill pill-neutral';
}

function deliveryAttemptMs(delivery: AdminNotificationDelivery) {
  const value = Date.parse(delivery.attemptedAt);
  return Number.isFinite(value) ? value : 0;
}

function countDisabledDevices(notifications: readonly AdminNotification[]) {
  const ids = new Set<string>();
  for (const notification of notifications) {
    for (const delivery of notificationDeliveries(notification)) {
      if (delivery.pushDevice?.enabled === false) {
        ids.add(delivery.pushDevice.id ?? `${notification.id}-${delivery.id ?? delivery.attemptedAt}`);
      }
    }
  }
  return ids.size;
}

function countPendingNotifications(notifications: readonly AdminNotification[]) {
  return notifications.filter(hasNoDeliveryAttempts).length;
}

function countStalePushDeviceDeliveries(notifications: readonly AdminNotification[]) {
  return notifications.reduce(
    (total, notification) =>
      total + notificationDeliveries(notification).filter(isStaleNotificationPushDeviceDelivery).length,
    0,
  );
}

function hasStalePushDeviceDelivery(notification: AdminNotification) {
  return notificationDeliveries(notification).some(isStaleNotificationPushDeviceDelivery);
}

export { isStaleNotificationPushDeviceDelivery as isStalePushDeviceDelivery };

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
  if (!review) {
    return true;
  }
  return notificationReviewMatchers[review]?.(notification) ?? true;
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
  if (hasStalePushDeviceDelivery(notification)) {
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
  if (hasStalePushDeviceDelivery(notification)) {
    return 'Stale device';
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
  if (hasStalePushDeviceDelivery(notification)) {
    return 'Push token timestamp is old. Ask the user to open the app so FCM can refresh before relying on retry.';
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

function isProviderNotification(notification: AdminNotification) {
  return (
    Boolean(notification.user?.providerProfile) ||
    (notification.user?.roles ?? []).map((role) => role.toUpperCase()).includes('PROVIDER')
  );
}

function isSameNotificationUser(left: AdminNotification, right: AdminNotification) {
  if (left.user?.id && right.user?.id) {
    return left.user.id === right.user.id;
  }
  return Boolean(left.user?.phone && right.user?.phone && left.user.phone === right.user.phone);
}

function newestNotifications(notifications: readonly AdminNotification[]) {
  return [...notifications].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function smokeFallbackPreflightCommand(
  suggestedNotification: AdminNotification,
  partnerAlert: AdminNotification,
) {
  const phone = suggestedNotification.user?.phone ?? partnerAlert.user?.phone ?? '<provider phone>';
  const platform = latestDeliveryPlatform(suggestedNotification) ?? 'android';
  return [
    '$env:FCM_SMOKE_ROLE="PROVIDER"',
    `$env:FCM_SMOKE_PHONE="${phone}"`,
    `$env:FCM_SMOKE_PLATFORM="${platform}"`,
    '$env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"',
    '$env:FCM_SMOKE_EXPECT_PROVIDER="FCM"',
    '$env:FCM_SMOKE_EXPECT_STATUS="SENT"',
    `$env:FCM_SMOKE_NOTIFICATION_ID="${suggestedNotification.id}"`,
    'npm.cmd run fcm:push-smoke -- --preflight',
  ].join('; ');
}

function latestDeliveryPlatform(notification: AdminNotification) {
  return newestDeliveries(notificationDeliveries(notification))[0]?.pushDevice?.platform;
}

function findPartnerAlertPolicy(operationalPolicies: readonly AdminOperationalPolicySetting[]) {
  return operationalPolicies.find((setting) => setting.key === OPERATIONAL_POLICY_KEYS.partnerAlertChannel);
}

function policyOptionLabel(setting?: AdminOperationalPolicySetting) {
  if (!setting) {
    return 'Not configured';
  }
  const value = String(setting.value);
  if (value === ADMIN_PARTNER_ALERT_LEGACY_OS_PUSH_FOR_ALL_BOOKINGS) {
    return 'FCM for all bookings (legacy saved value)';
  }
  return setting.options?.find((option) => option.value === value)?.label ?? value;
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function hasDeliveryStatus(notification: AdminNotification, status: string) {
  return notificationDeliveries(notification).some((delivery) => delivery.status === status);
}

function hasDisabledPushDevice(notification: AdminNotification) {
  return notificationDeliveries(notification).some((delivery) => delivery.pushDevice?.enabled === false);
}

function hasDeliveryProvider(notification: AdminNotification, provider: string) {
  return notificationDeliveries(notification).some((delivery) => isDeliveryProvider(delivery, provider));
}

function hasNoDeliveryAttempts(notification: AdminNotification) {
  return notificationDeliveries(notification).length === 0;
}

function notificationDeliveries(notification: AdminNotification): readonly AdminNotificationDelivery[] {
  return notification.deliveries ?? [];
}

function newestDeliveries(deliveries: readonly AdminNotificationDelivery[]) {
  return [...deliveries].sort((left, right) => deliveryAttemptMs(right) - deliveryAttemptMs(left));
}

function isDeliveryProvider(delivery: AdminNotificationDelivery, provider: string) {
  return delivery.provider === provider;
}
