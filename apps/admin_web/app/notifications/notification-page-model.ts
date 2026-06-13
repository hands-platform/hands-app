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
  type NotificationActionReturnContext,
  readNotificationConfirmationAction,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';
import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
  notificationDeliveryRecoveryHint,
} from './notification-delivery-response';
import type { NotificationDeliveryRow } from './notification-delivery-cell';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';
import type { NotificationTableRow } from './notification-table-row';

type AdminNotificationDelivery = NonNullable<AdminNotification['deliveries']>[number];
type AdminNotificationPushDevice = NonNullable<NonNullable<AdminNotification['user']>['pushDevices']>[number];

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
  'disabled-device': 'customers or Partners with disabled push devices.',
  failed: 'latest delivery attempts that returned an FCM push failure.',
  fcm: 'notifications that attempted FCM push delivery.',
  'in-app-route': 'notifications intentionally kept in the app inbox route.',
  'needs-retry': 'notifications whose delivery path should be reviewed before retry.',
  'no-show': 'customer and Partner alerts created when operations marks a booking as no-show.',
  'partner-alerts': 'booking and payout alerts sent to Partners.',
  'payout-setup': 'Partners who earned revenue and now need tax/address/agreement setup before payout.',
  pending: 'notifications without a captured delivery attempt yet.',
  sent: 'notifications whose latest push attempt was delivered successfully.',
  skipped: 'notifications whose latest push attempt was intentionally skipped or had no available send path.',
  'stale-device': 'delivery attempts made with old push token timestamps.',
};

export type NotificationReviewRunbook = {
  readonly detail: string;
  readonly primaryAction: string;
  readonly title: string;
};

const notificationReviewRunbooks: Readonly<Record<string, NotificationReviewRunbook>> = {
  'disabled-device': {
    detail:
      'A push device on this queue is disabled. Recovery should come from a fresh app token, not from blindly reusing the old token.',
    primaryAction:
      'Ask the customer or Partner to reopen the app, run token recovery smoke when needed, then re-enable only after the token path is current.',
    title: 'Device recovery gate',
  },
  failed: {
    detail:
      'The latest send attempt failed. Treat retry as a controlled resend after checking the failure code, token freshness, and Firebase credentials.',
    primaryAction:
      'Open the row delivery evidence and audit trail, fix the blocker, then use Retry only after the delivery path is valid.',
    title: 'Retry gate',
  },
  'needs-retry': {
    detail:
      'This queue combines current failed sends and disabled device paths, so every row needs a recovery decision before resend.',
    primaryAction:
      'Resolve the device or credential signal first, then retry from the row action menu with the active queue context preserved.',
    title: 'Recovery decision gate',
  },
  pending: {
    detail:
      'These rows have no captured delivery attempt yet. Retrying before the worker path is confirmed can hide the original queue issue.',
    primaryAction:
      'Confirm API workers and delivery processing first; retry only if operations intentionally wants to create a new send attempt.',
    title: 'Worker path gate',
  },
  'stale-device': {
    detail:
      'The latest delivery used an old push token timestamp. A successful FCM response here does not prove the user has a fresh app token.',
    primaryAction:
      'Ask the user to reopen the app so the token refreshes, then prefer token recovery smoke before relying on another retry.',
    title: 'Token freshness gate',
  },
};
const notificationReviewMatchers: Readonly<Record<string, (notification: AdminNotification) => boolean>> = {
  'disabled-device': hasDisabledPushDevice,
  failed: (notification) => hasLatestDeliveryStatus(notification, 'FAILED'),
  fcm: (notification) => hasDeliveryProvider(notification, 'FCM'),
  'in-app-route': (notification) => hasDeliveryProvider(notification, 'IN_APP_ONLY'),
  'needs-retry': hasRetrySignal,
  'no-show': (notification) => notification.type === 'booking.no_show',
  'partner-alerts': (notification) => isPartnerAlertType(notification.type),
  'payout-setup': (notification) => notification.type === 'provider.payout_setup_required',
  pending: hasNoDeliveryAttempts,
  sent: (notification) => hasLatestDeliveryStatus(notification, 'SENT'),
  skipped: (notification) => hasLatestDeliveryStatus(notification, 'SKIPPED'),
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

export type NotificationFcmSmokeReadiness = {
  readonly detail: string;
  readonly deviceWarningLabel: string | null;
  readonly latestAttemptLabel: string | null;
  readonly preflightCommand: string | null;
  readonly pushDeviceLabel: string | null;
  readonly selectedNotificationId: string | null;
  readonly selectedNotificationLabel: string | null;
  readonly status: 'needs-device' | 'needs-notification' | 'ready';
  readonly statusLabel: string;
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
  const fcmSmokeReadiness = buildNotificationFcmSmokeReadiness(allNotifications);
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
        review: filters.review,
        booking: filters.booking,
      },
    ),
    filters,
    fcmSmokeReadiness,
    metrics: buildNotificationMetrics(allNotifications.length, summary, channelSummary),
    notificationRows: buildNotificationTableRows(notifications, filters),
    notifications,
    opsQueue: buildNotificationDeliveryOpsQueue(allNotifications),
    partnerAlertSmokeFallback,
    reviewRunbook: notificationReviewRunbook(filters.review),
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
    { label: 'Failed', value: summary.failed, helper: 'Current push failures needing review.' },
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
  actionContext: NotificationActionReturnContext = {},
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
      actions: notificationActionMenuItems(notification, actionContext),
      body: marketplaceDisplayText(notification.body),
      bookingDataHint: notificationDataHint(notification),
      createdAtLabel: formatDateTime(notification.createdAt),
      deliveryRows: buildNotificationDeliveryRows(notification, actionContext),
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
    failed: deliveryStats.failedNotifications,
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
      detail:
        'Latest push attempt returned an error. Check failure reason, token freshness, and credentials.',
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

