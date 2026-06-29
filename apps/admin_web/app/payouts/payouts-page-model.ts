import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import { LEGACY_OPERATIONAL_POLICY_KEYS, OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

const PAYOUT_OPERATIONS_API_LIMIT = 10;
const PAYOUT_OPERATIONAL_POLICY_KEYS = [
  OPERATIONAL_POLICY_KEYS.payoutBatchCycle,
  OPERATIONAL_POLICY_KEYS.cashSettlementClearance,
  OPERATIONAL_POLICY_KEYS.walletNegativeGate,
  OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
  LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
] as const;

export function buildPayoutFilters(params: Record<string, string | string[] | undefined>) {
  const rangeParam = readSearchParam(params.range);

  return {
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
  };
}

export function buildPayoutOperationsApiHrefs(filters: ReturnType<typeof buildPayoutFilters>) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(PAYOUT_OPERATIONS_API_LIMIT),
  });

  return {
    earningsHref: `/admin/earnings?${params.toString()}`,
    operationalPolicyHref: `/admin/operational-policy?${new URLSearchParams({
      keys: PAYOUT_OPERATIONAL_POLICY_KEYS.join(','),
    }).toString()}`,
    payoutBatchSummaryHref: `/admin/payout-batches/summary?range=${encodeURIComponent(filters.range)}`,
    payoutBatchesHref: `/admin/payout-batches?${params.toString()}`,
    providerWalletWithdrawalRequestsHref: `/admin/provider-wallet/withdrawal-requests?${params.toString()}`,
  };
}
