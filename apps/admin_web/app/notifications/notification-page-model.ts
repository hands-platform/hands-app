import type {
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationalPolicySetting,
} from '../../lib/admin-api';
import type { AdminPageMetric } from '../../components/admin-page-template';
import type { ActionMenuItem } from '../../components/action-menu';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import {
  adminAvatarStatusFromSignals,
  type AdminAvatarPushDeviceSignal,
  type AdminAvatarStatus,
} from '../../lib/admin-avatar-status';
import { formatDateTime, formatRelativeTime, shortId } from '../../lib/admin-format';
import {
  isStaleNotificationPushDeviceDelivery,
  notificationPushDeviceFreshnessLabel,
  STALE_PUSH_DEVICE_AGE_DAYS,
} from '../../lib/admin-notification-push-device';
import {
  deliveryAttemptMs,
  formatFcmSentDeliveryDetail as fcmSentDeliveryDetail,
  humanizeNotificationType as humanizeType,
  isNotificationDeliveryProvider as isDeliveryProvider,
  latestFcmSentNotificationDelivery as latestFcmSentDelivery,
  newestNotificationDeliveries as newestDeliveries,
  notificationDeliveries,
  type AdminNotificationDelivery,
  type AdminNotificationPushDevice,
} from '../../lib/admin-notification-delivery';
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
import { buildFcmPushSmokeCommand } from './fcm-smoke-commands';
import { notificationReviewRunbook } from './notification-review-runbook';
import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
  notificationDeliveryRecoveryHint,
} from './notification-delivery-response';
import { notificationFailureCodeLabel } from './notification-failure-copy';
import type { NotificationDeliveryRow } from './notification-delivery-cell';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';
import type { NotificationTableRow } from './notification-table-row';

type NotificationPageParams = Record<string, string | string[] | undefined>;

type BuildNotificationPageModelInput = {
  readonly notificationSummary?: AdminNotificationBoardSummary | null;
  readonly notifications: readonly AdminNotification[];
  readonly operationalPolicies: readonly AdminOperationalPolicySetting[];
  readonly params: NotificationPageParams;
};

export type NotificationDateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d';

export type NotificationFilters = {
  readonly booking: string;
  readonly range: NotificationDateRange;
  readonly review: string;
  readonly user: string;
};

