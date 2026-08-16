import type {
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationalPolicySetting,
} from '../../lib/admin-api';
import { adminCountLabel } from '../../lib/admin-copy';
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
  notificationDeliveryDisposition,
  notificationDeliveries,
  type AdminNotificationDelivery,
  type AdminNotificationPushDevice,
} from '../../lib/admin-notification-delivery';
import { readSearchParam } from '../../lib/date-range';
import {
  readAdminQueueAge,
  readAdminQueueSlaFilter,
  readAdminQueueSort,
  type AdminQueueAge,
  type AdminQueueSort,
  type AdminQueueSlaFilter,
} from '../../lib/admin-queue-list';
import {
  ADMIN_PARTNER_ALERT_LEGACY_OS_PUSH_FOR_ALL_BOOKINGS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerAlertChannelRoutesToFcm,
} from '../../lib/operations-policy';
import {
  buildNotificationActionConfirmation,
  assignFinanceReviewConfirmHref,
  isLegacySystemNotificationReviewable,
  legacyReviewNotificationConfirmHref,
  notificationBackgroundJobEvidenceHref,
  notificationRetryEvidence,
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
import { notificationFailureCodeLabel, notificationFailureRunbook } from './notification-failure-copy';
import { readNotificationRetryDecision } from './notification-retry-decision';
import type { NotificationDeliveryRow } from './notification-delivery-cell';
import type { NotificationDeliveryOpsQueueItem } from './notification-delivery-ops-queue-section';
import type { NotificationTableRow } from './notification-table-row';

type NotificationPageParams = Record<string, string | string[] | undefined>;

type BuildNotificationPageModelInput = {
  readonly canRetry?: boolean;
  readonly financeAssigneeAdminId?: string | null;
  readonly financeAssigneeOptions?: readonly { readonly label: string; readonly value: string }[];
  readonly notificationSummary?: AdminNotificationBoardSummary | null;
  readonly notifications: readonly AdminNotification[];
  readonly operationalPolicies: readonly AdminOperationalPolicySetting[];
  readonly params: NotificationPageParams;
};

export type NotificationDeliveryMode = 'action' | 'records';
export type NotificationDeliveryIssue = 'groups' | 'failed' | 'no-attempt' | 'no-route' | 'stale-route';
export type NotificationDeliveryRecordStatus = 'all' | 'accepted' | 'failed' | 'skipped' | 'not-attempted';
export type NotificationDeliveryRecipientRole = 'all' | 'customer' | 'provider' | 'admin';
export type NotificationDeliveryChannel = 'all' | 'fcm' | 'in-app';
export type NotificationActionScope = 'current' | '15-60m' | '1-24h' | 'history' | 'all';
export type NotificationDataScopeFilter = 'production' | 'unknown' | 'synthetic';

export type NotificationDeliveryView = {
  readonly age: string;
  readonly booking: string;
  readonly channel: NotificationDeliveryChannel;
  readonly dataScope: NotificationDataScopeFilter;
  readonly failureCode: string;
  readonly failureProvider: string;
  readonly issue: NotificationDeliveryIssue;
  readonly mode: NotificationDeliveryMode;
  readonly page: number;
  readonly q: string;
  readonly range: NotificationDateRange;
  readonly recipientRole: NotificationDeliveryRecipientRole;
  readonly sort: AdminQueueSort;
  readonly scope: NotificationActionScope;
  readonly status: NotificationDeliveryRecordStatus;
  readonly type: string;
  readonly user: string;
};

export type NotificationDateRange = 'all' | 'today' | 'yesterday' | '7d' | '30d';
export type NotificationIncidentState = 'all' | 'open' | 'recovered' | 'legacy' | 'reviewed';
export type NotificationFinanceAge = 'all' | '48-72' | '72-plus';

export type NotificationFilters = {
  readonly age: AdminQueueAge;
  readonly booking: string;
  readonly financeAge: NotificationFinanceAge;
  readonly financeOwner: string;
  readonly incidentState: NotificationIncidentState;
  readonly range: NotificationDateRange;
  readonly review: string;
  readonly sla: AdminQueueSlaFilter;
  readonly user: string;
  readonly sort: AdminQueueSort;
};

export type NotificationTablePagination = {
  readonly from: number;
  readonly page: number;
  readonly rows: readonly NotificationTableRow[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export type NotificationDeliveryHealthState = 'attention' | 'clear' | 'unavailable';

export function notificationDeliveryHealthState(
  summary: AdminNotificationBoardSummary | null | undefined,
) {
  return {
    current: classifyNotificationHealth([
      summary?.openDeliveryIncidentCount,
      summary?.currentFailed,
      summary?.currentDeliveryGaps,
      summary?.currentNoPushPathRecipientCount,
      summary?.currentStaleRouteNotifications,
    ]),
    history: classifyNotificationHealth([
      summary?.historicalDeliveryIncidentCount,
      summary?.historicalFailed,
      summary?.historicalDeliveryGaps,
      summary?.historicalNoPushPathRecipientCount,
      summary?.historicalStaleRouteNotifications,
    ]),
  };
}

function classifyNotificationHealth(
  values: readonly (number | undefined)[],
): NotificationDeliveryHealthState {
  if (values.some((value) => value === undefined)) return 'unavailable';
  return values.some((value) => (value ?? 0) > 0) ? 'attention' : 'clear';
}

const PARTNER_ALERT_TYPES = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const;
const PARTNER_ALERT_TYPE_SET: ReadonlySet<string> = new Set(PARTNER_ALERT_TYPES);
const LEGACY_CUSTOMER_NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set([
  'booking.opened',
  'booking.rejected',
  'payment.updated',
  'provider.accepted',
  'provider.joined',
  'provider.rejected',
  'service.completed',
]);
const LEGACY_PROVIDER_NOTIFICATION_TYPE_SET: ReadonlySet<string> = new Set([
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
const FINANCE_OVERDUE_TYPES = [
  'admin.finance.bank_statement_batch.escalated',
  'admin.finance.bank_transaction.review_escalated',
] as const;
const FINANCE_OVERDUE_TYPE_SET: ReadonlySet<string> = new Set(FINANCE_OVERDUE_TYPES);
const NOTIFICATION_TABLE_PAGE_SIZE = 10;
const NOTIFICATION_TABLE_DELIVERY_LIMIT = 10;
const NOTIFICATION_API_TAKE = NOTIFICATION_TABLE_PAGE_SIZE;
const DAY_MS = 24 * 60 * 60 * 1000;
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DELIVERY_GAP_MINUTES = 15;
const DEFAULT_NOTIFICATION_REVIEW = 'delivery-incidents';
const DELIVERY_INCIDENT_HISTORY_HOURS = 24;

export const notificationDateRangeLinks = [
  { label: 'Today', range: 'today' },
  { label: 'Previous day', range: 'yesterday' },
  { label: 'Last 7 days', range: '7d' },
  { label: 'Last 30 days', range: '30d' },
  { label: 'Entire history', range: 'all' },
] as const satisfies readonly { label: string; range: NotificationDateRange }[];

export const notificationIncidentStateLinks = [
  { label: 'All system', state: 'all' },
  { label: 'Open', state: 'open' },
  { label: 'Recovered', state: 'recovered' },
  { label: 'Legacy review', state: 'legacy' },
  { label: 'Reviewed legacy', state: 'reviewed' },
] as const satisfies readonly { label: string; state: NotificationIncidentState }[];

export const notificationFinanceAgeLinks = [
  { label: 'All overdue', value: 'all' },
  { label: '48–72h', value: '48-72' },
  { label: '72h+', value: '72-plus' },
] as const satisfies readonly { label: string; value: NotificationFinanceAge }[];

const notificationReviewDescriptions: Readonly<Record<string, string>> = {
  'delivery-incidents':
    'current delivery failures grouped by provider, failure code, and the configured incident window.',
  'delivery-incident-history':
    'delivery incidents older than 24 hours retained for cleanup and audit, outside the current SLA.',
  'disabled-device':
    'customers or Partners whose app cannot currently receive a mobile alert.',
  failed: 'latest mobile alert attempts that were not delivered.',
  'unresolved-failed': 'notifications with a failed delivery and no later successful delivery.',
  fcm: 'notifications that attempted mobile push delivery.',
  'finance-overdue': 'bank statement batches and assigned bank reviews unresolved for over 48 hours.',
  'finance-overdue-history': 'resolved bank reconciliation SLA alerts retained for audit history.',
  'in-app-route': 'notifications intentionally kept in the app inbox route.',
  'needs-retry': 'notifications whose delivery path should be reviewed before retry.',
  'delivery-gap':
    'notifications older than 15 minutes with an enabled target device but no delivery evidence.',
  'no-push-path':
    'notifications that have no enabled device for the intended customer or Partner role.',
  'no-show': 'customer and Partner alerts created when operations marks a booking as no-show.',
  'partner-alerts': 'booking and payout alerts sent to Partners.',
  'payout-setup': 'Partners who earned revenue and now need tax/address/agreement setup before payout.',
  pending: 'all historical notifications without a captured delivery attempt.',
  unattempted: 'all historical notifications without a captured delivery attempt.',
  sent: 'notifications whose latest push attempt was delivered successfully.',
  skipped: 'notifications whose latest push attempt was intentionally skipped or had no available send path.',
  'stale-device':
    'historical notification evidence linked to an enabled device that had not checked in for 30+ days.',
  'system-incidents': 'Admin system and background-job alerts that require operational review.',
};

const notificationReviewMatchers: Readonly<Record<string, (notification: AdminNotification) => boolean>> = {
  'delivery-incidents': (notification) => notificationDeliveryIncident(notification)?.historical === false,
  'delivery-incident-history': (notification) => notificationDeliveryIncident(notification)?.historical === true,
  'disabled-device': hasDisabledPushDevice,
  failed: hasCurrentFailedDelivery,
  'unresolved-failed': hasUnresolvedFailedDelivery,
  fcm: (notification) => hasDeliveryProvider(notification, 'FCM'),
  'finance-overdue': isOpenFinanceOverdueNotification,
  'finance-overdue-history': isResolvedFinanceOverdueNotification,
  'in-app-route': (notification) => hasDeliveryProvider(notification, 'IN_APP_ONLY'),
  'needs-retry': hasRetrySignal,
  'delivery-gap': hasDeliveryGap,
  'no-push-path': hasNoPushPath,
  'no-show': (notification) => notification.type === 'booking.no_show',
  'partner-alerts': (notification) => isPartnerAlertType(notification.type),
  'payout-setup': (notification) => notification.type === 'provider.payout_setup_required',
  pending: hasNoDeliveryAttempts,
  unattempted: hasNoDeliveryAttempts,
  sent: (notification) => notificationDeliveryDisposition(notification) === 'delivered',
  skipped: (notification) => notificationDeliveryDisposition(notification) === 'skipped',
  'stale-device': hasStalePushDeviceDelivery,
  'system-incidents': (notification) => notification.type.startsWith('admin.system.'),
};

export type NotificationSummary = {
  readonly awaitingWorker: number;
  readonly deliveryIncidentNotifications: number;
  readonly deliveryIncidents: number;
  readonly deliveryGaps: number;
  readonly disabledDevices: number;
  readonly disabledDeviceUsers: number;
  readonly failed: number;
  readonly failedAttempts: number;
  readonly historicalDeliveryIncidents: number;
  readonly needsRetry: number;
  readonly noShow: number;
  readonly noPushPath: number;
  readonly payoutSetup: number;
  readonly pending: number;
  readonly sent: number;
  readonly skipped: number;
  readonly staleDevices: number;
  readonly staleDeviceUsers: number;
  readonly unattempted: number;
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
  readonly disabledDeviceUsers: number;
  readonly failedDeliveries: number;
  readonly failedNotifications: number;
  readonly pendingNotifications: number;
  readonly retrySignalNotifications: number;
  readonly sentDeliveries: number;
  readonly skippedDeliveries: number;
  readonly skippedNotifications: number;
  readonly staleDevices: number;
  readonly staleDeviceUsers: number;
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
  {
    label: 'Delivery incidents',
    href: '/notifications?review=delivery-incidents',
    review: 'delivery-incidents',
  },
  {
    label: 'Historical cleanup',
    href: '/notifications?review=delivery-incident-history',
    review: 'delivery-incident-history',
  },
  { label: 'All notifications', href: '/notifications?review=all', review: 'all' },
  {
    label: 'System incidents',
    href: '/notifications?review=system-incidents',
    review: 'system-incidents',
  },
  {
    label: 'Finance overdue',
    href: '/notifications?review=finance-overdue',
    review: 'finance-overdue',
  },
  {
    label: 'Finance history',
    href: '/notifications?review=finance-overdue-history',
    review: 'finance-overdue-history',
  },
  { label: 'Failed sends', href: '/notifications?review=failed', review: 'failed' },
  {
    label: 'Unresolved failures',
    href: '/notifications?review=unresolved-failed',
    review: 'unresolved-failed',
  },
  {
    label: 'Push unavailable users',
    href: '/notifications?review=disabled-device',
    review: 'disabled-device',
  },
  {
    label: 'Inactive app users',
    href: '/notifications?review=stale-device',
    review: 'stale-device',
  },
  { label: 'Needs retry', href: '/notifications?review=needs-retry', review: 'needs-retry' },
  {
    label: 'Delivery gaps',
    href: '/notifications?review=delivery-gap',
    review: 'delivery-gap',
  },
  {
    label: 'No mobile route',
    href: '/notifications?review=no-push-path',
    review: 'no-push-path',
  },
  { label: 'Skipped', href: '/notifications?review=skipped', review: 'skipped' },
  { label: 'Sent', href: '/notifications?review=sent', review: 'sent' },
  {
    label: 'No delivery attempt',
    href: '/notifications?review=unattempted',
    review: 'unattempted',
  },
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
  { label: 'Mobile push', href: '/notifications?review=fcm', review: 'fcm' },
  { label: 'In-app route', href: '/notifications?review=in-app-route', review: 'in-app-route' },
] as const;

export function buildNotificationFilters(params: Record<string, string | string[] | undefined>) {
  const review = readSearchParam(params.review);
  const normalizedReview = review || DEFAULT_NOTIFICATION_REVIEW;
  const financeReview = normalizedReview === 'finance-overdue' || normalizedReview === 'finance-overdue-history';
  const deliveryIncidentReview = normalizedReview === 'delivery-incidents' || normalizedReview === 'delivery-incident-history';
  return {
    age: deliveryIncidentReview ? 'all' : readAdminQueueAge(params.age),
    booking: readSearchParam(params.booking),
    financeAge: financeReview
      ? normalizeNotificationFinanceAge(readSearchParam(params.financeAge))
      : 'all',
    financeOwner: financeReview ? normalizeNotificationFinanceOwner(readSearchParam(params.financeOwner)) : '',
    incidentState: normalizedReview === 'system-incidents'
      ? normalizeNotificationIncidentState(readSearchParam(params.incidentState))
      : 'all',
    range: deliveryIncidentReview ? 'all' : normalizeNotificationDateRange(readSearchParam(params.range)),
    review: normalizedReview,
    sla: normalizedReview === 'unresolved-failed' ? readAdminQueueSlaFilter(params.sla) : 'all',
    user: readSearchParam(params.user),
    sort: readAdminQueueSort(params.sort),
  };
}

export function buildNotificationListHref(
  filters: {
    readonly age?: AdminQueueAge;
    readonly booking: string;
    readonly financeAge?: NotificationFinanceAge;
    readonly financeOwner?: string;
    readonly incidentState?: NotificationIncidentState;
    readonly range?: NotificationDateRange;
    readonly review: string;
    readonly sla?: AdminQueueSlaFilter;
    readonly user?: string;
    readonly sort?: AdminQueueSort;
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
  appendNotificationQueueParams(query, filters);
  if (filters.booking) {
    query.set('booking', filters.booking);
  }
  if (
    filters.review === 'system-incidents' &&
    filters.incidentState &&
    filters.incidentState !== 'all'
  ) {
    query.set('incidentState', filters.incidentState);
  }
  if (filters.user) {
    query.set('user', filters.user);
  }
  if (
    (filters.review === 'finance-overdue' || filters.review === 'finance-overdue-history') &&
    filters.financeAge &&
    filters.financeAge !== 'all'
  ) {
    query.set('financeAge', filters.financeAge);
  }
  if (
    (filters.review === 'finance-overdue' || filters.review === 'finance-overdue-history') &&
    filters.financeOwner
  ) {
    query.set('financeOwner', filters.financeOwner);
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
  appendNotificationQueueParams(query, filters);
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
  appendNotificationRecordApiFilters(query, params);
  const dataScope = normalizeNotificationDataScope(readSearchParam(params.dataScope));
  if (dataScope !== 'production') query.set('dataScope', dataScope);
  if (filters.financeAge !== 'all') {
    query.set('financeAge', filters.financeAge);
  }
  if (filters.financeOwner) {
    query.set('financeOwner', filters.financeOwner);
  }
  if (filters.review === 'system-incidents' && filters.incidentState !== 'all') {
    query.set('incidentState', filters.incidentState);
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
  const mode = readSearchParam(params.mode);
  if (mode === 'records' || mode === 'action') query.set('viewMode', mode);
  appendNotificationQueueParams(query, filters);
  if (shouldIncludeNotificationApiReview(filters.review)) {
    query.set('review', filters.review);
  }
  if (filters.booking) {
    query.set('booking', filters.booking);
  }
  if (filters.user) {
    query.set('user', filters.user);
  }
  appendNotificationRecordApiFilters(query, params);
  const dataScope = normalizeNotificationDataScope(readSearchParam(params.dataScope));
  if (dataScope !== 'production') query.set('dataScope', dataScope);
  if (filters.financeAge !== 'all') {
    query.set('financeAge', filters.financeAge);
  }
  if (filters.financeOwner) {
    query.set('financeOwner', filters.financeOwner);
  }
  if (filters.review === 'system-incidents' && filters.incidentState !== 'all') {
    query.set('incidentState', filters.incidentState);
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

function appendNotificationQueueParams(
  query: URLSearchParams,
  filters: {
    readonly age?: AdminQueueAge;
    readonly sla?: AdminQueueSlaFilter;
    readonly sort?: AdminQueueSort;
  },
) {
  if (filters.age && filters.age !== 'all') {
    query.set('age', filters.age);
  }
  if (filters.sort && filters.sort !== 'newest') {
    query.set('sort', filters.sort);
  }
  if (filters.sla && filters.sla !== 'all') {
    query.set('sla', filters.sla);
  }
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
  return 'Entire history';
}

function normalizeNotificationDateRange(value: string): NotificationDateRange {
  if (value === 'all' || value === 'today' || value === 'yesterday' || value === '7d' || value === '30d') {
    return value;
  }
  return 'today';
}

function normalizeNotificationIncidentState(value: string): NotificationIncidentState {
  if (value === 'open' || value === 'recovered' || value === 'legacy' || value === 'reviewed') return value;
  return 'all';
}

function normalizeNotificationFinanceAge(value: string): NotificationFinanceAge {
  if (value === '48-72' || value === '72-plus') return value;
  return 'all';
}

function normalizeNotificationFinanceOwner(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized === 'all') return '';
  if (normalized === 'unassigned') return normalized;
  const hasControlCharacter = Array.from(normalized).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
  return normalized.length <= 128 && !hasControlCharacter ? normalized : '';
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
  return new Date(
    Math.floor((value.getTime() + VIETNAM_UTC_OFFSET_MS) / DAY_MS) * DAY_MS -
      VIETNAM_UTC_OFFSET_MS,
  );
}

export function buildNotificationPageModel({
  canRetry = false,
  financeAssigneeAdminId,
  financeAssigneeOptions = [],
  notificationSummary,
  notifications: rawNotifications,
  operationalPolicies,
  params,
}: BuildNotificationPageModelInput) {
  const filters = buildNotificationFilters(params);
  const defaultOrderedNotifications = ['delivery-incidents', 'delivery-incident-history', 'delivery-incidents-all'].includes(filters.review)
    ? [...rawNotifications]
    : filters.review === 'finance-overdue'
    ? sortFinanceReviewNotifications(rawNotifications, 'open')
    : filters.review === 'finance-overdue-history'
      ? sortFinanceReviewNotifications(rawNotifications, 'resolved')
      : sortNotifications(rawNotifications);
  const allNotifications = filters.review === 'delivery-incidents' || filters.review === 'delivery-incident-history'
    ? defaultOrderedNotifications
    : filters.sort === 'oldest'
    ? [...defaultOrderedNotifications].sort((left, right) =>
        (left.createdAt || '').localeCompare(right.createdAt || ''),
      )
    : defaultOrderedNotifications;
  const loadedCount = allNotifications.length;
  const serverTotalCount = filters.review === 'system-incidents'
    ? notificationSummary?.systemIncidentSourceTotalCount
    : notificationSummary?.totalCount;
  const rawTotalCount = serverTotalCount ?? loadedCount;
  const filteredNotifications = filterNotifications(allNotifications, filters);
  const notifications = filters.review === 'system-incidents'
    ? groupSystemIncidentNotifications(filteredNotifications)
    : filteredNotifications;
  const totalCount = rawTotalCount;
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
  const requestedPage = readNotificationTablePage(params.page);
  const actionContext: NotificationActionReturnContext = {
    canRetry,
    channel: readSearchParam(params.channel) || undefined,
    dataScope: readSearchParam(params.dataScope) || undefined,
    age: filters.age !== 'all' ? filters.age : undefined,
    booking: filters.booking || undefined,
    financeAge: filters.financeAge !== 'all' ? filters.financeAge : undefined,
    financeAssigneeAdminId: financeAssigneeAdminId ?? undefined,
    financeAssigneeOptions,
    financeOwner: filters.financeOwner || undefined,
    failureCode: readSearchParam(params.failureCode) || undefined,
    failureProvider: readSearchParam(params.failureProvider) || undefined,
    incidentState: filters.incidentState !== 'all' ? filters.incidentState : undefined,
    issue: readSearchParam(params.issue) || undefined,
    mode: readSearchParam(params.mode) || undefined,
    page: requestedPage > 1 ? String(requestedPage) : undefined,
    q: readSearchParam(params.q) || undefined,
    range: filters.range !== 'today' ? filters.range : undefined,
    recipientRole: readSearchParam(params.recipientRole) || undefined,
    sla: filters.sla !== 'all' ? filters.sla : undefined,
    sort: filters.sort !== 'newest' ? filters.sort : undefined,
    scope: readSearchParam(params.scope) || undefined,
    status: readSearchParam(params.status) || undefined,
    type: readSearchParam(params.type) || undefined,
    user: filters.user || undefined,
  };
  const allNotificationRows = buildNotificationTableRows(notifications, actionContext);
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
        assigneeAdminId: readSearchParam(params.assigneeAdminId),
        notificationId: readSearchParam(params.notificationId),
        pushDeviceId: readSearchParam(params.pushDeviceId),
      ...actionContext,
      },
    ),
    filters,
    fcmSmokeReadiness,
    loadedCount,
    metrics:
      filters.review === 'system-incidents'
        ? buildSystemIncidentMetrics(notificationSummary, allNotifications, filters)
        : filters.review === 'finance-overdue' || filters.review === 'finance-overdue-history'
          ? buildFinanceOverdueMetrics(totalCount, filters)
          : filters.review === 'delivery-incidents' || filters.review === 'delivery-incident-history'
            ? buildNotificationIncidentMetrics(summary, filters)
          : buildNotificationMetrics(summary),
    channelMetrics:
      filters.review === 'system-incidents' ||
      filters.review === 'finance-overdue' ||
      filters.review === 'finance-overdue-history'
        ? []
        : buildNotificationChannelMetrics(summary, channelSummary, filters),
    notificationPagination,
    notificationRows: notificationPagination.rows,
    notifications,
    opsQueue: buildNotificationDeliveryOpsQueue(
      allNotifications,
      deliveryStats,
      summary.deliveryGaps,
      filters,
      summary,
    ),
    partnerAlertSmokeFallback,
    recordMetrics:
      filters.review === 'system-incidents' ||
      filters.review === 'finance-overdue' ||
      filters.review === 'finance-overdue-history'
        ? []
        : buildNotificationRecordMetrics(totalCount, summary, filters),
    reviewRunbook: reviewState.runbook,
    summary,
    totalCount,
  };
}

export function buildNotificationDeliveryView(params: NotificationPageParams): NotificationDeliveryView {
  const mode = readSearchParam(params.mode) === 'records' ? 'records' : 'action';
  const issue = normalizeNotificationDeliveryIssue(readSearchParam(params.issue));
  const status = normalizeNotificationDeliveryRecordStatus(readSearchParam(params.status));
  const range = normalizeNotificationDateRange(readSearchParam(params.range) || (mode === 'records' ? 'today' : 'all'));
  return {
    age: readSearchParam(params.age),
    booking: readSearchParam(params.booking),
    channel: normalizeNotificationDeliveryChannel(readSearchParam(params.channel)),
    dataScope: normalizeNotificationDataScope(readSearchParam(params.dataScope)),
    failureCode: normalizeNotificationFailureCode(readSearchParam(params.failureCode)),
    failureProvider: normalizeNotificationFailureProvider(readSearchParam(params.failureProvider)),
    issue,
    mode,
    page: readNotificationTablePage(params.page),
    q: readSearchParam(params.q).trim(),
    range,
    recipientRole: normalizeNotificationDeliveryRecipientRole(readSearchParam(params.recipientRole)),
    sort: readAdminQueueSort(params.sort || (mode === 'action' ? 'oldest' : 'newest')),
    scope: mode === 'action' ? normalizeNotificationActionScope(readSearchParam(params.scope)) : 'all',
    status,
    type: readSearchParam(params.type).trim(),
    user: readSearchParam(params.user),
  };
}

export function notificationDeliveryModelParams(
  params: NotificationPageParams,
  view = buildNotificationDeliveryView(params),
) {
  const review = view.mode === 'action'
    ? notificationIssueReview(view.issue, view.scope)
    : view.type || notificationRecordStatusReview(view.status);
  return {
    ...params,
    age: view.age || undefined,
    channel: view.channel === 'all' ? undefined : notificationChannelApiValue(view.channel),
    dataScope: view.dataScope,
    failureCode: view.mode === 'action' && view.issue === 'failed' ? view.failureCode || undefined : undefined,
    failureProvider: view.mode === 'action' && view.issue === 'failed' ? view.failureProvider || undefined : undefined,
    mode: view.mode,
    q: view.q || undefined,
    range: view.range,
    recipientRole: view.recipientRole === 'all' ? undefined : view.recipientRole,
    review,
    scope: view.mode === 'action' ? view.scope : undefined,
    sort: view.sort,
  };
}

export function buildNotificationDeliveryHref(
  view: NotificationDeliveryView,
  updates: Partial<NotificationDeliveryView> = {},
) {
  const next = { ...view, ...updates };
  const query = new URLSearchParams();
  if (next.mode === 'records') query.set('mode', 'records');
  if (next.mode === 'action' && next.issue !== 'groups') query.set('issue', next.issue);
  if (next.mode === 'action' && next.scope !== 'current') query.set('scope', next.scope);
  if (next.mode === 'action' && next.issue === 'failed' && next.failureProvider && next.failureCode) {
    query.set('failureProvider', next.failureProvider);
    query.set('failureCode', next.failureCode);
  }
  if (next.mode === 'records' && next.status !== 'all') query.set('status', next.status);
  if (next.mode === 'records' && next.recipientRole !== 'all') query.set('recipientRole', next.recipientRole);
  if (next.mode === 'records' && next.channel !== 'all') query.set('channel', next.channel);
  if (next.dataScope !== 'production') query.set('dataScope', next.dataScope);
  if (next.mode === 'records' && next.q) query.set('q', next.q);
  if (next.mode === 'records' && next.type) query.set('type', next.type);
  const defaultRange = next.mode === 'records' ? 'today' : 'all';
  if (next.range !== defaultRange) query.set('range', next.range);
  const defaultSort = next.mode === 'action' ? 'oldest' : 'newest';
  if (next.sort !== defaultSort) query.set('sort', next.sort);
  if (next.age) query.set('age', next.age);
  if (next.booking) query.set('booking', next.booking);
  if (next.user) query.set('user', next.user);
  if (next.page > 1) query.set('page', String(next.page));
  const value = query.toString();
  return value ? `/notifications?${value}` : '/notifications';
}

export function legacyNotificationDestination(params: NotificationPageParams) {
  const review = readSearchParam(params.review);
  if (!review) return null;
  if (review === 'system-incidents') {
    return '/background-jobs?review=OPEN&range=ALL';
  }
  if (review === 'finance-overdue') {
    return '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched&age=48h';
  }
  if (review === 'finance-overdue-history') {
    return '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=all';
  }
  const base = buildNotificationDeliveryView(params);
  const mapped = legacyNotificationView(base, review);
  return mapped ? buildNotificationDeliveryHref(mapped) : null;
}

function legacyNotificationView(view: NotificationDeliveryView, review: string): NotificationDeliveryView | null {
  if (review === 'delivery-incidents') return { ...view, mode: 'action', issue: 'groups', scope: 'current', range: 'all', page: 1 };
  if (review === 'delivery-incident-history') return { ...view, mode: 'action', issue: 'groups', scope: 'history', range: 'all', page: 1 };
  if (['failed', 'needs-retry', 'unresolved-failed'].includes(review)) return { ...view, mode: 'action', issue: 'failed', range: 'all', page: 1 };
  if (['disabled-device', 'no-push-path'].includes(review)) return { ...view, mode: 'action', issue: 'no-route', range: 'all', page: 1 };
  if (review === 'delivery-gap') return { ...view, mode: 'action', issue: 'no-attempt', range: 'all', page: 1 };
  if (review === 'stale-device') return { ...view, mode: 'action', issue: 'stale-route', range: 'all', page: 1 };
  if (review === 'unattempted' || review === 'pending') return { ...view, mode: 'records', status: 'not-attempted', page: 1 };
  if (review === 'sent') return { ...view, mode: 'records', status: 'accepted', page: 1 };
  if (review === 'skipped') return { ...view, mode: 'records', status: 'skipped', page: 1 };
  if (review === 'fcm') return { ...view, mode: 'records', channel: 'fcm', page: 1 };
  if (review === 'in-app-route') return { ...view, mode: 'records', channel: 'in-app', page: 1 };
  if (review === 'all') return { ...view, mode: 'records', page: 1 };
  if (['partner-alerts', 'no-show', 'payout-setup'].includes(review)) {
    return { ...view, mode: 'records', type: review, page: 1 };
  }
  return null;
}

function notificationIssueReview(issue: NotificationDeliveryIssue, scope: NotificationActionScope = 'current') {
  if (issue === 'failed') return 'failed';
  if (issue === 'no-attempt') return 'delivery-gap';
  if (issue === 'no-route') return 'no-push-path';
  if (issue === 'stale-route') return 'stale-device';
  if (scope === 'history') return 'delivery-incident-history';
  if (scope === 'all') return 'delivery-incidents-all';
  return 'delivery-incidents';
}

function notificationRecordStatusReview(status: NotificationDeliveryRecordStatus) {
  if (status === 'accepted') return 'sent';
  if (status === 'failed') return 'failed';
  if (status === 'skipped') return 'skipped';
  if (status === 'not-attempted') return 'unattempted';
  return 'all';
}

function normalizeNotificationDeliveryIssue(value: string): NotificationDeliveryIssue {
  return ['failed', 'no-attempt', 'no-route', 'stale-route'].includes(value)
    ? value as NotificationDeliveryIssue
    : 'groups';
}

function normalizeNotificationActionScope(value: string): NotificationActionScope {
  return ['15-60m', '1-24h', 'history', 'all'].includes(value)
    ? value as NotificationActionScope
    : 'current';
}

function normalizeNotificationDataScope(value: string): NotificationDataScopeFilter {
  return value === 'unknown' || value === 'synthetic' ? value : 'production';
}

export function normalizeNotificationFailureProvider(value: string) {
  const normalized = value.trim().toUpperCase();
  return isSafeNotificationFilterValue(normalized, 80) ? normalized : '';
}

export function normalizeNotificationFailureCode(value: string) {
  const normalized = value.trim();
  return isSafeNotificationFilterValue(normalized, 160) ? normalized : '';
}

function isSafeNotificationFilterValue(value: string, maxLength: number) {
  return Boolean(value) && value.length <= maxLength && !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function normalizeNotificationDeliveryRecordStatus(value: string): NotificationDeliveryRecordStatus {
  return ['accepted', 'failed', 'skipped', 'not-attempted'].includes(value)
    ? value as NotificationDeliveryRecordStatus
    : 'all';
}

function normalizeNotificationDeliveryRecipientRole(value: string): NotificationDeliveryRecipientRole {
  return ['customer', 'provider', 'admin'].includes(value)
    ? value as NotificationDeliveryRecipientRole
    : 'all';
}

function normalizeNotificationDeliveryChannel(value: string): NotificationDeliveryChannel {
  return value === 'fcm' || value === 'in-app' ? value : 'all';
}

function notificationChannelApiValue(value: NotificationDeliveryChannel) {
  return value === 'in-app' ? 'IN_APP_ONLY' : value.toUpperCase();
}

function appendNotificationRecordApiFilters(
  query: URLSearchParams,
  params: Record<string, string | string[] | undefined>,
) {
  const search = readSearchParam(params.q).trim();
  const recipientRole = readSearchParam(params.recipientRole).trim();
  const channel = readSearchParam(params.channel).trim();
  const scope = readSearchParam(params.scope).trim();
  const failureProvider = normalizeNotificationFailureProvider(readSearchParam(params.failureProvider));
  const failureCode = normalizeNotificationFailureCode(readSearchParam(params.failureCode));
  const campaignId = readSearchParam(params.campaignId).trim();
  if (search) query.set('q', search);
  if (campaignId) query.set('campaignId', campaignId);
  if (recipientRole) query.set('recipientRole', recipientRole);
  if (channel) query.set('channel', channel);
  if (scope) query.set('scope', scope);
  if (failureProvider && failureCode) {
    query.set('failureProvider', failureProvider);
    query.set('failureCode', failureCode);
  }
}

function notificationSummaryFromServer(
  serverSummary: AdminNotificationBoardSummary,
  fallback: NotificationSummary,
): NotificationSummary {
  return {
    awaitingWorker: serverSummary.awaitingWorker ?? fallback.awaitingWorker,
    deliveryIncidentNotifications:
      serverSummary.deliveryIncidentNotificationCount ?? fallback.deliveryIncidentNotifications,
    deliveryIncidents: serverSummary.openDeliveryIncidentCount ?? fallback.deliveryIncidents,
    deliveryGaps: serverSummary.deliveryGaps ?? fallback.deliveryGaps,
    disabledDevices: serverSummary.disabledDevices ?? fallback.disabledDevices,
    disabledDeviceUsers: serverSummary.disabledDeviceUsers ?? fallback.disabledDeviceUsers,
    failed: serverSummary.failed ?? fallback.failed,
    failedAttempts: serverSummary.failedAttempts ?? fallback.failedAttempts,
    historicalDeliveryIncidents:
      serverSummary.historicalDeliveryIncidentCount ?? fallback.historicalDeliveryIncidents,
    needsRetry: serverSummary.needsRetry ?? fallback.needsRetry,
    noShow: serverSummary.noShow ?? fallback.noShow,
    noPushPath: serverSummary.noPushPath ?? fallback.noPushPath,
    payoutSetup: serverSummary.payoutSetup ?? fallback.payoutSetup,
    pending: serverSummary.pending ?? fallback.pending,
    sent: serverSummary.sent ?? fallback.sent,
    skipped: serverSummary.skipped ?? fallback.skipped,
    staleDevices: serverSummary.staleDevices ?? fallback.staleDevices,
    staleDeviceUsers: serverSummary.staleDeviceUsers ?? fallback.staleDeviceUsers,
    unattempted: serverSummary.unattempted ?? serverSummary.pending ?? fallback.unattempted,
  };
}

function notificationDeliveryStatsFromServerSummary(
  serverSummary: AdminNotificationBoardSummary,
  fallback: NotificationDeliveryStats,
): NotificationDeliveryStats {
  return {
    disabledDevices: serverSummary.disabledDevices ?? fallback.disabledDevices,
    disabledDeviceUsers: serverSummary.disabledDeviceUsers ?? fallback.disabledDeviceUsers,
    failedDeliveries: serverSummary.failedAttempts ?? fallback.failedDeliveries,
    failedNotifications:
      serverSummary.needsRetry ?? serverSummary.failed ?? fallback.failedNotifications,
    pendingNotifications: serverSummary.pending ?? fallback.pendingNotifications,
    retrySignalNotifications: serverSummary.needsRetry ?? fallback.retrySignalNotifications,
    sentDeliveries: serverSummary.sent ?? fallback.sentDeliveries,
    skippedDeliveries: serverSummary.skipped ?? fallback.skippedDeliveries,
    skippedNotifications: serverSummary.skipped ?? fallback.skippedNotifications,
    staleDevices: serverSummary.staleDevices ?? fallback.staleDevices,
    staleDeviceUsers: serverSummary.staleDeviceUsers ?? fallback.staleDeviceUsers,
    stalePushDeviceDeliveries: fallback.stalePushDeviceDeliveries,
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
  summary: NotificationSummary,
): readonly AdminPageMetric[] {
  return [
    {
      kind: 'risk',
      label: 'Open delivery incidents',
      scope: 'Last 24 hours',
      value: summary.deliveryIncidents,
      helper: `${summary.deliveryIncidentNotifications} affected notification${summary.deliveryIncidentNotifications === 1 ? '' : 's'}, grouped by technical cause.`,
    },
    {
      kind: 'risk',
      label: 'Delivery not confirmed',
      scope: 'Needs action',
      value: summary.deliveryGaps,
      helper: 'More than 15 minutes old with no delivery confirmation.',
    },
    {
      kind: 'risk',
      label: 'Push unavailable',
      scope: 'Needs action',
      value: summary.disabledDeviceUsers,
      helper: 'Users whose app cannot currently receive a mobile alert. Contact directly when urgent.',
    },
    {
      kind: 'risk',
      label: 'App reopen needed',
      scope: 'Needs action',
      value: summary.staleDeviceUsers,
      helper: `Users whose app has not checked in for ${STALE_PUSH_DEVICE_AGE_DAYS}+ days. Ask them to reopen it before relying on mobile alerts.`,
    },
  ];
}

export function buildNotificationIncidentMetrics(
  summary: NotificationSummary,
  filters: NotificationFilters,
): readonly AdminPageMetric[] {
  if (filters.review !== 'delivery-incident-history') {
    return buildNotificationMetrics(summary);
  }
  return [
    {
      kind: 'record',
      label: 'Historical delivery incidents',
      scope: 'Older than 24 hours',
      value: summary.historicalDeliveryIncidents,
      helper: 'Retained for cleanup and audit. Excluded from current delivery SLA counts.',
    },
    {
      kind: 'record',
      label: 'Affected notification records',
      scope: notificationDateRangeLabel(filters.range),
      value: summary.deliveryIncidentNotifications,
      helper: 'Notification records represented by the historical incident rows below.',
    },
  ];
}

export function buildNotificationRecordMetrics(
  totalCount: number,
  summary: NotificationSummary,
  filters: NotificationFilters,
): readonly AdminPageMetric[] {
  const scope = notificationDateRangeLabel(filters.range);

  return [
    {
      href: buildNotificationListHref({ ...filters, review: 'all' }),
      kind: 'record',
      label: 'All notification records',
      scope,
      value: totalCount,
      helper: 'Notification rows in the selected date range. The table remains server paginated.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'sent' }),
      kind: 'record',
      label: 'Sent records',
      scope,
      value: summary.sent,
      helper: 'Notifications with successful push delivery evidence.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'skipped' }),
      kind: 'record',
      label: 'Skipped records',
      scope,
      value: summary.skipped,
      helper: 'Notifications intentionally kept in-app or skipped by delivery policy.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'delivery-incident-history' }),
      kind: 'record',
      label: 'Historical delivery incidents',
      scope: 'Older than 24 hours',
      value: summary.historicalDeliveryIncidents,
      helper: 'Cleanup and audit only. These incidents do not count toward the current delivery SLA.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'no-push-path' }),
      kind: 'record',
      label: 'Push unavailable records',
      scope,
      value: summary.noPushPath,
      helper:
        'Inbox records for users whose app could not receive a mobile alert.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'unattempted' }),
      kind: 'record',
      label: 'All unattempted records',
      scope,
      value: summary.unattempted,
      helper:
        'Complete historical inbox set without delivery evidence, including no-device records and confirmed delivery gaps.',
    },
  ];
}

export function buildNotificationChannelMetrics(
  summary: NotificationSummary,
  channelSummary: NotificationChannelSummary,
  filters: NotificationFilters,
): readonly AdminPageMetric[] {
  const scope = notificationDateRangeLabel(filters.range);

  return [
    {
      kind: 'record',
      label: 'Unavailable mobile routes',
      scope: 'Current device registry',
      value: summary.disabledDevices,
      helper:
        'Registered app routes that cannot currently receive mobile alerts.',
    },
    {
      kind: 'record',
      label: 'Inactive app routes',
      scope: 'Current device registry',
      value: summary.staleDevices,
      helper: `Registered app routes not seen for ${STALE_PUSH_DEVICE_AGE_DAYS}+ days. This is a route count, not a notification total.`,
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'payout-setup' }),
      kind: 'record',
      label: 'Payout setup alerts',
      scope,
      value: summary.payoutSetup,
      helper: 'Partner payout setup notification records.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'partner-alerts' }),
      kind: 'record',
      label: 'Partner alert records',
      scope,
      value: channelSummary.partnerAlertCount,
      helper: 'Partner-facing notification records in the selected date range.',
    },
    {
      href: buildNotificationListHref({ ...filters, review: 'no-show' }),
      kind: 'record',
      label: 'No-show alert records',
      scope,
      value: summary.noShow,
      helper: 'No-show support notification records.',
    },
    {
      kind: 'record',
      label: 'Mobile push attempts',
      scope,
      value: channelSummary.fcmDeliveries,
      helper:
        'Mobile push attempts across the selected records. One notification may have more than one attempt.',
    },
  ];
}

function buildFinanceOverdueMetrics(
  totalCount: number,
  filters: NotificationFilters,
): readonly AdminPageMetric[] {
  const resolved = filters.review === 'finance-overdue-history';
  return [
    {
      href: buildNotificationListHref(filters),
      kind: resolved ? 'record' : 'risk',
      label: resolved ? 'Resolved Finance reviews' : 'Overdue Finance reviews',
      scope: resolved ? notificationDateRangeLabel(filters.range) : 'Needs action',
      value: totalCount,
      helper: resolved
        ? 'Resolved bank reconciliation SLA alerts retained as historical evidence.'
        : 'Bank reconciliation reviews still unresolved more than 48 hours after import or assignment.',
    },
  ];
}

function buildSystemIncidentMetrics(
  serverSummary: AdminNotificationBoardSummary | null | undefined,
  notifications: readonly AdminNotification[],
  filters: NotificationFilters,
): readonly AdminPageMetric[] {
  const fallback = groupSystemIncidentNotifications(notifications).reduce(
    (counts, notification) => {
      if (!notification.type.startsWith('admin.system.')) return counts;
      counts.total += 1;
      const incidentStatus = readString(asRecord(notification.data)?.incidentStatus);
      if (incidentStatus === 'OPEN') counts.open += 1;
      else if (incidentStatus === 'RECOVERED') counts.recovered += 1;
      else if (!incidentStatus) counts.legacy += 1;
      return counts;
    },
    { legacy: 0, open: 0, recovered: 0, total: 0 },
  );
  const rangeLabel = notificationDateRangeLabel(filters.range);
  const incidentHref = (incidentState: NotificationIncidentState) =>
    buildNotificationListHref({ ...filters, incidentState });

  return [
    {
      href: incidentHref('open'),
      kind: 'action',
      label: 'Open incidents',
      scope: 'Needs action',
      value: serverSummary?.openSystemIncidentCount ?? fallback.open,
      helper: 'Unrecovered system incidents in the selected period.',
    },
    {
      href: incidentHref('recovered'),
      kind: 'period',
      label: 'Recovered incidents',
      scope: rangeLabel,
      value: serverSummary?.recoveredSystemIncidentCount ?? fallback.recovered,
      helper: 'Source incidents confirmed recovered in the selected period.',
    },
    {
      href: incidentHref('legacy'),
      kind: 'risk',
      label: 'Legacy review',
      scope: 'Needs action',
      value: serverSummary?.legacySystemIncidentCount ?? fallback.legacy,
      helper: 'Older system alerts without persisted incident state.',
    },
    {
      href: incidentHref('all'),
      kind: 'record',
      label: 'Incident sources',
      scope: rangeLabel,
      value: serverSummary?.systemIncidentCount ?? fallback.total,
      helper: serverSummary?.systemIncidentSourceSummaryComplete === false
        ? 'Distinct sources in the bounded incident summary; older sources may exist.'
        : 'Distinct system incident sources in the selected period.',
    },
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

export function sortFinanceReviewNotifications(
  notifications: readonly AdminNotification[],
  state: 'open' | 'resolved',
) {
  return [...notifications].sort((left, right) => {
    if (state === 'resolved') {
      const resolvedDiff = financeReviewResolvedAtMs(right) - financeReviewResolvedAtMs(left);
      if (resolvedDiff !== 0) return resolvedDiff;
      return right.id.localeCompare(left.id);
    }
    const startedDiff = financeReviewStartedAtMs(left) - financeReviewStartedAtMs(right);
    if (startedDiff !== 0) return startedDiff;
    return left.id.localeCompare(right.id);
  });
}

function financeReviewStartedAtMs(notification: AdminNotification) {
  const startedAt = readString(asRecord(notification.data)?.financeReviewStartedAt);
  const parsed = Date.parse(startedAt ?? notification.createdAt);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function financeReviewResolvedAtMs(notification: AdminNotification) {
  const resolvedAt = readString(asRecord(notification.data)?.financeReviewResolvedAt);
  const parsed = Date.parse(resolvedAt ?? notification.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function notificationFinanceReviewDisplay(notification: AdminNotification) {
  if (!isFinanceOverdueNotification(notification)) return null;
  const data = asRecord(notification.data);
  const owner = asRecord(data?.financeReviewOwner);
  const ownerId = readString(owner?.id);
  const ownerEmail = readString(owner?.email);
  const ownerFullName = readString(owner?.fullName);
  const rawAgeHours = Number(data?.financeReviewAgeHours);
  const ageHours = Number.isFinite(rawAgeHours) && rawAgeHours >= 0
    ? Math.floor(rawAgeHours)
    : Math.max(0, Math.floor((Date.now() - financeReviewStartedAtMs(notification)) / (60 * 60 * 1000)));
  const resolved = isResolvedFinanceOverdueNotification(notification);

  return {
    ageLabel: resolved ? `${ageHours}h to resolve` : `${ageHours}h open`,
    ownerId,
    ownerHelper: ownerEmail ?? (ownerId ? `Admin ${shortId(ownerId)}` : 'Assign from the Finance record'),
    ownerLabel: ownerFullName ?? ownerEmail ?? 'Unassigned',
    startedAt: readString(data?.financeReviewStartedAt) ?? notification.createdAt,
  };
}

export function groupSystemIncidentNotifications(
  notifications: readonly AdminNotification[],
): AdminNotification[] {
  const groups = new Map<string, {
    notificationCount: number;
    precomputedRecipientCount: number;
    recipientKeys: Set<string>;
    representative: AdminNotification;
  }>();

  for (const notification of sortNotifications(notifications)) {
    const sourceKey = notificationSystemIncidentSourceKey(notification);
    const existing = groups.get(sourceKey);
    const data = asRecord(notification.data);
    const notificationCount = positiveInteger(data?.systemIncidentNotificationCount) || 1;
    const recipientCount = positiveInteger(data?.systemIncidentRecipientCount);
    const recipientKey = notification.user?.id ?? notification.user?.phone ?? notification.id;
    if (!existing) {
      groups.set(sourceKey, {
        notificationCount,
        precomputedRecipientCount: recipientCount,
        recipientKeys: new Set([recipientKey]),
        representative: notification,
      });
      continue;
    }
    existing.notificationCount += notificationCount;
    existing.precomputedRecipientCount = Math.max(existing.precomputedRecipientCount, recipientCount);
    existing.recipientKeys.add(recipientKey);
    if (notificationSystemIncidentDisplayPriority(notification)
      > notificationSystemIncidentDisplayPriority(existing.representative)) {
      existing.representative = notification;
    }
  }

  return [...groups.entries()].map(([sourceKey, group]) => ({
    ...group.representative,
    data: {
      ...asRecord(group.representative.data),
      systemIncidentNotificationCount: group.notificationCount,
      systemIncidentRecipientCount: Math.max(group.precomputedRecipientCount, group.recipientKeys.size),
      systemIncidentSourceKey: sourceKey,
    },
  }));
}

function notificationSystemIncidentSourceKey(notification: AdminNotification) {
  const data = asRecord(notification.data);
  const persistedSourceKey = readString(data?.systemIncidentSourceKey);
  if (persistedSourceKey) return persistedSourceKey;
  const incidentId = readString(data?.incidentId);
  if (incidentId) return `incident:${incidentId}`;
  if (notification.type.startsWith('admin.system.background_job')) {
    const queueName = readString(data?.queueName);
    const jobId = readString(data?.jobId);
    if (queueName && jobId) return `job:${queueName}:${jobId}`;
  }
  return `notification:${notification.id}`;
}

function notificationSystemIncidentDisplayPriority(notification: AdminNotification) {
  const data = asRecord(notification.data);
  const status = readString(data?.incidentStatus);
  if (status === 'OPEN') return 4;
  if (!status) return 3;
  if (status === 'RECOVERED') return 2;
  return 1;
}

export function buildNotificationTableRows(
  notifications: readonly AdminNotification[],
  actionContext: NotificationActionReturnContext = {},
): NotificationTableRow[] {
  return notifications.map((notification) => {
    const financeReview = notificationFinanceReviewDisplay(notification);
    const partnerProfile = notification.user?.providerProfile;
    const partnerLabel = notificationPartnerLabel(partnerProfile);
    const deliveryHealth = notificationDeliveryHealth(notification);
    const operationalHealth =
      notificationFinanceOverdueHealth(notification) ??
      notificationIncidentHealth(notification) ??
      deliveryHealth;
    const sourceRecipientCount = positiveInteger(asRecord(notification.data)?.systemIncidentRecipientCount);
    const sourceNotificationCount = positiveInteger(asRecord(notification.data)?.systemIncidentNotificationCount);
    const isGroupedSystemIncident = sourceNotificationCount > 1;
    const deliveryIncident = notificationDeliveryIncident(notification, actionContext);
    const routeGroup = notificationDeliveryRouteGroup(notification);
    const actions = notificationActionMenuItems(notification, actionContext, deliveryHealth);
    const primaryAction = notificationPrimaryAction(notification, actions);

    return {
      actionLabel: `Actions for ${notificationUserLabel(notification)} · ${marketplaceDisplayText(notification.title)} · ${formatDateTime(notification.createdAt)}`,
      actions: primaryAction ? actions.filter((action) => action !== primaryAction.source) : actions,
      body: marketplaceDisplayText(notification.body),
      bookingDataHint: notificationDataHint(notification),
      createdAt: financeReview?.startedAt ?? notification.createdAt,
      deliveryAttemptCount: notificationDeliveries(notification).length,
      deliveryRows: buildNotificationDeliveryRows(notification),
      id: notification.id,
      incident: deliveryIncident,
      primaryAction: primaryAction?.action,
      routeGroup,
      opsHint: opsHint(notification, operationalHealth),
      opsSignal: operationalHealth.signalLabel,
      partnerHref: financeReview ? null : partnerProfile ? `/partners/${partnerProfile.id}` : null,
      partnerLabel: financeReview ? null : partnerLabel,
      partnerStatus: financeReview ? null : partnerProfile?.status ?? null,
      relativeCreatedAtLabel: financeReview?.ageLabel ??
        formatRelativeTime(notification.createdAt, { justNow: 'Updated just now' }),
      signalClassName: operationalHealth.signalClassName,
      title: marketplaceDisplayText(notification.title),
      typeLabel: marketplaceDisplayText(humanizeType(notification.type)),
      typeMeaning: typeMeaning(notification.type),
      userAvatarStatus: notificationUserAvatarStatus(notification),
      userHref: isGroupedSystemIncident || financeReview ? null : notificationUserHref(notification),
      userLabel: financeReview
        ? financeReview.ownerLabel
        : isGroupedSystemIncident
        ? `${sourceRecipientCount} Admin recipient${sourceRecipientCount === 1 ? '' : 's'}`
        : notificationUserLabel(notification),
      userPhone: financeReview
        ? financeReview.ownerHelper
        : isGroupedSystemIncident
        ? `${sourceNotificationCount} retained recipient alerts`
        : maskNotificationPhone(notification.user?.phone),
    };
  });
}

function notificationDeliveryIncident(
  notification: AdminNotification,
  actionContext: NotificationActionReturnContext = {},
): NotificationTableRow['incident'] {
  const data = asRecord(notification.data);
  const key = readString(data?.deliveryIncidentKey);
  const failureCode = readString(data?.deliveryIncidentFailureCode);
  const firstOccurredAt = readString(data?.deliveryIncidentFirstOccurredAt);
  const lastOccurredAt = readString(data?.deliveryIncidentLastOccurredAt);
  const provider = readString(data?.deliveryIncidentProvider);
  if (!key || !failureCode || !firstOccurredAt || !lastOccurredAt || !provider) {
    return undefined;
  }
  const runbook = notificationFailureRunbook(failureCode);
  const href = buildNotificationDeliveryHref(
    buildNotificationDeliveryView({ dataScope: actionContext.dataScope }),
    {
      failureCode,
      failureProvider: provider,
      issue: 'failed',
      page: 1,
      scope: data?.deliveryIncidentHistory === true ? 'history' : 'current',
    },
  );
  return {
    affectedUserCount: positiveInteger(data?.deliveryIncidentAffectedUserCount),
    failureCode,
    failureCodeLabel: notificationFailureCodeLabel(failureCode),
    firstOccurredAt,
    historical: data?.deliveryIncidentHistory === true,
    href,
    lastOccurredAt,
    notificationCount: positiveInteger(data?.deliveryIncidentNotificationCount),
    ownerLabel: runbook.ownerLabel,
    provider,
    retryCondition: runbook.retryCondition,
    technicalAction: runbook.technicalAction,
    windowMinutes: positiveInteger(data?.deliveryIncidentWindowMinutes) || 60,
  };
}

function notificationDeliveryRouteGroup(notification: AdminNotification): NotificationTableRow['routeGroup'] {
  const data = asRecord(notification.data);
  const firstOccurredAt = readString(data?.deliveryRouteGroupFirstOccurredAt);
  const latestOccurredAt = readString(data?.deliveryRouteGroupLatestOccurredAt);
  const notificationCount = positiveInteger(data?.deliveryRouteGroupNotificationCount);
  const targetRole = readString(data?.deliveryRouteGroupTargetRole);
  if (!firstOccurredAt || !latestOccurredAt || !notificationCount || !targetRole) return undefined;
  return { firstOccurredAt, latestOccurredAt, notificationCount, targetRole };
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
  const devices = notificationAvatarDevices(notification);
  return devices.some((device) => device.enabled === true)
    ? 'online'
    : adminAvatarStatusFromSignals({ devices });
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
  now = new Date(),
): NotificationSummary {
  const unattemptedStats = buildNotificationUnattemptedStats(notifications);
  const incidentStats = buildLoadedNotificationIncidentStats(notifications, now);
  return {
    awaitingWorker: unattemptedStats.awaitingWorker,
    deliveryIncidentNotifications: incidentStats.currentNotifications,
    deliveryIncidents: incidentStats.currentIncidents,
    deliveryGaps: unattemptedStats.deliveryGaps,
    disabledDevices: deliveryStats.disabledDevices,
    disabledDeviceUsers: deliveryStats.disabledDeviceUsers,
    failed: deliveryStats.failedNotifications,
    failedAttempts: deliveryStats.failedDeliveries,
    historicalDeliveryIncidents: incidentStats.historicalIncidents,
    needsRetry: deliveryStats.retrySignalNotifications,
    noShow: notifications.filter((notification) => notification.type === 'booking.no_show').length,
    noPushPath: unattemptedStats.noPushPath,
    payoutSetup: notifications.filter(
      (notification) => notification.type === 'provider.payout_setup_required',
    ).length,
    pending: deliveryStats.pendingNotifications,
    sent: deliveryStats.sentDeliveries,
    skipped: deliveryStats.skippedDeliveries,
    staleDevices: deliveryStats.staleDevices,
    staleDeviceUsers: deliveryStats.staleDeviceUsers,
    unattempted: deliveryStats.pendingNotifications,
  };
}

function buildLoadedNotificationIncidentStats(
  notifications: readonly AdminNotification[],
  now: Date,
) {
  const cutoffMs = now.getTime() - DELIVERY_INCIDENT_HISTORY_HOURS * 60 * 60 * 1000;
  const current = new Set<string>();
  const historical = new Set<string>();
  let currentNotifications = 0;

  for (const notification of notifications) {
    const disposition = notificationDeliveryDisposition(notification);
    if (disposition !== 'failed' && disposition !== 'partial') continue;
    const latestFailure = newestDeliveries(notificationDeliveries(notification)).find(
      (delivery) => delivery.status === 'FAILED',
    );
    if (!latestFailure) continue;
    const attemptedAt = deliveryAttemptMs(latestFailure);
    const failureCode = notificationDeliveryFailureCode(latestFailure) ?? 'UNCLASSIFIED_FAILURE';
    const windowBucket = Math.floor(attemptedAt / (60 * 60 * 1000));
    const key = `${latestFailure.provider}:${failureCode}:${windowBucket}`;
    if (attemptedAt >= cutoffMs) {
      current.add(key);
      currentNotifications += 1;
    } else {
      historical.add(key);
    }
  }

  return {
    currentIncidents: current.size,
    currentNotifications,
    historicalIncidents: historical.size,
  };
}

export function buildNotificationDeliveryStats(
  notifications: readonly AdminNotification[],
  now = new Date(),
): NotificationDeliveryStats {
  const disabledDeviceIds = new Set<string>();
  const disabledUserIds = new Set<string>();
  const staleDeviceIds = new Set<string>();
  const staleUserIds = new Set<string>();
  const staleCutoffMs =
    now.getTime() - STALE_PUSH_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000;
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
    const disposition = notificationDeliveryDisposition(notification);
    let hasStaleDelivery = false;

    for (const device of notification.user?.pushDevices ?? []) {
      const deviceId = device.id ?? `${notification.id}-${device.role ?? 'device'}`;
      const userId = notification.user?.id ?? `notification:${notification.id}`;
      if (device.enabled === false) {
        disabledDeviceIds.add(deviceId);
        disabledUserIds.add(userId);
        continue;
      }
      const lastSeenAtMs = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : Number.NaN;
      if (
        device.enabled === true &&
        Number.isFinite(lastSeenAtMs) &&
        lastSeenAtMs <= staleCutoffMs
      ) {
        staleDeviceIds.add(deviceId);
        staleUserIds.add(userId);
      }
    }

    if (deliveries.length === 0) {
      pendingNotifications += 1;
    }

    if (disposition === 'failed' || disposition === 'partial') {
      failedNotifications += 1;
    }
    if (disposition === 'skipped') {
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
        disabledUserIds.add(notification.user?.id ?? `notification:${notification.id}`);
      }

      if (isCurrentlyStalePushDeviceDelivery(delivery, now)) {
        stalePushDeviceDeliveries += 1;
        hasStaleDelivery = true;
        staleDeviceIds.add(
          delivery.pushDevice?.id ?? `${notification.id}-${delivery.id ?? delivery.attemptedAt}`,
        );
        staleUserIds.add(notification.user?.id ?? `notification:${notification.id}`);
      }
    }

    if (
      disposition !== 'delivered' &&
      (
        disposition === 'failed' ||
        disposition === 'partial' ||
        newestDeliveries(deliveries)[0]?.pushDevice?.enabled === false ||
        hasStaleDelivery
      )
    ) {
      retrySignalNotifications += 1;
    }
  }

  return {
    disabledDevices: disabledDeviceIds.size,
    disabledDeviceUsers: disabledUserIds.size,
    failedDeliveries,
    failedNotifications,
    pendingNotifications,
    retrySignalNotifications,
    sentDeliveries,
    skippedDeliveries,
    skippedNotifications,
    staleDevices: staleDeviceIds.size,
    staleDeviceUsers: staleUserIds.size,
    stalePushDeviceDeliveries,
  };
}

export function buildNotificationDeliveryOpsQueue(
  notifications: readonly AdminNotification[],
  deliveryStats = buildNotificationDeliveryStats(notifications),
  deliveryGaps = buildNotificationUnattemptedStats(notifications).deliveryGaps,
  filters?: NotificationFilters,
  summary = buildNotificationSummary(notifications, deliveryStats),
): NotificationDeliveryOpsQueueItem[] {
  const reviewHref = (review: string) => (
    filters
      ? buildNotificationListHref({ ...filters, review })
      : `/notifications?review=${review}`
  );
  const queueItems: NotificationDeliveryOpsQueueItem[] = [
    {
      actionLabel: 'Review delivery incidents',
      count: summary.deliveryIncidents,
      detail:
        `${summary.deliveryIncidentNotifications} affected notification${summary.deliveryIncidentNotifications === 1 ? '' : 's'} grouped by provider and failure code. Contact affected users when urgent; Platform reviews the technical cause.`,
      href: reviewHref('delivery-incidents'),
      key: 'delivery-incidents',
      label: 'Open incidents',
      tone: 'danger',
    },
    {
      actionLabel: 'Review unconfirmed alerts',
      count: deliveryGaps,
      detail:
        'Delivery has not been confirmed after 15 minutes. Contact the user directly if the alert is urgent.',
      href: reviewHref('delivery-gap'),
      key: 'delivery-gaps',
      label: 'Delivery not confirmed',
      tone: 'danger',
    },
    {
      actionLabel: 'Review affected users',
      count: deliveryStats.disabledDeviceUsers,
      detail: `${adminCountLabel(deliveryStats.disabledDevices, 'app route')} cannot receive mobile alerts. Contact the user directly if urgent and ask them to reopen the app before retrying.`,
      href: reviewHref('disabled-device'),
      key: 'disabled-devices',
      label: 'Push unavailable',
      tone: 'warning',
    },
    {
      actionLabel: 'Review inactive users',
      count: deliveryStats.staleDeviceUsers,
      detail: `${adminCountLabel(deliveryStats.staleDevices, 'app route')} ${deliveryStats.staleDevices === 1 ? 'has' : 'have'} not been active for ${STALE_PUSH_DEVICE_AGE_DAYS}+ days. Ask the user to reopen the app before relying on another mobile alert.`,
      href: reviewHref('stale-device'),
      key: 'stale-devices',
      label: 'App reopen needed',
      tone: 'info',
    },
  ];

  return queueItems.filter((item) => item.count > 0);
}

function buildNotificationUnattemptedStats(
  notifications: readonly AdminNotification[],
  now = new Date(),
) {
  const cutoffMs = now.getTime() - DELIVERY_GAP_MINUTES * 60 * 1000;
  let awaitingWorker = 0;
  let deliveryGaps = 0;
  let noPushPath = 0;

  for (const notification of notifications) {
    if (!hasNoDeliveryAttempts(notification)) continue;
    if (!hasEnabledTargetPushDevice(notification)) {
      noPushPath += 1;
      continue;
    }
    const createdAtMs = Date.parse(notification.createdAt ?? '');
    if (Number.isFinite(createdAtMs) && createdAtMs > cutoffMs) {
      awaitingWorker += 1;
    } else {
      deliveryGaps += 1;
    }
  }

  return { awaitingWorker, deliveryGaps, noPushPath };
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
  if (review === 'delivery-incidents') {
    return booking
      ? `No delivery incidents in the last 24 hours match booking ${shortId(booking)}.`
      : 'No delivery incidents occurred in the last 24 hours.';
  }
  if (review === 'delivery-incident-history') {
    return booking
      ? `No historical delivery incidents match booking ${shortId(booking)}.`
      : 'No delivery incidents are waiting in historical cleanup.';
  }
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
): NotificationDeliveryRow[] {
  const latestByPath = new Map<string, AdminNotificationDelivery>();
  for (const delivery of newestDeliveries(notificationDeliveries(notification))) {
    const key = delivery.pushDevice?.id ?? delivery.pushDeviceId ?? `${delivery.provider}:without-device`;
    if (!latestByPath.has(key)) latestByPath.set(key, delivery);
  }
  return [...latestByPath.values()]
    .sort((left, right) => deliveryStatusPriority(left.status) - deliveryStatusPriority(right.status))
    .slice(0, NOTIFICATION_TABLE_DELIVERY_LIMIT)
    .map((delivery) => ({
      attemptedAt: delivery.attemptedAt,
      deviceFreshnessLabel: notificationPushDeviceFreshnessLabel(delivery),
      deviceLastSeenAt: delivery.pushDevice?.lastSeenAt ?? null,
      deviceIdLabel: maskStableNotificationDeviceId(delivery.pushDevice?.id ?? delivery.pushDeviceId),
      deviceStateLabel: delivery.pushDevice?.enabled === false ? 'Device disabled' : 'Device enabled',
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

function deliveryStatusPriority(status: string) {
  if (status === 'FAILED') return 0;
  if (status === 'SKIPPED') return 1;
  if (status === 'SENT') return 2;
  return 3;
}

function deliveryRecoveryHintLabel(delivery: AdminNotificationDelivery) {
  if (delivery.pushDevice?.enabled === false) {
    return 'Ask the customer or Partner to reopen the app before retrying.';
  }
  if (isStaleNotificationPushDeviceDelivery(delivery)) {
    return 'Ask the user to reopen the app, then review the latest delivery before retrying.';
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
  if (notificationDeliveryDisposition(notification) === 'delivered') return false;
  const now = new Date();
  const targetRole = notificationTargetRole(notification);
  return (notification.user?.pushDevices ?? []).some((device) => {
    if (device.enabled !== true || (targetRole && device.role?.toUpperCase() !== targetRole)) return false;
    const lastSeenAt = Date.parse(device.lastSeenAt ?? '');
    return Number.isFinite(lastSeenAt) && lastSeenAt <= now.getTime() - STALE_PUSH_DEVICE_AGE_DAYS * DAY_MS;
  });
}

export { isStaleNotificationPushDeviceDelivery as isStalePushDeviceDelivery };

function isCurrentlyStalePushDeviceDelivery(
  delivery: AdminNotificationDelivery,
  now: Date,
) {
  if (delivery.pushDevice?.enabled !== true) {
    return false;
  }
  const lastSeenAtMs = Date.parse(delivery.pushDevice.lastSeenAt ?? '');
  if (!Number.isFinite(lastSeenAtMs)) {
    return false;
  }
  return (
    lastSeenAtMs <=
    now.getTime() - STALE_PUSH_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000
  );
}

function hasRetrySignal(notification: AdminNotification) {
  const disposition = notificationDeliveryDisposition(notification);
  return disposition === 'failed' || disposition === 'partial';
}

function hasUnresolvedFailedDelivery(notification: AdminNotification) {
  const disposition = notificationDeliveryDisposition(notification);
  if (disposition === 'partial') return true;
  const deliveries = notificationDeliveries(notification);
  return (
    deliveries.some((delivery) => delivery.status === 'FAILED') &&
    !deliveries.some((delivery) => ['SENT', 'DELIVERED', 'SUCCESS'].includes(delivery.status))
  );
}

function hasCurrentFailedDelivery(notification: AdminNotification) {
  const disposition = notificationDeliveryDisposition(notification);
  return disposition === 'failed' || disposition === 'partial';
}

type NotificationDeliveryHealth = {
  readonly hint: string;
  readonly priority: number;
  readonly retryAllowed: boolean;
  readonly retryActionDescription: string;
  readonly retryActionTone: 'info' | 'warning';
  readonly signalClassName: string;
  readonly signalLabel: string;
};

type NotificationOperationalHealth = Pick<
  NotificationDeliveryHealth,
  'hint' | 'priority' | 'signalClassName' | 'signalLabel'
>;

function notificationIncidentHealth(
  notification: AdminNotification,
): NotificationOperationalHealth | null {
  const data = asRecord(notification.data);
  const incidentStatus = readString(data?.incidentStatus);
  if (!notification.type?.startsWith('admin.system.')) return null;
  if (!incidentStatus) {
    return {
      hint: readString(data?.incidentId)
        ? 'Linked incident state is unavailable. Open the incident record and confirm its current status.'
        : 'This legacy system alert has no linked incident record. Open Background Jobs and review the source failure.',
      priority: 5,
      signalClassName: 'signal signal-warn',
      signalLabel: 'Review required',
    };
  }
  if (incidentStatus === 'RECOVERED') {
    const recoveredAt = readString(data?.incidentRecoveredAt);
    return {
      hint: recoveredAt
        ? `Source incident recovered ${formatDateTime(recoveredAt)}. Delivery evidence remains separate.`
        : 'Source incident recovered. Delivery evidence remains separate.',
      priority: 1,
      signalClassName: 'signal signal-ok',
      signalLabel: 'Recovered',
    };
  }
  if (incidentStatus === 'LEGACY_REVIEWED') {
    const reviewedAt = readString(data?.legacyReviewedAt);
    return {
      hint: reviewedAt
        ? `Legacy alert reviewed ${formatDateTime(reviewedAt)}. Audit evidence remains retained.`
        : 'Legacy alert reviewed. Audit evidence remains retained.',
      priority: 0,
      signalClassName: 'signal signal-ok',
      signalLabel: 'Legacy reviewed',
    };
  }
  if (incidentStatus === 'OPEN') {
    return {
      hint: 'Source incident is still open. Review the linked incident before retrying this alert.',
      priority: 6,
      signalClassName: 'signal signal-warn',
      signalLabel: 'Incident open',
    };
  }
  return null;
}

function notificationFinanceOverdueHealth(
  notification: AdminNotification,
): NotificationOperationalHealth | null {
  if (!isFinanceOverdueNotification(notification)) return null;
  const data = asRecord(notification.data);
  const ageHours = Number(data?.financeReviewAgeHours);
  if (isResolvedFinanceOverdueNotification(notification)) {
    return {
      hint: Number.isFinite(ageHours)
        ? `The linked Finance record was resolved after ${Math.max(0, Math.floor(ageHours))} hours. Retain the SLA audit evidence.`
        : 'The linked Finance record is resolved. Keep this row as retained SLA and audit evidence.',
      priority: 1,
      signalClassName: 'signal signal-ok',
      signalLabel: 'Resolved',
    };
  }
  const over72 = readString(data?.financeReviewSlaBand) === 'OVER_72H' || ageHours >= 72;
  return {
    hint: over72
      ? 'This review is over 72 hours old. Open the Finance record, confirm ownership, and resolve it now.'
      : 'Open the linked Finance record, resolve or reassign the overdue review before it reaches 72 hours.',
    priority: over72 ? 7 : 6,
    signalClassName: over72 ? 'signal signal-danger' : 'signal signal-warn',
    signalLabel: over72 ? 'Over 72h' : 'Over 48h',
  };
}

function notificationDeliveryHealth(notification: AdminNotification): NotificationDeliveryHealth {
  const disposition = notificationDeliveryDisposition(notification);
  if (disposition === 'partial') {
    return {
      hint: 'Some mobile deliveries succeeded while at least one delivery is still unresolved.',
      priority: 6,
      retryAllowed: true,
      retryActionDescription: 'Retry only unresolved deliveries; successful deliveries must not be sent again.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'Partial delivery',
    };
  }
  if (disposition === 'failed') {
    return {
      hint: 'Push unavailable · contact by phone if the alert is urgent, then review the latest attempt.',
      priority: 5,
      retryAllowed: true,
      retryActionDescription: 'Review the delivery issue before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'Failed',
    };
  }
  if (disposition === 'delivered') {
    return {
      hint: 'FCM accepted every observed push path. Device receipt or app open is not confirmed.',
      priority: 1,
      retryAllowed: false,
      retryActionDescription: 'This notification is already delivered and cannot be retried from this queue.',
      retryActionTone: 'info',
      signalClassName: 'signal signal-ok',
      signalLabel: 'Accepted by FCM',
    };
  }
  if (hasCurrentDisabledPushDevice(notification)) {
    return {
      hint: 'Push unavailable · contact by phone if the alert is urgent and ask the user to reopen the app.',
      priority: 4,
      retryAllowed: true,
      retryActionDescription: 'Ask the user to reopen the app before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'No active push route',
    };
  }
  if (hasStalePushDeviceDelivery(notification)) {
    return {
      hint: 'The app has not checked in recently. Ask the user to reopen it before relying on another alert.',
      priority: 3,
      retryAllowed: true,
      retryActionDescription: 'Ask the user to reopen the app before retrying this notification.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'App route needs refresh',
    };
  }
  if (disposition === 'skipped') {
    return {
      hint: 'Push was not sent. Use the in-app record or contact the user directly when urgent.',
      priority: 2,
      retryAllowed: true,
      retryActionDescription:
        'Confirm the skipped delivery was intentional before retrying this notification.',
      retryActionTone: 'info',
      signalClassName: 'signal signal-info',
      signalLabel: 'Skipped delivery',
    };
  }
  if (hasNoPushPath(notification)) {
    return {
      hint: 'Push unavailable · use the in-app record or contact the user directly when urgent.',
      priority: 0,
      retryAllowed: false,
      retryActionDescription: 'Ask the user to reopen the app before retrying.',
      retryActionTone: 'info',
      signalClassName: 'signal signal-info',
      signalLabel: 'No active push route',
    };
  }
  if (hasDeliveryGap(notification)) {
    return {
      hint: 'No send attempt appeared within 15 minutes. Check the notification worker before retrying.',
      priority: 4,
      retryAllowed: true,
      retryActionDescription: 'Confirm the alert is still needed before a controlled retry.',
      retryActionTone: 'warning',
      signalClassName: 'signal signal-warn',
      signalLabel: 'No send attempt after 15m',
    };
  }
  return {
    hint: 'Delivery is still being processed within the first 15 minutes.',
    priority: 1,
    retryAllowed: false,
    retryActionDescription: 'Wait for the current delivery attempt to finish before considering retry.',
    retryActionTone: 'info',
    signalClassName: 'signal signal-info',
    signalLabel: 'Delivery pending',
  };
}

function notificationPriority(notification: AdminNotification) {
  return (
    notificationFinanceOverdueHealth(notification) ??
    notificationIncidentHealth(notification) ??
    notificationDeliveryHealth(notification)
  ).priority;
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

  const jobEvidenceHref = notificationBackgroundJobEvidenceHref(notification);
  if (jobEvidenceHref) {
    actions.push({
      description: 'Open the exact retained Background Job recorded by this system alert.',
      href: jobEvidenceHref,
      kind: 'link',
      label: 'Open job evidence',
      tone: 'neutral',
    });
  }

  const destination = safeAdminNotificationDestination(notification);
  if (destination && !(jobEvidenceHref && destinationPathname(destination) === '/background-jobs')) {
    const financeReview = isFinanceOverdueNotification(notification);
    actions.push({
      description: financeReview
        ? 'Open the Finance record to confirm ownership, reconcile evidence, or reassign the review.'
        : 'Open the internal Admin record associated with this notification.',
      href: destination,
      kind: 'link',
      label: financeReview
        ? 'Open Finance review'
        : destination.startsWith('/background-jobs/incidents/')
        ? 'Open incident'
        : 'Open destination',
      tone: financeReview ? 'warning' : 'neutral',
    });
  }

  if (
    isFinanceOverdueNotification(notification) &&
    !isResolvedFinanceOverdueNotification(notification) &&
    actionContext.financeAssigneeAdminId &&
    notificationFinanceReviewDisplay(notification)?.ownerId !== actionContext.financeAssigneeAdminId
  ) {
    actions.push({
      description: 'Take ownership through the existing audited Bank Reconciliation assignment workflow.',
      href: assignFinanceReviewConfirmHref(
        notification.id,
        actionContext.financeAssigneeAdminId,
        actionContext,
      ),
      kind: 'link',
      label: 'Assign to me',
      tone: 'warning',
    });
  }

  if (
    isFinanceOverdueNotification(notification) &&
    !isResolvedFinanceOverdueNotification(notification) &&
    (actionContext.financeAssigneeOptions?.some((option) => (
      option.value && option.value !== notificationFinanceReviewDisplay(notification)?.ownerId
    )) ?? false)
  ) {
    actions.push({
      description: 'Assign or reassign this review to another eligible Finance operator with an audited reason.',
      href: assignFinanceReviewConfirmHref(notification.id, undefined, actionContext),
      kind: 'link',
      label: notificationFinanceReviewDisplay(notification)?.ownerId ? 'Reassign owner' : 'Assign owner',
      tone: 'warning',
    });
  }

  if (isLegacySystemNotificationReviewable(notification)) {
    actions.push({
      description: 'Record an audited manual review for this unlinked legacy system alert.',
      href: legacyReviewNotificationConfirmHref(notification.id, actionContext),
      kind: 'link',
      label: 'Mark reviewed',
      tone: 'warning',
    });
  }

  actions.push({
    description: 'Review send, retry, and device recovery audit events for this notification.',
    href: notificationAuditTrailHref(notification.id),
    kind: 'link',
    label: 'Audit trail',
    tone: 'neutral',
  });

  if (!notification.type.startsWith('admin.system.') && !isFinanceOverdueNotification(notification)) {
    const retryDecision = readNotificationRetryDecision(notification);
    if (actionContext.canRetry && retryDecision.state === 'allowed' && notificationRetryEvidence(notification).eligibleCount > 0) {
      actions.push({
        description: retryDecision.reason,
        href: retryNotificationConfirmHref(notification.id, actionContext),
        kind: 'link',
        label: 'Retry',
        tone: deliveryHealth.retryActionTone,
      });
    } else if (
      actionContext.canRetry &&
      deliveryHealth.retryAllowed &&
      retryDecision.state !== 'allowed'
    ) {
      actions.push({
        description: retryDecision.reason,
        disabled: true,
        href: '#',
        kind: 'link',
        label: retryDecision.state === 'conditional' ? 'Retry cooldown' : 'Retry blocked',
        tone: 'neutral',
      });
    }
  }

  return actions;
}

function notificationPrimaryAction(
  notification: AdminNotification,
  actions: readonly ActionMenuItem[],
): { readonly action: ActionMenuItem; readonly source?: ActionMenuItem } | null {
  const retry = actions.find((action) => action.kind === 'link' && action.label === 'Retry');
  if (retry?.kind === 'link' && ['failed', 'partial'].includes(notificationDeliveryDisposition(notification))) {
    return { action: { ...retry, label: 'Review & retry' }, source: retry };
  }

  if (hasNoPushPath(notification)) {
    const href = notificationUserHref(notification);
    if (href) {
      return {
        action: { href, kind: 'link', label: 'Open recipient', tone: 'warning' },
      };
    }
  }

  const sourceAction = actions.find(
    (action) => action.kind === 'link' && action.label.startsWith('Open ') && action.label !== 'Open audit trail',
  );
  if (sourceAction?.kind === 'link') {
    return { action: sourceAction, source: sourceAction };
  }
  return null;
}

function destinationPathname(destination: string) {
  return destination.split(/[?#]/, 1)[0];
}

function safeAdminNotificationDestination(notification: AdminNotification) {
  const destination = readString(asRecord(notification.data)?.destination)?.trim();
  if (!destination || !destination.startsWith('/') || destination.startsWith('//')) return null;
  if (
    destination.includes('\\') ||
    Array.from(destination).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) return null;
  try {
    const parsed = new URL(destination, 'http://hands-admin.local');
    if (parsed.origin !== 'http://hands-admin.local') return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function notificationAuditTrailHref(notificationId: string) {
  return `/audit-log?bucket=Notification&q=${encodeURIComponent(notificationId)}&range=all`;
}

function notificationUserLabel(notification: AdminNotification) {
  const partnerName = notification.user?.providerProfile?.displayName?.trim();
  if (partnerName) return marketplaceDisplayText(partnerName);
  const fullName = notification.user?.fullName?.trim();
  if (fullName) return marketplaceDisplayText(fullName);
  if (notification.user?.phone) return maskNotificationPhone(notification.user.phone);
  return `User ${shortId(notification.user?.id ?? notification.id)}`;
}

function typeMeaning(type: string) {
  if (FINANCE_OVERDUE_TYPE_SET.has(type)) {
    return 'Overdue Finance reconciliation review';
  }
  if (type.startsWith('admin.system.background_job')) {
    return 'Background job incident alert';
  }
  if (type.startsWith('admin.system.')) {
    return 'Admin system incident alert';
  }
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
  if (isFinanceOverdueNotification(notification)) {
    const bankTransactionId = readString(data?.bankTransactionId);
    const batchImportId = readString(data?.batchImportId);
    if (bankTransactionId) return `bank transaction ${shortId(bankTransactionId)}`;
    if (batchImportId) return `bank import ${shortId(batchImportId)}`;
  }
  if (notification.type.startsWith('admin.system.background_job')) {
    const queueName = readString(data?.queueName);
    const jobId = readString(data?.jobId);
    const parts = [];
    if (queueName) parts.push(`queue ${queueName}`);
    if (jobId) parts.push(`job ${shortBackgroundJobId(jobId)}`);
    const notificationCount = positiveInteger(data?.systemIncidentNotificationCount);
    if (notificationCount > 1) parts.push(`${notificationCount} recipient alerts`);
    if (parts.length > 0) return parts.join(' / ');
  }
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

function shortBackgroundJobId(jobId: string) {
  return jobId.length > 28 ? `...${jobId.slice(-24)}` : jobId;
}

function positiveInteger(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
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

function opsHint(
  notification: AdminNotification,
  operationalHealth: NotificationOperationalHealth = notificationDeliveryHealth(notification),
) {
  const baseHint = opsHintBase(operationalHealth);
  const latestAttemptLabel = latestDeliveryAttemptLabel(notification);
  return latestAttemptLabel ? `${baseHint} Latest attempt ${latestAttemptLabel}.` : baseHint;
}

function opsHintBase(operationalHealth: NotificationOperationalHealth) {
  return operationalHealth.hint;
}

function latestDeliveryAttemptLabel(notification: AdminNotification) {
  const delivery = latestDelivery(notification);
  return delivery ? formatDateTime(delivery.attemptedAt) : null;
}

function isPartnerAlertType(type: string) {
  return PARTNER_ALERT_TYPE_SET.has(type);
}

function isFinanceOverdueNotification(notification: AdminNotification) {
  return FINANCE_OVERDUE_TYPE_SET.has(notification.type);
}

function isOpenFinanceOverdueNotification(notification: AdminNotification) {
  return isFinanceOverdueNotification(notification) && !isResolvedFinanceOverdueNotification(notification);
}

function isResolvedFinanceOverdueNotification(notification: AdminNotification) {
  return (
    isFinanceOverdueNotification(notification) &&
    readString(asRecord(notification.data)?.financeReviewStatus) === 'RESOLVED'
  );
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
  const phone = suggestedNotification.user?.phone ?? partnerAlert.user?.phone ?? '<Partner phone>';
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
    return 'Mobile push for all bookings (legacy saved value)';
  }
  return (setting.options?.find((option) => option.value === value)?.label ?? value)
    .replaceAll('FCM push', 'mobile push')
    .replaceAll('FCM', 'mobile push');
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function hasDisabledPushDevice(notification: AdminNotification) {
  return (
    (notification.user?.pushDevices ?? []).some((device) => device.enabled === false) ||
    notificationDeliveries(notification).some((delivery) => delivery.pushDevice?.enabled === false)
  );
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

function hasDeliveryGap(notification: AdminNotification) {
  if (!hasNoDeliveryAttempts(notification) || !hasEnabledTargetPushDevice(notification)) {
    return false;
  }
  const createdAtMs = Date.parse(notification.createdAt ?? '');
  return Number.isFinite(createdAtMs) && createdAtMs <= Date.now() - DELIVERY_GAP_MINUTES * 60 * 1000;
}

function hasNoPushPath(notification: AdminNotification) {
  return !hasEnabledTargetPushDevice(notification) && notificationDeliveryDisposition(notification) !== 'delivered';
}

export function maskNotificationPhone(value?: string | null) {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : 'Phone masked';
}

function maskStableNotificationDeviceId(value?: string | null) {
  return value ? `••••${value.slice(-4)}` : 'Device unknown';
}

function hasEnabledTargetPushDevice(notification: AdminNotification) {
  const targetRole = notificationTargetRole(notification);
  return (notification.user?.pushDevices ?? []).some(
    (device) =>
      device.enabled === true &&
      (!targetRole || device.role?.toUpperCase() === targetRole),
  );
}

function notificationTargetRole(notification: AdminNotification): 'CUSTOMER' | 'PROVIDER' | null {
  const explicitRole = readString(asRecord(notification.data)?.targetRole)?.toUpperCase();
  if (explicitRole === 'CUSTOMER' || explicitRole === 'PROVIDER') {
    return explicitRole;
  }
  if (LEGACY_CUSTOMER_NOTIFICATION_TYPE_SET.has(notification.type)) {
    return 'CUSTOMER';
  }
  if (LEGACY_PROVIDER_NOTIFICATION_TYPE_SET.has(notification.type)) {
    return 'PROVIDER';
  }
  return null;
}

function latestDelivery(notification: AdminNotification) {
  return newestDeliveries(notificationDeliveries(notification))[0];
}