export function buildNotificationFcmSmokeReadiness(
  notifications: readonly AdminNotification[],
): NotificationFcmSmokeReadiness {
  const candidate = newestFcmSmokeCandidates(notifications)[0];
  if (candidate) {
    const { delivery, notification } = candidate;
    const role = notificationSmokeRole(notification, delivery);
    const phone = notification.user?.phone ?? '';
    const platform = delivery.pushDevice?.platform ?? 'android';
    const command = [
      `$env:FCM_SMOKE_ROLE="${role}"`,
      `$env:FCM_SMOKE_PHONE="${phone}"`,
      `$env:FCM_SMOKE_PLATFORM="${platform}"`,
      '$env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"',
      '$env:FCM_SMOKE_EXPECT_PROVIDER="FCM"',
      '$env:FCM_SMOKE_EXPECT_STATUS="SENT"',
      `$env:FCM_SMOKE_NOTIFICATION_ID="${notification.id}"`,
      'npm.cmd run fcm:push-smoke -- --preflight',
    ].join('; ');

    return {
      detail: `${role === 'PROVIDER' ? 'Partner' : 'Customer'} ${phone} can reuse the enabled ${platform} device for preflight without sending FCM.`,
      deviceWarningLabel: fcmSmokeReadinessDeviceWarning(notification, delivery, role, platform),
      latestAttemptLabel: formatDateTime(delivery.attemptedAt),
      preflightCommand: command,
      pushDeviceLabel: `${platform} ${shortId(delivery.pushDevice?.id ?? '')}`,
      selectedNotificationId: notification.id,
      selectedNotificationLabel: `${marketplaceDisplayText(humanizeType(notification.type))} ${shortId(
        notification.id,
      )}`,
      status: 'ready',
      statusLabel: 'Live preflight ready',
    };
  }

  if (notifications.some((notification) => hasDeliveryProvider(notification, 'FCM'))) {
    return {
      detail:
        'FCM delivery attempts exist, but no enabled push device with a phone number is available for registered-device preflight.',
      deviceWarningLabel: null,
      latestAttemptLabel: null,
      preflightCommand: null,
      pushDeviceLabel: null,
      selectedNotificationId: null,
      selectedNotificationLabel: null,
      status: 'needs-device',
      statusLabel: 'Needs enabled device',
    };
  }

  return {
    detail: 'No FCM delivery attempt is available yet. Create or select an FCM-routed notification first.',
    deviceWarningLabel: null,
    latestAttemptLabel: null,
    preflightCommand: null,
    pushDeviceLabel: null,
    selectedNotificationId: null,
    selectedNotificationLabel: null,
    status: 'needs-notification',
    statusLabel: 'Needs FCM delivery',
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

export function notificationReviewRunbook(review: string) {
  return notificationReviewRunbooks[review] ?? null;
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

function buildNotificationDeliveryRows(
  notification: AdminNotification,
  actionContext: NotificationActionReturnContext,
): NotificationDeliveryRow[] {
  return newestDeliveries(notificationDeliveries(notification)).map((delivery) => ({
    attemptedAtLabel: formatDateTime(delivery.attemptedAt),
    deviceFreshnessLabel: notificationPushDeviceFreshnessLabel(delivery),
    deviceLastSeenAtLabel: delivery.pushDevice?.lastSeenAt
      ? formatDateTime(delivery.pushDevice.lastSeenAt)
      : '-',
    deviceStateLabel: delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled',
    enableDeviceHref:
      delivery.pushDevice?.enabled === false && delivery.pushDevice.id
        ? enablePushDeviceConfirmHref(delivery.pushDevice.id, actionContext)
        : null,
    failureCodeLabel: notificationDeliveryFailureCode(delivery) ?? '-',
    failureReasonLabel: notificationDeliveryFailureReason(delivery) ?? '-',
    httpStatusLabel: String(delivery.response?.statusCode ?? '-'),
    id: delivery.id ?? `${notification.id}-${delivery.attemptedAt}`,
    platformLabel: delivery.pushDevice?.platform ?? 'device',
    provider: delivery.provider,
    recoveryHintLabel: notificationDeliveryRecoveryHint(delivery),
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
  return notifications.filter((notification) => hasLatestDeliveryStatus(notification, status)).length;
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
  return hasLatestDeliveryStatus(notification, 'FAILED') || hasCurrentDisabledPushDevice(notification);
}

function notificationPriority(notification: AdminNotification) {
  if (hasLatestDeliveryStatus(notification, 'FAILED')) {
    return 4;
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return 3;
  }
  if (hasLatestDeliveryStatus(notification, 'SKIPPED')) {
    return 2;
  }
  if (hasLatestDeliveryStatus(notification, 'SENT')) {
    return 1;
  }
  return 0;
}

function notificationActionMenuItems(
  notification: AdminNotification,
  actionContext: NotificationActionReturnContext,
): readonly ActionMenuItem[] {
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
    description: 'Review send, retry, and device recovery audit events for this notification.',
    href: notificationAuditTrailHref(notification.id),
    kind: 'link',
    label: 'Audit trail',
    tone: 'neutral',
  });

  actions.push({
    description: hasRetrySignal(notification)
      ? 'Review the delivery issue before retrying this notification.'
      : 'Retry only if operations needs to resend this alert.',
    href: retryNotificationConfirmHref(notification.id, actionContext),
    kind: 'link',
    label: 'Retry',
    tone: hasRetrySignal(notification) ? 'warning' : 'info',
  });

  return actions;
}

function notificationAuditTrailHref(notificationId: string) {
  return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
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
  if (hasLatestDeliveryStatus(notification, 'FAILED')) {
    return 'signal signal-warn';
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return 'signal signal-warn';
  }
  if (hasStalePushDeviceDelivery(notification)) {
    return 'signal signal-warn';
  }
  if (hasLatestDeliveryStatus(notification, 'SENT')) {
    return 'signal signal-ok';
  }
  return 'signal signal-info';
}

function opsSignal(notification: AdminNotification) {
  if (hasLatestDeliveryStatus(notification, 'FAILED')) {
    return 'Retry needed';
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return 'Device disabled';
  }
  if (hasStalePushDeviceDelivery(notification)) {
    return 'Stale device';
  }
  if (hasLatestDeliveryStatus(notification, 'SKIPPED')) {
    return 'Skipped delivery';
  }
  if (hasLatestDeliveryStatus(notification, 'SENT')) {
    return 'Delivered';
  }
  return 'Pending';
}

function opsHint(notification: AdminNotification) {
  const baseHint = opsHintBase(notification);
  const latestAttemptLabel = latestDeliveryAttemptLabel(notification);
  return latestAttemptLabel ? `${baseHint} Latest attempt ${latestAttemptLabel}.` : baseHint;
}

function opsHintBase(notification: AdminNotification) {
  if (hasLatestDeliveryStatus(notification, 'FAILED')) {
    return 'Review failure code, confirm token health, then retry only after the device path makes sense.';
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return 'This user has at least one disabled push device. Re-enable only if a fresh token arrives.';
  }
  if (hasStalePushDeviceDelivery(notification)) {
    return 'Push token timestamp is old. Ask the user to open the app so FCM can refresh before relying on retry.';
  }
  if (hasLatestDeliveryStatus(notification, 'SKIPPED')) {
    return 'Skipped alerts usually mean no available push path or a delivery decision to avoid duplicate sends.';
  }
  if (hasLatestDeliveryStatus(notification, 'SENT')) {
    return 'Delivery path is healthy. Use this row as a reference if the user still reports a miss.';
  }
  return 'Notification exists, but no delivery attempt was captured yet.';
}

function latestDeliveryAttemptLabel(notification: AdminNotification) {
  const delivery = latestDelivery(notification);
  return delivery ? formatDateTime(delivery.attemptedAt) : null;
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

function newestFcmSmokeCandidates(notifications: readonly AdminNotification[]) {
  return notifications
    .flatMap((notification) =>
      notificationDeliveries(notification)
        .filter(isReusableFcmDelivery)
        .filter(() => Boolean(notification.user?.phone))
        .map((delivery) => ({ delivery, notification })),
    )
    .sort((left, right) => deliveryAttemptMs(right.delivery) - deliveryAttemptMs(left.delivery));
}

function isReusableFcmDelivery(delivery: AdminNotificationDelivery) {
  return isDeliveryProvider(delivery, 'FCM') && delivery.pushDevice?.enabled === true;
}

function fcmSmokeReadinessDeviceWarning(
  notification: AdminNotification,
  delivery: AdminNotificationDelivery,
  role: 'CUSTOMER' | 'PROVIDER',
  platform: string,
) {
  const selectedDevice = delivery.pushDevice;
  const newestMatchingDevice = newestPushDevices(notification.user?.pushDevices ?? []).find(
    (device) =>
      device.platform === platform &&
      (!device.role || device.role.toUpperCase() === role) &&
      device.id !== selectedDevice?.id,
  );

  if (
    !selectedDevice?.id ||
    !newestMatchingDevice?.id ||
    newestMatchingDevice.enabled !== false ||
    pushDeviceTimestampMs(newestMatchingDevice) <= pushDeviceTimestampMs(selectedDevice)
  ) {
    return null;
  }

  const actorLabel = role === 'PROVIDER' ? 'Partner' : 'Customer';
  return `Newer ${actorLabel} ${platform} device ${shortId(
    newestMatchingDevice.id,
  )} is disabled; preflight reuses older enabled device ${shortId(
    selectedDevice.id,
  )}. Refresh the app FCM token before broad push.`;
}

function newestPushDevices(devices: readonly AdminNotificationPushDevice[]) {
  return [...devices].sort((left, right) => pushDeviceTimestampMs(right) - pushDeviceTimestampMs(left));
}

function pushDeviceTimestampMs(device: AdminNotificationPushDevice) {
  const updatedAt = Date.parse(device.updatedAt ?? '');
  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }
  const lastSeenAt = Date.parse(device.lastSeenAt ?? '');
  if (Number.isFinite(lastSeenAt)) {
    return lastSeenAt;
  }
  const createdAt = Date.parse(device.createdAt ?? '');
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function notificationSmokeRole(
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

function hasLatestDeliveryStatus(notification: AdminNotification, status: string) {
  return latestDelivery(notification)?.status === status;
}

function hasDisabledPushDevice(notification: AdminNotification) {
  return notificationDeliveries(notification).some((delivery) => delivery.pushDevice?.enabled === false);
}

function hasCurrentDisabledPushDevice(notification: AdminNotification) {
  return latestDelivery(notification)?.pushDevice?.enabled === false;
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

function latestDelivery(notification: AdminNotification) {
  return newestDeliveries(notificationDeliveries(notification))[0];
}

function isDeliveryProvider(delivery: AdminNotificationDelivery, provider: string) {
  return delivery.provider === provider;
}
