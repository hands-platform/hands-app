import { normalizeDateRange, readSearchParam, type AdminDateRange } from '../../lib/date-range';
import type { AdminProviderWalletWithdrawalRequestStatus } from '../../lib/admin-api';
import { LEGACY_OPERATIONAL_POLICY_KEYS, OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

const PAYOUT_OPERATIONS_API_LIMIT = 10;
const PAYOUT_OPERATIONS_API_MAX_LIMIT = 50;
const PAYOUT_WITHDRAWAL_STATUSES = new Set<AdminProviderWalletWithdrawalRequestStatus>([
  'REQUESTED',
  'NEEDS_BANK_CORRECTION',
  'APPROVED',
  'BANK_TRANSFER_PENDING',
  'REVIEW_REQUIRED',
  'HOLD',
  'PAID',
  'REJECTED',
  'CANCELLED',
  'FAILED',
  'REVERSED',
]);
const PAYOUT_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.payoutBatchCycle,
  OPERATIONAL_POLICY_KEYS.cashSettlementClearance,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
] as const;

export type PayoutFilters = {
  readonly page: number;
  readonly pageSize: number;
  readonly range: AdminDateRange;
  readonly withdrawalPage: number;
  readonly withdrawalReconciliation: 'unmatched' | 'matched' | null;
  readonly withdrawalStatus: AdminProviderWalletWithdrawalRequestStatus | null;
};

export type PayoutServerPagination<T> = {
  readonly from: number;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
  readonly to: number;
  readonly totalPages: number;
  readonly totalRows: number;
};

export function buildPayoutFilters(params: Record<string, string | string[] | undefined>): PayoutFilters {
  const rangeParam = readSearchParam(params.range);
  const withdrawalStatusParam = readSearchParam(params.withdrawalStatus);
  const withdrawalReconciliation = normalizeWithdrawalReconciliation(
    readSearchParam(params.withdrawalReconciliation),
  );
  const withdrawalStatus =
    normalizePayoutWithdrawalStatus(withdrawalStatusParam) ??
    (withdrawalReconciliation ? 'PAID' : 'REVIEW_REQUIRED');

  return {
    page: readPayoutPage(params.page),
    pageSize: readPayoutPageSize(params.pageSize),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    withdrawalPage: readPayoutPage(params.withdrawalPage),
    withdrawalReconciliation,
    withdrawalStatus,
  };
}

export function buildPayoutOperationsApiHrefs(filters: PayoutFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
  });
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }
  const withdrawalRequestParams = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
  });
  const withdrawalSkip = (filters.withdrawalPage - 1) * filters.pageSize;
  if (withdrawalSkip > 0) {
    withdrawalRequestParams.set('skip', String(withdrawalSkip));
  }
  if (filters.withdrawalStatus) {
    withdrawalRequestParams.set('status', filters.withdrawalStatus);
  }
  if (filters.withdrawalReconciliation) {
    withdrawalRequestParams.set('reconciliation', filters.withdrawalReconciliation);
  }

  return {
    earningsHref: `/admin/earnings?${params.toString()}`,
    operationalPolicyHref: `/admin/operational-policy?${new URLSearchParams({
      keys: PAYOUT_OPERATIONAL_POLICY_KEYS.join(','),
    }).toString()}`,
    payoutBatchSummaryHref: `/admin/payout-batches/summary?range=${encodeURIComponent(filters.range)}`,
    payoutBatchesHref: `/admin/payout-batches?${params.toString()}`,
    providerWalletWithdrawalRequestsHref: `/admin/provider-wallet/withdrawal-requests?${withdrawalRequestParams.toString()}`,
    providerWalletWithdrawalRequestSummaryHref: `/admin/provider-wallet/withdrawal-requests/summary?range=${encodeURIComponent(filters.range)}`,
  };
}

export function payoutHref(input: {
  readonly page?: number;
  readonly pageSize?: number;
  readonly range: AdminDateRange;
  readonly withdrawalStatus?: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly withdrawalPage?: number;
  readonly withdrawalReconciliation?: 'unmatched' | 'matched' | null;
}) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'today') {
    params.set('range', input.range);
  }
  if (input.withdrawalStatus) {
    params.set('withdrawalStatus', input.withdrawalStatus);
  }
  if (input.withdrawalReconciliation) {
    params.set('withdrawalReconciliation', input.withdrawalReconciliation);
  }
  if (input.withdrawalPage && input.withdrawalPage > 1) {
    params.set('withdrawalPage', String(input.withdrawalPage));
  }
  if (input.pageSize && input.pageSize !== PAYOUT_OPERATIONS_API_LIMIT) {
    params.set('pageSize', String(input.pageSize));
  }
  if (input.page && input.page > 1) {
    params.set('page', String(input.page));
  }
  const query = params.toString();
  return query ? `/payouts?${query}` : '/payouts';
}

function normalizeWithdrawalReconciliation(value: string | null): 'unmatched' | 'matched' | null {
  return value === 'unmatched' || value === 'matched' ? value : null;
}

export function buildPayoutServerPagination<T>(
  rows: readonly T[],
  filters: PayoutFilters,
  totalRows: number,
): PayoutServerPagination<T> {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

function normalizePayoutWithdrawalStatus(
  value: string | null,
): AdminProviderWalletWithdrawalRequestStatus | null {
  if (!value) {
    return null;
  }
  return PAYOUT_WITHDRAWAL_STATUSES.has(value as AdminProviderWalletWithdrawalRequestStatus)
    ? (value as AdminProviderWalletWithdrawalRequestStatus)
    : null;
}

function readPayoutPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readPayoutPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(readSearchParam(value), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return PAYOUT_OPERATIONS_API_LIMIT;
  }
  return Math.min(Math.trunc(pageSize), PAYOUT_OPERATIONS_API_MAX_LIMIT);
}
