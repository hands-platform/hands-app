import type {
  AdminAuditLog,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminNotification,
  AdminNotificationBoardSummary,
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
import type { ActivityStreamRow } from './operations-handoff-activity-stream';

type OperationsHandoffRangeDataInput = {
  readonly auditLogs: readonly AdminAuditLog[];
  readonly earnings: readonly AdminEarning[];
  readonly payments: readonly AdminPayment[];
  readonly payouts: readonly AdminPayoutBatch[];
  readonly refunds: readonly AdminRefund[];
};

export type OperationsHandoffFilters = {
  readonly detailPages: {
    readonly activity: number;
    readonly bookings: number;
    readonly customers: number;
    readonly finance: number;
    readonly partners: number;
  };
  readonly detailsMode: 'summary' | 'all';
  readonly range: ReturnType<typeof normalizeDateRange>;
};

export type OperationsHandoffDataHrefs = {
  readonly auditLogsHref: string;
  readonly bookingsHref: string;
  readonly cashSettlementSummaryHref: string;
  readonly chatArchiveHref: string | null;
  readonly customersHref: string | null;
  readonly earningsHref: string;
  readonly notificationSummaryHref: string;
  readonly notificationsHref: string | null;
  readonly partnersHref: string | null;
  readonly paymentsHref: string;
  readonly payoutBatchesHref: string;
  readonly refundsHref: string;
};

const OPERATIONS_HANDOFF_BOOKING_TAKE = 50;
const OPERATIONS_HANDOFF_NOTIFICATION_TAKE = 50;
const OPERATIONS_HANDOFF_AUDIT_TAKE = 50;
const OPERATIONS_HANDOFF_FINANCE_TAKE = 50;
const OPERATIONS_HANDOFF_LIST_TAKE = 50;
const OPERATIONS_HANDOFF_CHAT_TAKE = 50;
const OPERATIONS_HANDOFF_SUMMARY_BOOKING_TAKE = 10;
const OPERATIONS_HANDOFF_SUMMARY_NOTIFICATION_TAKE = 5;
const OPERATIONS_HANDOFF_SUMMARY_AUDIT_TAKE = 5;
const OPERATIONS_HANDOFF_SUMMARY_FINANCE_TAKE = 5;
const OPERATIONS_HANDOFF_SUMMARY_LIST_TAKE = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OPERATIONS_HANDOFF_DETAIL_PAGE = 20;

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
  return {
    detailPages: {
      activity: readOperationsHandoffPage(params.activityPage),
      bookings: readOperationsHandoffPage(params.bookingPage),
      customers: readOperationsHandoffPage(params.customerPage),
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
  const { detailsMode, range } = buildOperationsHandoffFilters(params);
  const limits = operationsHandoffDataLimits(detailsMode);

  return {
    auditLogsHref: buildDateScopedHref('/admin/audit-logs', { take: String(limits.audit) }, range),
    bookingsHref: `/admin/bookings?${new URLSearchParams({
      dateRange: range,
      take: String(limits.bookings),
    }).toString()}`,
    cashSettlementSummaryHref: buildRangeScopedHref('/admin/cash-settlement-summary', {}, range),
    chatArchiveHref:
      detailsMode === 'all'
        ? `/admin/chat-archive?${new URLSearchParams({
            dateRange: range,
            take: String(OPERATIONS_HANDOFF_CHAT_TAKE),
          }).toString()}`
        : null,
    customersHref:
      detailsMode === 'all'
        ? `/admin/customers?${new URLSearchParams({
            take: String(limits.list),
          }).toString()}`
        : null,
    earningsHref: buildRangeScopedHref('/admin/earnings', { take: String(limits.finance) }, range),
    notificationsHref:
      detailsMode === 'all'
        ? buildDateScopedHref('/admin/notifications', { take: String(limits.notifications) }, range)
        : null,
    notificationSummaryHref: buildDateScopedHref('/admin/notifications/summary', {}, range),
    partnersHref:
      detailsMode === 'all'
        ? `/admin/operations-handoff/providers?${new URLSearchParams({
            take: String(limits.list),
          }).toString()}`
        : null,
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
      list: OPERATIONS_HANDOFF_LIST_TAKE,
      notifications: OPERATIONS_HANDOFF_NOTIFICATION_TAKE,
    };
  }

  return {
    audit: OPERATIONS_HANDOFF_SUMMARY_AUDIT_TAKE,
    bookings: OPERATIONS_HANDOFF_SUMMARY_BOOKING_TAKE,
    finance: OPERATIONS_HANDOFF_SUMMARY_FINANCE_TAKE,
    list: OPERATIONS_HANDOFF_SUMMARY_LIST_TAKE,
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
    const pageParams: Record<keyof OperationsHandoffFilters['detailPages'], string> = {
      activity: 'activityPage',
      bookings: 'bookingPage',
      customers: 'customerPage',
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
