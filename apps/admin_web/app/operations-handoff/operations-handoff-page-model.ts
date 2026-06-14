import type {
  AdminAuditLog,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminNotification,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import { buildCsvDataHref } from '../../lib/csv-export';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import {
  formatFcmSentDeliveryDetail,
  latestFcmSentNotificationDelivery,
} from '../../lib/admin-notification-delivery';
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
  readonly range: ReturnType<typeof normalizeDateRange>;
};

export function emptyCashSettlementSummary(): AdminCashSettlementSummary {
  return {
    generatedAt: new Date(0).toISOString(),
    currency: 'VND',
    rowCount: 0,
    providerCount: 0,
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
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
  };
}

export function buildOperationsHandoffRangeData(
  input: OperationsHandoffRangeDataInput,
  range: AdminDateRange,
) {
  return {
    rangeAuditLogs: input.auditLogs.filter((log) => isInDateRange(log.createdAt, range)),
    rangeEarnings: input.earnings.filter((earning) => isInDateRange(earning.createdAt, range)),
    rangePayments: input.payments.filter((payment) =>
      isInDateRange(payment.booking?.createdAt, range),
    ),
    rangePayouts: input.payouts.filter((payout) => isInDateRange(payout.createdAt, range)),
    rangeRefunds: input.refunds.filter((refund) => isInDateRange(refund.createdAt, range)),
  };
}

export function buildLatestFcmSentSummary(notifications: readonly AdminNotification[]) {
  const latestFcmSent = latestFcmSentNotificationDelivery(notifications);
  return latestFcmSent
    ? {
        helper: formatFcmSentDeliveryDetail(latestFcmSent.notification, latestFcmSent.delivery),
        value: formatDateTime(latestFcmSent.delivery.attemptedAt),
      }
    : null;
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
      href: item.href,
    })),
    ['created_at', 'relative_time', 'area', 'source', 'record', 'summary', 'href'],
  );
}

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