export type NotificationTablePagination = {
  readonly from: number;
  readonly page: number;
  readonly rows: readonly NotificationTableRow[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

const PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const;
const PARTNER_ALERT_TYPE_SET: ReadonlySet<string> = new Set(PARTNER_ALERT_TYPES);
const NOTIFICATION_TABLE_PAGE_SIZE = 20;
const NOTIFICATION_TABLE_DELIVERY_LIMIT = 2;
const NOTIFICATION_API_TAKE = NOTIFICATION_TABLE_PAGE_SIZE;
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_NOTIFICATION_REVIEW = 'needs-retry';

export const notificationDateRangeLinks = [
  { label: 'Today', range: 'today' },
  { label: 'Previous day', range: 'yesterday' },
  { label: 'Last 7 days', range: '7d' },
  { label: 'Last 30 days', range: '30d' },
  { label: 'All loaded', range: 'all' },
] as const satisfies readonly { label: string; range: NotificationDateRange }[];

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
  readonly latestFcmSentAttemptLabel: string | null;
  readonly latestFcmSentDetail: string | null;
  readonly partnerAlertCount: number;
  readonly policyLabel: string;
};

export type NotificationDeliveryStats = {
  readonly disabledDevices: number;
  readonly failedDeliveries: number;
  readonly failedNotifications: number;
  readonly pendingNotifications: number;
  readonly retrySignalNotifications: number;
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
  { label: 'All notifications', href: '/notifications?review=all', review: 'all' },
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
  const review = readSearchParam(params.review);
  return {
    review: review || DEFAULT_NOTIFICATION_REVIEW,
    booking: readSearchParam(params.booking),
    range: normalizeNotificationDateRange(readSearchParam(params.range)),
    user: readSearchParam(params.user),
  };
}

export function buildNotificationListHref(
  filters: {
    readonly booking: string;
    readonly range?: NotificationDateRange;
    readonly review: string;
    readonly user?: string;
  },
  options: { readonly page?: number } = {},
) {
  const query = new URLSearchParams();
  if (filters.range && filters.range !== 'today') {
    query.set('range', filters.range);
  }
  if (filters.review) {
    query.set('review', filters.review);
  }
  if (filters.booking) {
    query.set('booking', filters.booking);
  }
  if (filters.user) {
    query.set('user', filters.user);
  }
  if (options.page && options.page > 1) {
    query.set('page', String(options.page));
  }
  const value = query.toString();
  return value ? `/notifications?${value}` : '/notifications';
}

export function buildNotificationApiHref(params: Record<string, string | string[] | undefined>) {
  const filters = buildNotificationFilters(params);
  const page = readNotificationTablePage(params.page);
  const skip = (page - 1) * NOTIFICATION_API_TAKE;
  const query = new URLSearchParams({ take: String(NOTIFICATION_API_TAKE) });
  if (skip > 0) {
    query.set('skip', String(skip));
  }
  if (shouldIncludeNotificationApiReview(filters.review)) {
    query.set('review', filters.review);
  }
  if (filters.booking) {
    query.set('booking', filters.booking);
  }
  if (filters.user) {
    query.set('user', filters.user);
  }
  const window = notificationDateRangeWindow(filters.range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  return `/admin/notifications?${query.toString()}`;
}

export function buildNotificationSummaryApiHref(params: Record<string, string | string[] | undefined>) {
  const filters = buildNotificationFilters(params);
  const query = new URLSearchParams();
  if (shouldIncludeNotificationApiReview(filters.review)) {
    query.set('review', filters.review);
  }
  if (filters.booking) {
    query.set('booking', filters.booking);
  }
  if (filters.user) {
    query.set('user', filters.user);
  }
  const window = notificationDateRangeWindow(filters.range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  const value = query.toString();
  return value ? `/admin/notifications/summary?${value}` : '/admin/notifications/summary';
}

export function buildNotificationPolicyApiHref() {
  return `/admin/operational-policy?${new URLSearchParams({
    keys: OPERATIONAL_POLICY_KEYS.partnerAlertChannel,
  }).toString()}`;
}

export function notificationDateRangeLabel(range: NotificationDateRange) {
  if (range === 'today') {
    return 'Today';
  }
  if (range === 'yesterday') {
    return 'Previous day';
  }
  if (range === '7d') {
    return 'Last 7 days';
  }
  if (range === '30d') {
    return 'Last 30 days';
  }
  return 'All loaded';
}

function normalizeNotificationDateRange(value: string): NotificationDateRange {
  if (value === 'all' || value === 'today' || value === 'yesterday' || value === '7d' || value === '30d') {
    return value;
  }
  return 'today';
}

function notificationDateRangeWindow(range: NotificationDateRange, now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);

  if (range === 'today') {
    return { from: todayStart, to: tomorrowStart };
  }
  if (range === 'yesterday') {
    return { from: new Date(todayStart.getTime() - DAY_MS), to: todayStart };
  }
  if (range === '7d') {
    return { from: new Date(todayStart.getTime() - 6 * DAY_MS), to: tomorrowStart };
  }
  if (range === '30d') {
    return { from: new Date(todayStart.getTime() - 29 * DAY_MS), to: tomorrowStart };
  }
  return {};
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function buildNotificationPageModel({
  notificationSummary,
  notifications: rawNotifications,
  operationalPolicies,
  params,
}: BuildNotificationPageModelInput) {
  const filters = buildNotificationFilters(params);
  const allNotifications = sortNotifications(rawNotifications);
  const loadedCount = allNotifications.length;
  const totalCount = notificationSummary?.totalCount ?? loadedCount;
  const notifications = filterNotifications(allNotifications, filters);
  const loadedDeliveryStats = buildNotificationDeliveryStats(allNotifications);
  const deliveryStats = notificationSummary
    ? notificationDeliveryStatsFromServerSummary(notificationSummary, loadedDeliveryStats)
    : loadedDeliveryStats;
  const summary = notificationSummary
    ? notificationSummaryFromServer(notificationSummary, buildNotificationSummary(allNotifications, loadedDeliveryStats))
    : buildNotificationSummary(allNotifications, loadedDeliveryStats);
  const channelSummary = notificationChannelSummaryFromServer(
    notificationSummary,
    buildNotificationChannelSummary(allNotifications, operationalPolicies),
  );
  const partnerAlertSmokeFallback = buildNotificationPartnerAlertSmokeFallback(
    allNotifications,
    operationalPolicies,
  );
  const fcmSmokeReadiness = buildNotificationFcmSmokeReadiness(allNotifications);
  const reviewState = buildNotificationReviewState(filters.review);
  const allNotificationRows = buildNotificationTableRows(notifications, filters);
  const requestedPage = readNotificationTablePage(params.page);
  const notificationPagination = notificationSummary
    ? paginateServerNotificationRows(allNotificationRows, requestedPage, totalCount)
    : paginateNotificationRows(allNotificationRows, requestedPage);

  return {
    activeBookingId: filters.booking,
    activeFilter: reviewState.activeFilter,
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
    loadedCount,
    metrics: buildNotificationMetrics(totalCount, summary, channelSummary),
    notificationPagination,
    notificationRows: notificationPagination.rows,
    notifications,
    opsQueue: buildNotificationDeliveryOpsQueue(allNotifications, deliveryStats),
    partnerAlertSmokeFallback,
    reviewRunbook: reviewState.runbook,
    summary,
    totalCount,
  };
}

function notificationSummaryFromServer(
  serverSummary: AdminNotificationBoardSummary,
  fallback: NotificationSummary,
): NotificationSummary {
  return {
    disabledDevices: serverSummary.disabledDevices ?? fallback.disabledDevices,
    failed: serverSummary.failed ?? fallback.failed,
    needsRetry: serverSummary.needsRetry ?? fallback.needsRetry,
    noShow: serverSummary.noShow ?? fallback.noShow,
    payoutSetup: serverSummary.payoutSetup ?? fallback.payoutSetup,
    pending: serverSummary.pending ?? fallback.pending,
    sent: serverSummary.sent ?? fallback.sent,
    skipped: serverSummary.skipped ?? fallback.skipped,
    staleDevices: serverSummary.staleDevices ?? fallback.staleDevices,
  };
}

function notificationDeliveryStatsFromServerSummary(
  serverSummary: AdminNotificationBoardSummary,
  fallback: NotificationDeliveryStats,
): NotificationDeliveryStats {
  return {
    disabledDevices: serverSummary.disabledDevices ?? fallback.disabledDevices,
    failedDeliveries: serverSummary.failed ?? fallback.failedDeliveries,
    failedNotifications: serverSummary.failed ?? fallback.failedNotifications,
    pendingNotifications: serverSummary.pending ?? fallback.pendingNotifications,
    retrySignalNotifications: serverSummary.needsRetry ?? fallback.retrySignalNotifications,
    sentDeliveries: serverSummary.sent ?? fallback.sentDeliveries,
    skippedDeliveries: serverSummary.skipped ?? fallback.skippedDeliveries,
    skippedNotifications: serverSummary.skipped ?? fallback.skippedNotifications,
    stalePushDeviceDeliveries: serverSummary.staleDevices ?? fallback.stalePushDeviceDeliveries,
  };
}

function notificationChannelSummaryFromServer(
  serverSummary: AdminNotificationBoardSummary | null | undefined,
  fallback: NotificationChannelSummary,
): NotificationChannelSummary {
  if (!serverSummary) {
    return fallback;
  }
  return {
    ...fallback,
    fcmDeliveries: serverSummary.fcmDeliveries ?? fallback.fcmDeliveries,
    inAppDeliveries: serverSummary.inAppDeliveries ?? fallback.inAppDeliveries,
    partnerAlertCount: serverSummary.partnerAlertCount ?? fallback.partnerAlertCount,
  };
}

export function paginateNotificationRows(
  rows: readonly NotificationTableRow[],
  requestedPage: number,
  pageSize = NOTIFICATION_TABLE_PAGE_SIZE,
): NotificationTablePagination {
  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return {
    from: totalRows === 0 ? 0 : start + 1,
    page,
    rows: pageRows,
    to: Math.min(totalRows, start + pageRows.length),
    totalPages,
    totalRows,
  };
}

export function paginateServerNotificationRows(
  rows: readonly NotificationTableRow[],
  requestedPage: number,
  totalRows: number,
  pageSize = NOTIFICATION_TABLE_PAGE_SIZE,
): NotificationTablePagination {
  const boundedTotalRows = Math.max(0, totalRows);
  const totalPages = Math.max(1, Math.ceil(boundedTotalRows / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageStart = (page - 1) * pageSize;

  return {
    from: boundedTotalRows === 0 || rows.length === 0 ? 0 : pageStart + 1,
    page,
    rows,
    to: boundedTotalRows === 0 || rows.length === 0 ? 0 : Math.min(boundedTotalRows, pageStart + rows.length),
    totalPages,
    totalRows: boundedTotalRows,
  };
}

function readNotificationTablePage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export function buildNotificationReviewState(review: string) {
  return {
    activeFilter: notificationFilterLinks.find((item) => item.review === review),
    runbook: notificationReviewRunbook(review),
  };
}

export function buildNotificationMetrics(
  totalCount: number,
  summary: NotificationSummary,
  channelSummary: NotificationChannelSummary,
): readonly AdminPageMetric[] {
  return [
    {
      label: 'Total',
      value: totalCount,
      helper: 'Notification rows in the selected date range. The table stays bounded for operations speed.',
    },
    {
      label: 'Needs retry',
      value: summary.needsRetry,
      helper: 'Failed, disabled, or stale token delivery paths.',
    },
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
  const priorities = new Map<AdminNotification, number>();
  const priorityFor = (notification: AdminNotification) => {
    const cached = priorities.get(notification);
    if (cached !== undefined) {
      return cached;
    }
    const priority = notificationPriority(notification);
    priorities.set(notification, priority);
    return priority;
  };

  return [...notifications].sort((left, right) => {
    const signalDiff = priorityFor(right) - priorityFor(left);
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
    const partnerLabel = notificationPartnerLabel(partnerProfile);
    const deliveryHealth = notificationDeliveryHealth(notification);

    return {
      actionLabel: `Notification actions for ${shortId(notification.id)}`,
      actions: notificationActionMenuItems(notification, actionContext, deliveryHealth),
      body: marketplaceDisplayText(notification.body),
      bookingDataHint: notificationDataHint(notification),
      createdAt: notification.createdAt,
      deliveryAttemptCount: notificationDeliveries(notification).length,
      deliveryRows: buildNotificationDeliveryRows(notification, actionContext),
      id: notification.id,
      opsHint: opsHint(notification, deliveryHealth),
      opsSignal: deliveryHealth.signalLabel,
      partnerHref: partnerProfile ? `/partners/${partnerProfile.id}` : null,
      partnerLabel,
      partnerStatus: partnerProfile?.status ?? null,
      relativeCreatedAtLabel: formatRelativeTime(notification.createdAt, { justNow: 'Updated just now' }),
      signalClassName: deliveryHealth.signalClassName,
      title: marketplaceDisplayText(notification.title),
      typeLabel: marketplaceDisplayText(humanizeType(notification.type)),
      typeMeaning: typeMeaning(notification.type),
      userAvatarStatus: notificationUserAvatarStatus(notification),
      userHref: notificationUserHref(notification),
      userLabel: notificationUserLabel(notification),
      userPhone: notification.user?.phone ?? 'No phone on file',
    };
  });
}

function notificationUserHref(notification: AdminNotification) {
  const providerId = notification.user?.providerProfile?.id;
  if (providerId) {
    return `/partners/${providerId}`;
  }
  const customerId = notification.user?.customerProfile?.id;
  return customerId ? `/customers/${customerId}` : null;
}

function notificationUserAvatarStatus(notification: AdminNotification): AdminAvatarStatus {
  return adminAvatarStatusFromSignals({
    devices: notificationAvatarDevices(notification),
  });
}

function notificationAvatarDevices(notification: AdminNotification): AdminAvatarPushDeviceSignal[] {
  const devices: AdminAvatarPushDeviceSignal[] = [...(notification.user?.pushDevices ?? [])];
  for (const delivery of notification.deliveries ?? []) {
    if (delivery.pushDevice) {
      devices.push({
        ...delivery.pushDevice,
        deliveries: [{ response: delivery.response, status: delivery.status }],
      });
    }
  }
  return devices;
}

function notificationPartnerLabel(
  partnerProfile?: { readonly displayName?: string | null; readonly id: string } | null,
) {
  if (!partnerProfile) {
    return null;
  }
  const name = partnerProfile.displayName
    ? marketplaceDisplayText(partnerProfile.displayName)
    : shortId(partnerProfile.id);
  return name.startsWith('Partner ') ? name : `Partner ${name}`;
}

export function buildNotificationSummary(
  notifications: readonly AdminNotification[],
  deliveryStats = buildNotificationDeliveryStats(notifications),
): NotificationSummary {
  return {
    disabledDevices: deliveryStats.disabledDevices,
    failed: deliveryStats.failedNotifications,
    needsRetry: deliveryStats.retrySignalNotifications,
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
  const disabledDeviceIds = new Set<string>();
  let failedDeliveries = 0;
  let failedNotifications = 0;
  let pendingNotifications = 0;
  let retrySignalNotifications = 0;
  let sentDeliveries = 0;
  let skippedDeliveries = 0;
  let skippedNotifications = 0;
  let stalePushDeviceDeliveries = 0;

  for (const notification of notifications) {
    const deliveries = notificationDeliveries(notification);
    const latest = newestDeliveries(deliveries)[0];
    let hasStaleDelivery = false;

    if (deliveries.length === 0) {
      pendingNotifications += 1;
    }

    if (latest?.status === 'FAILED') {
      failedNotifications += 1;
    }
    if (latest?.status === 'SKIPPED') {
      skippedNotifications += 1;
    }

    for (const delivery of deliveries) {
      if (delivery.status === 'FAILED') {
        failedDeliveries += 1;
      } else if (delivery.status === 'SENT') {
        sentDeliveries += 1;
      } else if (delivery.status === 'SKIPPED') {
        skippedDeliveries += 1;
      }

      if (delivery.pushDevice?.enabled === false) {
        disabledDeviceIds.add(
          delivery.pushDevice.id ?? `${notification.id}-${delivery.id ?? delivery.attemptedAt}`,
        );
      }

      if (isStaleNotificationPushDeviceDelivery(delivery)) {
        stalePushDeviceDeliveries += 1;
        hasStaleDelivery = true;
      }
    }

    if (latest?.status === 'FAILED' || latest?.pushDevice?.enabled === false || hasStaleDelivery) {
      retrySignalNotifications += 1;
    }
  }

  return {
    disabledDevices: disabledDeviceIds.size,
    failedDeliveries,
    failedNotifications,
    pendingNotifications,
    retrySignalNotifications,
    sentDeliveries,
    skippedDeliveries,
    skippedNotifications,
    stalePushDeviceDeliveries,
  };
}

export function buildNotificationDeliveryOpsQueue(
  notifications: readonly AdminNotification[],
  deliveryStats = buildNotificationDeliveryStats(notifications),
): NotificationDeliveryOpsQueueItem[] {
  const queueItems: NotificationDeliveryOpsQueueItem[] = [
    {
      count: deliveryStats.failedNotifications,
      detail:
        'Latest push attempt returned an error. Check failure reason, token freshness, and credentials.',
      href: '/notifications?review=failed',
      key: 'failed',
      label: 'Failed sends',
      tone: 'warning',
    },
    {
      count: deliveryStats.disabledDevices,
      detail: 'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
      href: '/notifications?review=disabled-device',
      key: 'disabled-devices',
      label: 'Disabled devices',
      tone: 'warning',
    },
    {
      count: deliveryStats.stalePushDeviceDeliveries,
      detail: `Push token timestamp is ${STALE_PUSH_DEVICE_AGE_DAYS}+ days old at delivery attempt. Confirm the app has refreshed its FCM token before retrying.`,
      href: '/notifications?review=stale-device',
      key: 'stale-devices',
      label: 'Stale devices',
      tone: 'warning',
    },
    {
      count: deliveryStats.skippedNotifications,
      detail:
        'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
      href: '/notifications?review=skipped',
      key: 'skipped',
      label: 'Skipped',
      tone: 'info',
    },
    {
      count: deliveryStats.pendingNotifications,
      detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
      href: '/notifications?review=pending',
      key: 'pending',
      label: 'Pending',
      tone: 'neutral',
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
  const latestFcmSent = latestFcmSentDelivery(notifications);
  return {
    inAppDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'IN_APP_ONLY')).length,
    fcmDeliveries: deliveries.filter((delivery) => isDeliveryProvider(delivery, 'FCM')).length,
    latestFcmSentAttemptLabel: latestFcmSent ? formatDateTime(latestFcmSent.delivery.attemptedAt) : null,
    latestFcmSentDetail: latestFcmSent
      ? fcmSentDeliveryDetail(latestFcmSent.notification, latestFcmSent.delivery)
      : null,
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
        !isPartnerAlertType(notification.type) &&
        !isDeferredPaymentNotification(notification),
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
    const command = buildFcmPushSmokeCommand({
      notificationId: notification.id,
      phone,
      platform,
      preflight: true,
      role,
      useRegisteredDevice: true,
    });

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
    if (hasReusableDeferredPaymentFcmDelivery(notifications)) {
      return {
        detail:
          'Reusable FCM delivery exists only on deferred payment notifications. Select or create a non-payment FCM notification before running registered-device preflight.',
        deviceWarningLabel: null,
        latestAttemptLabel: null,
        preflightCommand: null,
        pushDeviceLabel: null,
        selectedNotificationId: null,
        selectedNotificationLabel: null,
        status: 'needs-notification',
        statusLabel: 'Needs non-payment FCM delivery',
      };
    }

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

export { notificationReviewRunbook };
export type { NotificationReviewRunbook } from './notification-review-runbook';

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
  return newestDeliveries(notificationDeliveries(notification))
    .slice(0, NOTIFICATION_TABLE_DELIVERY_LIMIT)
    .map((delivery) => ({
      attemptedAt: delivery.attemptedAt,
      deviceFreshnessLabel: notificationPushDeviceFreshnessLabel(delivery),
      deviceLastSeenAt: delivery.pushDevice?.lastSeenAt ?? null,
      deviceStateLabel: delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled',
      enableDeviceHref:
        delivery.pushDevice?.enabled === false && delivery.pushDevice.id
          ? enablePushDeviceConfirmHref(delivery.pushDevice.id, actionContext)
          : null,
      failureCodeLabel: deliveryFailureCodeLabel(delivery),
      failureReasonLabel: notificationDeliveryFailureReason(delivery) ?? '-',
      httpStatusLabel: String(delivery.response?.statusCode ?? '-'),
      id: delivery.id ?? `${notification.id}-${delivery.attemptedAt}`,
      platformLabel: delivery.pushDevice?.platform ?? 'device',
      provider: delivery.provider,
      recoveryHintLabel: deliveryRecoveryHintLabel(delivery),
      status: delivery.status,
      statusClassName: deliveryStatusClassName(delivery.status),
    }));
}

function deliveryRecoveryHintLabel(delivery: AdminNotificationDelivery) {
  if (delivery.pushDevice?.enabled === false) {
    return 'Ask the customer or Partner to reopen the app, then re-enable only after the token path is current.';
  }
  if (isStaleNotificationPushDeviceDelivery(delivery)) {
    return 'Ask the user to reopen the app so the token refreshes, then prefer token recovery review before retrying.';
  }
  return notificationDeliveryRecoveryHint(delivery);
}

function deliveryFailureCodeLabel(delivery: AdminNotificationDelivery) {
  const failureCode = notificationDeliveryFailureCode(delivery);
  return failureCode ? notificationFailureCodeLabel(failureCode) : '-';
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

function hasStalePushDeviceDelivery(notification: AdminNotification) {
  return notificationDeliveries(notification).some(isStaleNotificationPushDeviceDelivery);
}

export { isStaleNotificationPushDeviceDelivery as isStalePushDeviceDelivery };

function hasRetrySignal(notification: AdminNotification) {
  return (
    hasLatestDeliveryStatus(notification, 'FAILED') ||
    hasCurrentDisabledPushDevice(notification) ||
    hasStalePushDeviceDelivery(notification)
  );
}

type NotificationDeliveryHealth = {
  readonly hint: string;
  readonly priority: number;
  readonly retryActionDescription: string;
  readonly retryActionTone: 'info' | 'warning';
  readonly signalClassName: string;
  readonly signalLabel: string;
};

function notificationDeliveryHealth(notification: AdminNotification): NotificationDeliveryHealth {
  if (hasLatestDeliveryStatus(notification, 'FAILED')) {
    return {
      hint: 'Review failure code, confirm token health, then retry only after the device path makes sense.',
      priority: 5,
      retryActionDescription: 'Review the delivery issue before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'Retry needed',
    };
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return {
      hint: 'This user has at least one disabled push device. Re-enable only if a fresh token arrives.',
      priority: 4,
      retryActionDescription: 'Refresh or re-enable the push device before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'Device disabled',
    };
  }
  if (hasStalePushDeviceDelivery(notification)) {
    return {
      hint: 'Push token timestamp is old. Ask the user to open the app so FCM can refresh before relying on retry.',
      priority: 3,
      retryActionDescription: 'Refresh the app FCM token before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'Stale device',
    };
  }
  if (hasLatestDeliveryStatus(notification, 'SKIPPED')) {
    return {
      hint: 'Skipped alerts usually mean no available push path or a delivery decision to avoid duplicate sends.',
      priority: 2,
      retryActionDescription:
        'Confirm the skipped delivery was intentional before retrying this notification.',
      retryActionTone: 'info',
      signalClassName: 'signal signal-info',
      signalLabel: 'Skipped delivery',
    };
  }
  if (hasLatestDeliveryStatus(notification, 'SENT')) {
    return {
      hint: 'Delivery path is healthy. Use this row as a reference if the user still reports a miss.',
      priority: 1,
      retryActionDescription: 'Retry only if support confirmed the user still missed this delivered alert.',
      retryActionTone: 'info',
      signalClassName: 'signal signal-ok',
      signalLabel: 'Delivered',
    };
  }
  return {
    hint: 'Notification exists, but no delivery attempt was captured yet.',
    priority: 0,
    retryActionDescription: 'Confirm workers and queue processing before retrying this notification.',
    retryActionTone: 'info',
    signalClassName: 'signal signal-info',
    signalLabel: 'Pending',
  };
}

function notificationPriority(notification: AdminNotification) {
  return notificationDeliveryHealth(notification).priority;
}

function notificationActionMenuItems(
  notification: AdminNotification,
  actionContext: NotificationActionReturnContext,
  deliveryHealth = notificationDeliveryHealth(notification),
): readonly ActionMenuItem[] {
  const bookingId = notificationBookingId(notification);
  const actions: ActionMenuItem[] = [];

  if (bookingId) {
    actions.push({
      href: `/bookings/${bookingId}`,
      kind: 'link',
      label: 'Open booking',
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
    description: deliveryHealth.retryActionDescription,
    href: retryNotificationConfirmHref(notification.id, actionContext),
    kind: 'link',
    label: 'Retry',
    tone: deliveryHealth.retryActionTone,
  });

  return actions;
}

function notificationAuditTrailHref(notificationId: string) {
  return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
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
  if (!review || review === 'all') {
    return true;
  }
  return notificationReviewMatchers[review]?.(notification) ?? true;
}

function shouldIncludeNotificationApiReview(review: string) {
  return Boolean(review && review !== 'all');
}

function notificationBookingId(notification: AdminNotification) {
  const data = asRecord(notification.data);
  return readString(data?.bookingId) ?? '';
}

function opsHint(notification: AdminNotification, deliveryHealth = notificationDeliveryHealth(notification)) {
  const baseHint = opsHintBase(notification, deliveryHealth);
  const latestAttemptLabel = latestDeliveryAttemptLabel(notification);
  return latestAttemptLabel ? `${baseHint} Latest attempt ${latestAttemptLabel}.` : baseHint;
}

function opsHintBase(
  notification: AdminNotification,
  deliveryHealth = notificationDeliveryHealth(notification),
) {
  return deliveryHealth.hint;
}

function latestDeliveryAttemptLabel(notification: AdminNotification) {
  const delivery = latestDelivery(notification);
  return delivery ? formatDateTime(delivery.attemptedAt) : null;
}

function isPartnerAlertType(type: string) {
  return PARTNER_ALERT_TYPE_SET.has(type);
}

function isDeferredPaymentNotification(notification: AdminNotification) {
  return notification.type.toLowerCase().startsWith('payment.');
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
  return buildFcmPushSmokeCommand({
    notificationId: suggestedNotification.id,
    phone,
    platform,
    preflight: true,
    role: 'PROVIDER',
    useRegisteredDevice: true,
  });
}

function newestFcmSmokeCandidates(notifications: readonly AdminNotification[]) {
  return notifications
    .filter((notification) => !isDeferredPaymentNotification(notification))
    .flatMap((notification) =>
      notificationDeliveries(notification)
        .filter(isReusableFcmDelivery)
        .filter(() => Boolean(notification.user?.phone))
        .map((delivery) => ({ delivery, notification })),
    )
    .sort((left, right) => deliveryAttemptMs(right.delivery) - deliveryAttemptMs(left.delivery));
}

function hasReusableDeferredPaymentFcmDelivery(notifications: readonly AdminNotification[]) {
  return notifications.some(
    (notification) =>
      isDeferredPaymentNotification(notification) &&
      Boolean(notification.user?.phone) &&
      notificationDeliveries(notification).some(isReusableFcmDelivery),
  );
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

function latestDelivery(notification: AdminNotification) {
  return newestDeliveries(notificationDeliveries(notification))[0];
}
