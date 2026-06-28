import type { AdminDateRange } from '../../lib/date-range';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
  type CashSettlementQueueFilter,
} from './cash-settlement-page-types';

const CASH_SETTLEMENT_API_LIMIT = 10;

export function buildCashSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): CashSettlementFilters {
  const rangeParam = readSearchParam(params.range);

  return {
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    queue: normalizeCashSettlementQueue(readSearchParam(params.queue)),
    q: readSearchParam(params.q).trim(),
  };
}

export function buildCashSettlementApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(CASH_SETTLEMENT_API_LIMIT),
  });

  return `/admin/cash-settlement-earnings?${params.toString()}`;
}

export function buildCashSettlementSummaryApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });

  return `/admin/cash-settlement-summary?${params.toString()}`;
}

export function normalizeCashSettlementQueue(value: string): CashSettlementQueueFilter {
  const option = cashSettlementQueueOptions.find((item) => item.value === value);
  if (option) {
    return option.value;
  }
  return 'all';
}

export function cashSettlementQueueLabel(queue: CashSettlementQueueFilter) {
  return cashSettlementQueueOptions.find((option) => option.value === queue)?.label ?? 'All open debt';
}

export function cashSettlementHref(input: {
  range: AdminDateRange;
  queue?: CashSettlementQueueFilter;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'today') {
    params.set('range', input.range);
  }
  if (input.queue && input.queue !== 'all') {
    params.set('queue', input.queue);
  }
  if (input.q?.trim()) {
    params.set('q', input.q.trim());
  }
  const query = params.toString();
  return query ? `/cash-settlements?${query}` : '/cash-settlements';
}
