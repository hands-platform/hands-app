import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import type { AdminProviderWalletWithdrawalRequestStatus } from '../../lib/admin-api';
import { LEGACY_OPERATIONAL_POLICY_KEYS, OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

const PAYOUT_OPERATIONS_API_LIMIT = 10;
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

export function buildPayoutFilters(params: Record<string, string | string[] | undefined>) {
  const rangeParam = readSearchParam(params.range);
  const withdrawalStatusParam = readSearchParam(params.withdrawalStatus);

  return {
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    withdrawalStatus: normalizePayoutWithdrawalStatus(withdrawalStatusParam),
  };
}

export function buildPayoutOperationsApiHrefs(filters: ReturnType<typeof buildPayoutFilters>) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(PAYOUT_OPERATIONS_API_LIMIT),
  });
  const withdrawalRequestParams = new URLSearchParams(params);
  if (filters.withdrawalStatus) {
    withdrawalRequestParams.set('status', filters.withdrawalStatus);
  }

  return {
    earningsHref: `/admin/earnings?${params.toString()}`,
    operationalPolicyHref: `/admin/operational-policy?${new URLSearchParams({
      keys: PAYOUT_OPERATIONAL_POLICY_KEYS.join(','),
    }).toString()}`,
    payoutBatchSummaryHref: `/admin/payout-batches/summary?range=${encodeURIComponent(filters.range)}`,
    payoutBatchesHref: `/admin/payout-batches?${params.toString()}`,
    providerWalletWithdrawalRequestsHref: `/admin/provider-wallet/withdrawal-requests?${withdrawalRequestParams.toString()}`,
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
