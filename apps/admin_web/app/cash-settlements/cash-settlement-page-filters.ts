import type { AdminDateRange } from '../../lib/date-range';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
  type CashSettlementQueueFilter,
} from './cash-settlement-page-types';

export function buildCashSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): CashSettlementFilters {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
    queue: normalizeCashSettlementQueue(readSearchParam(params.queue)),
    q: readSearchParam(params.q).trim(),
  };
}

export function normalizeCashSettlementQueue(value: string): CashSettlementQueueFilter {
  if (value === 'stale' || value === 'high-debt' || value === 'missing-ref' || value === 'payment-check') {
    return value;
  }
  return 'all';
}

export function cashSettlementQueueLabel(queue: CashSettlementQueueFilter) {
  return cashSettlementQueueOptions.find((option) => option.value === queue)?.label ?? 'All open debt';
}

export function cashSettlementHref(input: { range: AdminDateRange; queue?: CashSettlementQueueFilter; q?: string }) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'all') {
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
