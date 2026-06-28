import { normalizeDateRange, readSearchParam } from '../../lib/date-range';

const PAYOUT_OPERATIONS_API_LIMIT = 25;

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
    payoutBatchesHref: `/admin/payout-batches?${params.toString()}`,
  };
}
