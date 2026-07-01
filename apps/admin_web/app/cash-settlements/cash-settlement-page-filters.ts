import type { AdminDateRange } from '../../lib/date-range';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
  type CashSettlementQueueFilter,
} from './cash-settlement-page-types';

const CASH_SETTLEMENT_API_LIMIT = 10;
const CASH_SETTLEMENT_API_MAX_LIMIT = 50;

export function buildCashSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): CashSettlementFilters {
  const rangeParam = readSearchParam(params.range);

  return {
    page: readCashSettlementPage(params.page),
    pageSize: readCashSettlementPageSize(params.pageSize),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'today',
    queue: normalizeCashSettlementQueue(readSearchParam(params.queue)),
    q: readSearchParam(params.q).trim(),
  };
}

export function buildCashSettlementApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
  });
  appendCashSettlementListParams(params, filters);
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }

  return `/admin/cash-settlement-earnings?${params.toString()}`;
}

export function buildCashSettlementSummaryApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });
  appendCashSettlementListParams(params, filters);

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
  page?: number;
  pageSize?: number;
  queue?: CashSettlementQueueFilter;
  q?: string;
  view?: 'full';
}) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'today') {
    params.set('range', input.range);
  }
  if (input.view === 'full') {
    params.set('view', input.view);
  }
  if (input.queue && input.queue !== 'all') {
    params.set('queue', input.queue);
  }
  if (input.q?.trim()) {
    params.set('q', input.q.trim());
  }
  if (input.pageSize && input.pageSize !== CASH_SETTLEMENT_API_LIMIT) {
    params.set('pageSize', String(input.pageSize));
  }
  if (input.page && input.page > 1) {
    params.set('page', String(input.page));
  }
  const query = params.toString();
  return query ? `/cash-settlements?${query}` : '/cash-settlements';
}

export function buildCashSettlementServerPagination<T>(
  rows: readonly T[],
  filters: CashSettlementFilters,
  totalRows: number,
) {
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

function appendCashSettlementListParams(params: URLSearchParams, filters: CashSettlementFilters) {
  if (filters.queue !== 'all') {
    params.set('queue', filters.queue);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
}

function readCashSettlementPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readCashSettlementPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(readSearchParam(value), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return CASH_SETTLEMENT_API_LIMIT;
  }
  return Math.min(Math.trunc(pageSize), CASH_SETTLEMENT_API_MAX_LIMIT);
}
