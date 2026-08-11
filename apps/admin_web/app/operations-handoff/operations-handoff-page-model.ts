import type {
  AdminAuditLog,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminNotification,
  AdminNotificationBoardSummary,
  AdminOperationsHandoffActivityPage,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import { buildCsvDataHref } from '../../lib/csv-export';
import { formatRelativeTime } from '../../lib/admin-format';
import {
  type AdminDateRange,
  isInDateRange,
  normalizeDateRange,
  readSearchParam,
} from '../../lib/date-range';
import {
  readAdminQueueAge,
  type AdminQueueAge,
  type AdminQueueSort,
} from '../../lib/admin-queue-list';
import type { ActivityStreamRow } from './operations-handoff-activity-stream';
import { OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS } from './operations-handoff-finance-decisions';
import { OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE } from './operations-handoff-pagination';

type OperationsHandoffRangeDataInput = {
  readonly auditLogs: readonly AdminAuditLog[];
  readonly earnings: readonly AdminEarning[];
  readonly payments: readonly AdminPayment[];
  readonly payouts: readonly AdminPayoutBatch[];
  readonly refunds: readonly AdminRefund[];
};

export type OperationsHandoffFilters = {
  readonly activityAge: AdminQueueAge;
  readonly activityBacklog: OperationsHandoffActivityBacklog;
  readonly activityReason: OperationsHandoffActivityReason;
  readonly activityReview: OperationsHandoffActivityReview;
  readonly activitySort: AdminQueueSort;
  readonly activitySource: OperationsHandoffActivitySource;
  readonly detailPages: {
    readonly activity: number;
    readonly bookings: number;
    readonly customers: number;
    readonly decisions: number;
    readonly finance: number;
    readonly partners: number;
  };
  readonly detailsMode: 'summary' | 'all';
  readonly range: ReturnType<typeof normalizeDateRange>;
};

export type OperationsHandoffActivityReview = 'all' | 'needs-review';

export type OperationsHandoffActivityBacklog = 'all' | 'current' | 'legacy';

export type OperationsHandoffActivityReason =
  | 'all'
  | 'booking-state'
  | 'finance-unpaid'
  | 'missing-settlement'
  | 'notification-failure'
  | 'payment';

export type OperationsHandoffActivityReasonCounts = Record<
  OperationsHandoffActivityReason,
  number
>;

export type OperationsHandoffActivitySource =
  | 'all'
  | 'audit'
  | 'booking'
  | 'chat'
  | 'finance'
  | 'notification';

export const OPERATIONS_HANDOFF_ACTIVITY_REVIEW_OPTIONS = [
  { label: 'Needs review', value: 'needs-review' },
  { label: 'All records', value: 'all' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OperationsHandoffActivityReview;
}>;

export const OPERATIONS_HANDOFF_ACTIVITY_BACKLOG_OPTIONS = [
  { label: 'Current 7d', value: 'current' },
  { label: 'Legacy 7d+', value: 'legacy' },
  { label: 'All unresolved', value: 'all' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OperationsHandoffActivityBacklog;
}>;

const OPERATIONS_HANDOFF_ACTIVITY_REASON_OPTIONS = [
  { label: 'All reasons', value: 'all' },
  { label: 'Booking state', value: 'booking-state' },
  { label: 'Payment / refund', value: 'payment' },
  { label: 'Missing settlement', value: 'missing-settlement' },
  { label: 'Notification failure', value: 'notification-failure' },
  { label: 'Finance unpaid', value: 'finance-unpaid' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OperationsHandoffActivityReason;
}>;

export const OPERATIONS_HANDOFF_ACTIVITY_SOURCE_OPTIONS = [
  { label: 'All activity', value: 'all' },
  { label: 'Bookings', value: 'booking' },
  { label: 'Chat', value: 'chat' },
  { label: 'Finance', value: 'finance' },
  { label: 'Notifications', value: 'notification' },
  { label: 'Audit', value: 'audit' },
] as const satisfies ReadonlyArray<{
  label: string;
  value: OperationsHandoffActivitySource;
}>;

export type OperationsHandoffDataHrefs = {
  readonly activityStreamHref: string | null;
  readonly auditLogsHref: string;
  readonly bookingHistoryHref: string | null;
  readonly bookingsHref: string;
  readonly completedBookingSummaryHref: string;
  readonly cashSettlementSummaryHref: string;
  readonly customerSummaryHref: string | null;
  readonly customersHref: string | null;
  readonly earningsHref: string;
  readonly financeCloseoutEarningsHref: string | null;
  readonly financeCloseoutSummaryHref: string;
  readonly financeDecisionAuditLogsHref: string | null;
  readonly financeDecisionAuditSummaryHref: string;
  readonly notificationSummaryHref: string;
  readonly notificationsHref: string | null;
  readonly operatorNoteSummaryHref: string;
  readonly partnersHref: string | null;
  readonly paymentsHref: string;
  readonly payoutBatchesHref: string;
  readonly refundsHref: string;
};

const OPERATIONS_HANDOFF_BOOKING_TAKE = 50;
const OPERATIONS_HANDOFF_NOTIFICATION_TAKE = 50;
const OPERATIONS_HANDOFF_AUDIT_TAKE = 50;
const OPERATIONS_HANDOFF_FINANCE_TAKE = 50;
const OPERATIONS_HANDOFF_SUMMARY_BOOKING_TAKE = 10;
const OPERATIONS_HANDOFF_SUMMARY_NOTIFICATION_TAKE = 5;
const OPERATIONS_HANDOFF_SUMMARY_AUDIT_TAKE = 5;
const OPERATIONS_HANDOFF_SUMMARY_FINANCE_TAKE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OPERATIONS_HANDOFF_DETAIL_PAGE = 10_000;

export function emptyCashSettlementSummary(): AdminCashSettlementSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    currency: 'VND',
    rowCount: 0,
    providerCount: 0,
    totalCompanyCouponOffset: 0,
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    oldestOpenAt: null,
    oldestOpenAgeMinutes: 0,
    staleDebtRowCount: 0,
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    cashPaymentRowCount: 0,
    topProviderGroups: [],
  };
}

export function buildOperationsHandoffFilters(
  params: Record<string, string | string[] | undefined>,
): OperationsHandoffFilters {
  const rangeParam = readSearchParam(params.range);
  const detailsParam = readSearchParam(params.details);
  const activityReview = readOperationsHandoffActivityReview(params.activityReview);
  const activitySource = readOperationsHandoffActivitySource(params.activitySource);
  return {
    activityAge:
      activityReview === 'needs-review' ? readAdminQueueAge(params.activityAge) : 'all',
    activityBacklog:
      activityReview === 'needs-review'
        ? readOperationsHandoffActivityBacklog(params.activityBacklog)
        : 'all',
    activityReason: readOperationsHandoffActivityReason(
      params.activityReason,
      activityReview,
      activitySource,
    ),
    activityReview,
    activitySort:
      activityReview === 'needs-review'
        ? readOperationsHandoffActivitySort(params.activitySort)
        : 'newest',
    activitySource,
    detailPages: {
      activity: readOperationsHandoffPage(params.activityPage),
      bookings: readOperationsHandoffPage(params.bookingPage),
      customers: readOperationsHandoffPage(params.customerPage),
      decisions: readOperationsHandoffPage(params.decisionPage),
      finance: readOperationsHandoffPage(params.financePage),
      partners: readOperationsHandoffPage(params.partnerPage),
    },
    detailsMode: detailsParam === 'all' ? 'all' : 'summary',
    range: rangeParam ? normalizeDateRange(rangeParam) : '7d',
  };
}

export function buildOperationsHandoffDataHrefs(
  params: Record<string, string | string[] | undefined>,
): OperationsHandoffDataHrefs {
  const filters = buildOperationsHandoffFilters(params);
  const { detailsMode, range } = filters;
  const limits = operationsHandoffDataLimits(detailsMode);

  return {
    activityStreamHref:
      detailsMode === 'all'
        ? `/admin/operations-handoff/activity?${new URLSearchParams({
            page: String(filters.detailPages.activity),
            pageSize: String(OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
            range,
            age: filters.activityAge,
            backlog: filters.activityBacklog,
            reason: filters.activityReason,
            review: filters.activityReview,
            sort: filters.activitySort,
            source: filters.activitySource,
          }).toString()}`
        : null,
    auditLogsHref: buildDateScopedHref('/admin/audit-logs', { take: String(limits.audit) }, range),
    bookingHistoryHref:
      detailsMode === 'all'
        ? `/admin/bookings/page?${new URLSearchParams({
            dateRange: range,
            page: String(filters.detailPages.bookings),
            pageSize: String(OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
          }).toString()}`
        : null,
    bookingsHref: `/admin/bookings?${new URLSearchParams({
      dateRange: range,
      take: String(limits.bookings),
    }).toString()}`,
    completedBookingSummaryHref: `/admin/bookings/completed-operations-summary?${new URLSearchParams({
      dateRange: range,
    }).toString()}`,
    cashSettlementSummaryHref: buildRangeScopedHref('/admin/cash-settlement-summary', {}, range),
    customerSummaryHref: detailsMode === 'all' ? '/admin/customers/summary' : null,
    customersHref:
      detailsMode === 'all'
        ? `/admin/customers?${new URLSearchParams({
            skip: String(
              (filters.detailPages.customers - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
            ),
            take: String(OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
          }).toString()}`
        : null,
    earningsHref: buildRangeScopedHref('/admin/earnings', { take: String(limits.finance) }, range),
    financeCloseoutEarningsHref:
      detailsMode === 'all'
        ? buildRangeScopedHref(
            '/admin/earnings',
            {
              review: 'closeout-review',
              skip: String(
                (filters.detailPages.finance - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
              ),
              take: String(OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE),
            },
            range,
          )
        : null,
    financeCloseoutSummaryHref: buildRangeScopedHref(
      '/admin/earnings/summary',
      { review: 'closeout-review' },
      range,
    ),
    financeDecisionAuditLogsHref:
      detailsMode === 'all'
        ? buildFinanceDecisionAuditLogsHref(
            range,
            OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
            (filters.detailPages.decisions - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE,
          )
        : null,
    financeDecisionAuditSummaryHref: buildFinanceDecisionAuditSummaryHref(range),
    notificationsHref:
      detailsMode === 'all'
        ? buildDateScopedHref('/admin/notifications', { take: String(limits.notifications) }, range)
        : null,
    notificationSummaryHref: buildDateScopedHref('/admin/notifications/summary', {}, range),
    operatorNoteSummaryHref: buildOperatorNoteSummaryHref(),
    partnersHref: `/admin/operations-handoff/providers?${new URLSearchParams({
      review: 'attention',
      skip: String(
        detailsMode === 'all'
          ? (filters.detailPages.partners - 1) * OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE
          : 0,
      ),
      take: String(detailsMode === 'all' ? OPERATIONS_HANDOFF_DETAIL_PAGE_SIZE : 1),
      withTotal: 'true',
    }).toString()}`,
    paymentsHref: buildRangeScopedHref('/admin/payments', { take: String(limits.finance) }, range),
    payoutBatchesHref: buildRangeScopedHref(
      '/admin/payout-batches',
      { review: 'needs-review', take: String(limits.finance) },
      range,
    ),
    refundsHref: buildRangeScopedHref('/admin/refunds', { take: String(limits.finance) }, range),
  };
}

function operationsHandoffDataLimits(detailsMode: OperationsHandoffFilters['detailsMode']) {
  if (detailsMode === 'all') {
    return {
      audit: OPERATIONS_HANDOFF_AUDIT_TAKE,
      bookings: OPERATIONS_HANDOFF_BOOKING_TAKE,
      finance: OPERATIONS_HANDOFF_FINANCE_TAKE,
      notifications: OPERATIONS_HANDOFF_NOTIFICATION_TAKE,
    };
  }

  return {
    audit: OPERATIONS_HANDOFF_SUMMARY_AUDIT_TAKE,
    bookings: OPERATIONS_HANDOFF_SUMMARY_BOOKING_TAKE,
    finance: OPERATIONS_HANDOFF_SUMMARY_FINANCE_TAKE,
    notifications: OPERATIONS_HANDOFF_SUMMARY_NOTIFICATION_TAKE,
  };
}

export function buildOperationsHandoffRangeData(
  input: OperationsHandoffRangeDataInput,
  range: AdminDateRange,
) {
  return {
    rangeAuditLogs: input.auditLogs.filter((log) => isInDateRange(log.createdAt, range)),
    rangeEarnings: input.earnings.filter((earning) => isInDateRange(earning.createdAt, range)),
    rangePayments: input.payments.filter((payment) => isInDateRange(payment.booking?.createdAt, range)),
    rangePayouts: input.payouts.filter((payout) => isInDateRange(payout.createdAt, range)),
    rangeRefunds: input.refunds.filter((refund) => isInDateRange(refund.createdAt, range)),
  };
}

export function buildOperationsHandoffFailedNotificationCount(
  notifications: readonly AdminNotification[],
  notificationSummary?: Pick<AdminNotificationBoardSummary, 'failed'> | null,
) {
  return notificationSummary?.failed ?? failedNotificationRows(notifications).length;
}

export function buildActivityStreamCsvHref(activityStream: readonly ActivityStreamRow[]) {
  return buildCsvDataHref(
    activityStream.map((item) => ({
      created_at: item.createdAt,
      relative_time: relativeTime(item.createdAt),
      area: item.area,
      source: item.source,
      record: item.record,
      summary: item.summary,
      review_reason: item.reviewReason,
      href: item.href,
    })),
    ['created_at', 'relative_time', 'area', 'source', 'record', 'summary', 'review_reason', 'href'],
  );
}

export function operationsHandoffDetailPageHref(
  filters: OperationsHandoffFilters,
  pageParam: keyof OperationsHandoffFilters['detailPages'],
) {
  return (page: number) => {
    const query = new URLSearchParams({
      details: 'all',
      range: filters.range,
    });
    if (filters.activitySource !== 'all') {
      query.set('activitySource', filters.activitySource);
    }
    if (filters.activityReview !== 'needs-review') {
      query.set('activityReview', filters.activityReview);
    }
    retainOperationsHandoffActivityPriority(query, filters);
    const pageParams: Record<keyof OperationsHandoffFilters['detailPages'], string> = {
      activity: 'activityPage',
      bookings: 'bookingPage',
      customers: 'customerPage',
      decisions: 'decisionPage',
      finance: 'financePage',
      partners: 'partnerPage',
    };

    for (const [key, param] of Object.entries(pageParams) as Array<
      [keyof OperationsHandoffFilters['detailPages'], string]
    >) {
      const nextPage = key === pageParam ? page : filters.detailPages[key];
      if (nextPage > 1) {
        query.set(param, String(nextPage));
      }
    }

    return `/operations-handoff?${query.toString()}`;
  };
}

export function operationsHandoffActivitySourceHref(
  filters: OperationsHandoffFilters,
  source: OperationsHandoffActivitySource,
) {
  const query = new URLSearchParams({
    details: 'all',
    range: filters.range,
  });
  if (source !== 'all') {
    query.set('activitySource', source);
  }
  if (filters.activityReview !== 'needs-review') {
    query.set('activityReview', filters.activityReview);
  }
  retainOperationsHandoffActivityPriority(query, filters, source);
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivityReviewHref(
  filters: OperationsHandoffFilters,
  review: OperationsHandoffActivityReview,
) {
  const query = new URLSearchParams({
    details: 'all',
    range: filters.range,
  });
  if (filters.activitySource !== 'all') {
    query.set('activitySource', filters.activitySource);
  }
  if (review !== 'needs-review') {
    query.set('activityReview', review);
  } else {
    retainOperationsHandoffActivityPriority(query, filters);
  }
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivityBacklogHref(
  filters: OperationsHandoffFilters,
  backlog: OperationsHandoffActivityBacklog,
) {
  const query = new URLSearchParams({
    details: 'all',
    range: filters.range,
  });
  if (filters.activitySource !== 'all') {
    query.set('activitySource', filters.activitySource);
  }
  if (backlog !== 'current') {
    query.set('activityBacklog', backlog);
  }
  retainOperationsHandoffActivityReason(query, filters);
  retainOperationsHandoffActivityAgeAndSort(query, filters);
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivityReasonHref(
  filters: OperationsHandoffFilters,
  reason: OperationsHandoffActivityReason,
) {
  const query = buildOperationsHandoffActivityPriorityQuery(filters);
  const compatibleReason = normalizeOperationsHandoffActivityReason(
    reason,
    filters.activityReview,
    filters.activitySource,
  );
  if (compatibleReason !== 'all') {
    query.set('activityReason', compatibleReason);
  }
  retainOperationsHandoffActivityAgeAndSort(query, filters);
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivityOver24hHref(
  filters: OperationsHandoffFilters,
  reason: OperationsHandoffActivityReason,
) {
  const query = buildOperationsHandoffActivityPriorityQuery(filters);
  const compatibleReason = normalizeOperationsHandoffActivityReason(
    reason,
    'needs-review',
    filters.activitySource,
  );
  if (compatibleReason !== 'all') {
    query.set('activityReason', compatibleReason);
  }
  query.set('activityAge', 'over-24h');
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivityAgeHref(
  filters: OperationsHandoffFilters,
  age: AdminQueueAge,
) {
  const query = buildOperationsHandoffActivityPriorityQuery(filters);
  retainOperationsHandoffActivityReason(query, filters);
  if (age !== 'all') {
    query.set('activityAge', age);
  }
  if (filters.activitySort !== 'oldest') {
    query.set('activitySort', filters.activitySort);
  }
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

export function operationsHandoffActivitySortHref(
  filters: OperationsHandoffFilters,
  sort: AdminQueueSort,
) {
  const query = buildOperationsHandoffActivityPriorityQuery(filters);
  retainOperationsHandoffActivityReason(query, filters);
  if (filters.activityAge !== 'all') {
    query.set('activityAge', filters.activityAge);
  }
  if (sort !== 'oldest') {
    query.set('activitySort', sort);
  }
  retainOperationsHandoffDetailPages(query, filters);
  return `/operations-handoff?${query.toString()}`;
}

function buildOperationsHandoffActivityPriorityQuery(filters: OperationsHandoffFilters) {
  const query = new URLSearchParams({
    details: 'all',
    range: filters.range,
  });
  if (filters.activitySource !== 'all') {
    query.set('activitySource', filters.activitySource);
  }
  retainOperationsHandoffActivityBacklog(query, filters);
  return query;
}

function retainOperationsHandoffActivityPriority(
  query: URLSearchParams,
  filters: OperationsHandoffFilters,
  source: OperationsHandoffActivitySource = filters.activitySource,
) {
  if (filters.activityReview !== 'needs-review') {
    return;
  }
  retainOperationsHandoffActivityBacklog(query, filters);
  retainOperationsHandoffActivityReason(query, filters, source);
  retainOperationsHandoffActivityAgeAndSort(query, filters);
}

function retainOperationsHandoffActivityBacklog(
  query: URLSearchParams,
  filters: OperationsHandoffFilters,
) {
  if (filters.activityBacklog !== 'current') {
    query.set('activityBacklog', filters.activityBacklog);
  }
}

function retainOperationsHandoffActivityReason(
  query: URLSearchParams,
  filters: OperationsHandoffFilters,
  source: OperationsHandoffActivitySource = filters.activitySource,
) {
  const compatibleReason = normalizeOperationsHandoffActivityReason(
    filters.activityReason,
    filters.activityReview,
    source,
  );
  if (compatibleReason !== 'all') {
    query.set('activityReason', compatibleReason);
  }
}

function retainOperationsHandoffActivityAgeAndSort(
  query: URLSearchParams,
  filters: OperationsHandoffFilters,
) {
  if (filters.activityAge !== 'all') {
    query.set('activityAge', filters.activityAge);
  }
  if (filters.activitySort !== 'oldest') {
    query.set('activitySort', filters.activitySort);
  }
}

function retainOperationsHandoffDetailPages(
  query: URLSearchParams,
  filters: OperationsHandoffFilters,
) {
  const retainedPages: Array<
    [Exclude<keyof OperationsHandoffFilters['detailPages'], 'activity'>, string]
  > = [
    ['bookings', 'bookingPage'],
    ['customers', 'customerPage'],
    ['decisions', 'decisionPage'],
    ['finance', 'financePage'],
    ['partners', 'partnerPage'],
  ];
  for (const [key, param] of retainedPages) {
    if (filters.detailPages[key] > 1) {
      query.set(param, String(filters.detailPages[key]));
    }
  }
}

function readOperationsHandoffActivityReview(
  value: string | string[] | undefined,
): OperationsHandoffActivityReview {
  return readSearchParam(value)?.toLowerCase() === 'all' ? 'all' : 'needs-review';
}

function readOperationsHandoffActivityBacklog(
  value: string | string[] | undefined,
): OperationsHandoffActivityBacklog {
  switch (readSearchParam(value)?.toLowerCase()) {
    case 'legacy':
      return 'legacy';
    case 'all':
      return 'all';
    case 'current':
    default:
      return 'current';
  }
}

function readOperationsHandoffActivityReason(
  value: string | string[] | undefined,
  review: OperationsHandoffActivityReview,
  source: OperationsHandoffActivitySource,
) {
  const reason = readSearchParam(value)?.toLowerCase();
  const requested: OperationsHandoffActivityReason =
    reason === 'booking-state' ||
    reason === 'payment' ||
    reason === 'missing-settlement' ||
    reason === 'notification-failure' ||
    reason === 'finance-unpaid'
      ? reason
      : 'all';
  return normalizeOperationsHandoffActivityReason(requested, review, source);
}

function normalizeOperationsHandoffActivityReason(
  reason: OperationsHandoffActivityReason,
  review: OperationsHandoffActivityReview,
  source: OperationsHandoffActivitySource,
): OperationsHandoffActivityReason {
  if (review !== 'needs-review' || reason === 'all' || source === 'all') {
    return review === 'needs-review' ? reason : 'all';
  }
  if (
    source === 'booking' &&
    (reason === 'booking-state' || reason === 'payment' || reason === 'missing-settlement')
  ) {
    return reason;
  }
  if (source === 'notification' && reason === 'notification-failure') {
    return reason;
  }
  if (source === 'finance' && reason === 'finance-unpaid') {
    return reason;
  }
  return 'all';
}

export function operationsHandoffActivityReasonOptions(
  source: OperationsHandoffActivitySource,
) {
  const allowed = (() => {
    switch (source) {
      case 'booking':
        return new Set<OperationsHandoffActivityReason>([
          'all',
          'booking-state',
          'payment',
          'missing-settlement',
        ]);
      case 'notification':
        return new Set<OperationsHandoffActivityReason>(['all', 'notification-failure']);
      case 'finance':
        return new Set<OperationsHandoffActivityReason>(['all', 'finance-unpaid']);
      case 'chat':
      case 'audit':
        return new Set<OperationsHandoffActivityReason>(['all']);
      case 'all':
      default:
        return new Set<OperationsHandoffActivityReason>(
          OPERATIONS_HANDOFF_ACTIVITY_REASON_OPTIONS.map((option) => option.value),
        );
    }
  })();
  return OPERATIONS_HANDOFF_ACTIVITY_REASON_OPTIONS.filter((option) => allowed.has(option.value));
}

export function operationsHandoffActivityReasonCounts(
  counts: AdminOperationsHandoffActivityPage['reasonCounts'],
): OperationsHandoffActivityReasonCounts {
  return {
    all: counts.all,
    'booking-state': counts.bookingState,
    'finance-unpaid': counts.financeUnpaid,
    'missing-settlement': counts.missingSettlement,
    'notification-failure': counts.notificationFailure,
    payment: counts.payment,
  };
}

function readOperationsHandoffActivitySort(
  value: string | string[] | undefined,
): AdminQueueSort {
  return readSearchParam(value)?.toLowerCase() === 'newest' ? 'newest' : 'oldest';
}

function readOperationsHandoffActivitySource(
  value: string | string[] | undefined,
): OperationsHandoffActivitySource {
  const source = readSearchParam(value)?.toLowerCase();
  if (
    source === 'audit' ||
    source === 'booking' ||
    source === 'chat' ||
    source === 'finance' ||
    source === 'notification'
  ) {
    return source;
  }
  return 'all';
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}

function failedNotificationRows(notifications: readonly AdminNotification[]) {
  return notifications.filter((notification) =>
    (notification.deliveries ?? []).some((delivery) => delivery.status === 'FAILED'),
  );
}

function readOperationsHandoffPage(value: string | string[] | undefined) {
  const parsed = Number.parseInt(readSearchParam(value) ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return Math.min(Math.trunc(parsed), MAX_OPERATIONS_HANDOFF_DETAIL_PAGE);
}

function buildDateScopedHref(pathname: string, baseParams: Record<string, string>, range: AdminDateRange) {
  const query = new URLSearchParams(baseParams);
  const window = dateRangeWindow(range);
  if (window.from) {
    query.set('from', window.from.toISOString());
  }
  if (window.to) {
    query.set('to', window.to.toISOString());
  }
  return `${pathname}?${query.toString()}`;
}

function buildRangeScopedHref(pathname: string, baseParams: Record<string, string>, range: AdminDateRange) {
  const query = new URLSearchParams(baseParams);
  query.set('range', range);
  return `${pathname}?${query.toString()}`;
}

function buildFinanceDecisionAuditLogsHref(range: AdminDateRange, take: number, skip: number) {
  const href = buildDateScopedHref(
    '/admin/audit-logs',
    {
      ...(skip > 0 ? { skip: String(skip) } : {}),
      take: String(take),
      withTotal: 'true',
    },
    range,
  );
  return appendFinanceDecisionActions(href);
}

function buildFinanceDecisionAuditSummaryHref(range: AdminDateRange) {
  return appendFinanceDecisionActions(
    buildDateScopedHref('/admin/audit-logs/summary', {}, range),
  );
}

function buildOperatorNoteSummaryHref(now = new Date()) {
  const query = new URLSearchParams({
    from: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
    to: now.toISOString(),
  });
  for (const action of [
    'operations.handoff_note.add',
    'booking.ops_note.add',
    'customer.ops_note.add',
    'provider.ops_note.add',
  ]) {
    query.append('action', action);
  }
  return `/admin/audit-logs/summary?${query.toString()}`;
}

function appendFinanceDecisionActions(href: string) {
  const [pathname, search = ''] = href.split('?');
  const query = new URLSearchParams(search);
  for (const action of OPERATIONS_HANDOFF_FINANCE_DECISION_ACTIONS) {
    query.append('action', action);
  }
  return `${pathname}?${query.toString()}`;
}

function dateRangeWindow(range: AdminDateRange, now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
  if (range === 'today') {
    return { from: todayStart, to: tomorrowStart };
  }
  if (range === '7d') {
    return { from: new Date(tomorrowStart.getTime() - 7 * DAY_MS), to: tomorrowStart };
  }
  if (range === '30d') {
    return { from: new Date(tomorrowStart.getTime() - 30 * DAY_MS), to: tomorrowStart };
  }
  return {};
}

function startOfLocalDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}
