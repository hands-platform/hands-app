import type { AdminDateRange } from '../../lib/date-range';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';
import {
  readAdminQueueAge,
  readAdminQueueSlaFilter,
  type AdminQueueAge,
  type AdminQueueSlaFilter,
} from '../../lib/admin-queue-list';
import {
  cashSettlementQueueOptions,
  type CashSettlementFilters,
  type CashSettlementQueueFilter,
  type CashSettlementSort,
  type CashSettlementView,
} from './cash-settlement-page-types';

const CASH_SETTLEMENT_API_LIMIT = 10;
const CASH_SETTLEMENT_API_MAX_LIMIT = 50;

export function buildCashSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): CashSettlementFilters {
  const rangeParam = readSearchParam(params.range);

  return {
    age: readAdminQueueAge(params.age),
    page: readCashSettlementPage(params.page),
    pageSize: readCashSettlementPageSize(params.pageSize),
    period: normalizeCashSettlementPeriod(readSearchParam(params.period)),
    range: rangeParam ? normalizeDateRange(rangeParam) : 'all',
    returnTo: normalizeCashSettlementOverviewReturnTo(readSearchParam(params.returnTo)),
    queue: normalizeCashSettlementQueue(readSearchParam(params.queue)),
    q: readSearchParam(params.q).trim(),
    sla: readAdminQueueSlaFilter(params.sla),
    sort: readCashSettlementSort(params.sort),
    view: readCashSettlementView(params.view),
  };
}

export function buildCashSettlementApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams();
  appendCashSettlementPeriodOrRange(params, filters);
  params.set('take', String(filters.pageSize));
  appendCashSettlementListParams(params, filters);
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }

  return `/admin/cash-settlement-earnings?${params.toString()}`;
}

export function buildCashSettlementSummaryApiHref(filters: CashSettlementFilters) {
  const params = new URLSearchParams();
  appendCashSettlementPeriodOrRange(params, filters);
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
  period?: string | null;
  queue?: CashSettlementQueueFilter;
  q?: string;
  age?: AdminQueueAge;
  sort?: CashSettlementSort;
  sla?: AdminQueueSlaFilter;
  view?: CashSettlementView;
  review?: string;
  returnTo?: string | null;
}) {
  const params = new URLSearchParams();
  if (input.range && input.range !== 'all') {
    params.set('range', input.range);
  }
  const period = normalizeCashSettlementPeriod(input.period ?? '');
  if (period) {
    params.delete('range');
    params.set('period', period);
  }
  const returnTo = normalizeCashSettlementOverviewReturnTo(input.returnTo ?? '');
  if (returnTo) {
    params.set('returnTo', returnTo);
  }
  if (input.view === 'guide') {
    params.set('view', input.view);
  }
  if (input.queue && input.queue !== 'all') {
    params.set('queue', input.queue);
  }
  if (input.q?.trim()) {
    params.set('q', input.q.trim());
  }
  if (input.age && input.age !== 'all') {
    params.set('age', input.age);
  }
  if (input.sort) {
    params.set('sort', input.sort);
  }
  if (input.sla && input.sla !== 'all') {
    params.set('sla', input.sla);
  }
  if (input.pageSize && input.pageSize !== CASH_SETTLEMENT_API_LIMIT) {
    params.set('pageSize', String(input.pageSize));
  }
  if (input.page && input.page > 1) {
    params.set('page', String(input.page));
  }
  if (input.review?.trim()) {
    params.set('review', input.review.trim());
  }
  const query = params.toString();
  return query ? `/cash-settlements?${query}` : '/cash-settlements';
}

export function safeCashSettlementReturnTo(value: string | null | undefined) {
  if (!value) return '/cash-settlements';
  try {
    const url = new URL(value, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/cash-settlements') {
      return '/cash-settlements';
    }
    const raw = Object.fromEntries(url.searchParams.entries());
    return cashSettlementHref({
      ...buildCashSettlementFilters(raw),
      review: url.searchParams.get('review') ?? undefined,
    });
  } catch {
    return '/cash-settlements';
  }
}

export function safeCashSettlementOverviewReturnTo(value: string | null | undefined) {
  return normalizeCashSettlementOverviewReturnTo(value ?? '') ?? '/finance-tax';
}

export function cashSettlementReviewHref(returnTo: string, earningId: string) {
  const url = new URL(safeCashSettlementReturnTo(returnTo), 'http://admin.local');
  url.searchParams.set('review', earningId);
  clearCashSettlementNotice(url.searchParams);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export function cashSettlementNoticeHref(
  returnTo: string,
  input: {
    notice: 'error' | 'settled';
    earningId: string;
    code?: string;
    auditId?: string;
    allocationId?: string;
    amount?: number;
    evidenceId?: string;
    method?: string;
    status?: string;
  },
) {
  const url = new URL(safeCashSettlementReturnTo(returnTo), 'http://admin.local');
  clearCashSettlementNotice(url.searchParams);
  if (input.notice === 'settled') {
    url.searchParams.delete('review');
  } else {
    url.searchParams.set('review', input.earningId);
  }
  url.searchParams.set('notice', input.notice);
  if (input.code) url.searchParams.set('code', input.code);
  url.searchParams.set('resultEarningId', input.earningId);
  if (input.auditId) url.searchParams.set('auditId', input.auditId);
  if (input.allocationId) url.searchParams.set('allocationId', input.allocationId);
  if (input.evidenceId) url.searchParams.set('evidenceId', input.evidenceId);
  if (Number.isInteger(input.amount) && Number(input.amount) > 0) {
    url.searchParams.set('resultAmount', String(input.amount));
  }
  if (input.method) url.searchParams.set('resultMethod', input.method);
  if (input.status) url.searchParams.set('resultStatus', input.status);
  return `${url.pathname}?${url.searchParams.toString()}`;
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
  if (filters.age !== 'all') {
    params.set('age', filters.age);
  }
  if (filters.sort) {
    params.set('sort', filters.sort);
  }
  if (filters.sla && filters.sla !== 'all') {
    params.set('sla', filters.sla);
  }
  if (filters.queue !== 'all') {
    params.set('queue', filters.queue);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
}

function appendCashSettlementPeriodOrRange(params: URLSearchParams, filters: CashSettlementFilters) {
  if (filters.period) {
    params.set('period', filters.period);
  } else {
    params.set('range', filters.range);
  }
}

function normalizeCashSettlementPeriod(value: string) {
  const period = value.trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/u.test(period) ? period : null;
}

function normalizeCashSettlementOverviewReturnTo(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/finance-tax') return null;
    const period = normalizeCashSettlementPeriod(url.searchParams.get('period') ?? '');
    return period ? `/finance-tax?${new URLSearchParams({ period }).toString()}` : '/finance-tax';
  } catch {
    return null;
  }
}

function readCashSettlementSort(value: string | string[] | undefined): CashSettlementSort {
  const sort = readSearchParam(value);
  return sort === 'newest' || sort === 'highest-debt' ? sort : 'oldest';
}

function readCashSettlementView(value: string | string[] | undefined): CashSettlementView {
  const view = readSearchParam(value);
  return view === 'guide' || view === 'full' ? 'guide' : null;
}

function clearCashSettlementNotice(params: URLSearchParams) {
  for (const key of [
    'notice',
    'code',
    'resultEarningId',
    'auditId',
    'allocationId',
    'evidenceId',
    'resultAmount',
    'resultMethod',
    'resultStatus',
  ]) {
    params.delete(key);
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
