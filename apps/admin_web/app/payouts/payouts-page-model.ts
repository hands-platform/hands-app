import type { AdminProviderWalletWithdrawalRequestStatus } from '../../lib/admin-api';
import { normalizeDateRange, readSearchParam, type AdminDateRange } from '../../lib/date-range';

const PAYOUT_OPERATIONS_API_LIMIT = 20;
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
const PAYOUT_BATCH_STATUSES = new Set(['DRAFT', 'PROCESSING', 'PAID', 'FAILED', 'CANCELLED']);
const PAYOUT_QUEUES = new Set(['open', 'review', 'transfer', 'paid', 'archived']);
const PAYOUT_RECONCILIATION_VIEWS = new Set([
  'overview',
  'bank-unmatched',
  'payout-closeout-repair',
]);
const PAYOUT_EVIDENCE_FILTERS = new Set([
  'missing-transfer-ref',
  'withholding-review',
  'complete',
  'bank-match-incomplete',
]);
const PAYOUT_SORTS = new Set(['newest', 'oldest', 'amount-asc', 'amount-desc']);

export type PayoutView = 'batches' | 'withdrawals' | 'reconciliation';
export type PayoutReconciliationView =
  | 'overview'
  | 'bank-unmatched'
  | 'payout-closeout-repair';
export type PayoutWorkspace = 'operations' | 'policy' | 'audit' | 'records';

export type PayoutFilters = {
  readonly details: 'operations' | 'all';
  readonly editPayoutBatchId: string | null;
  readonly evidence: string | null;
  readonly hasWithdrawalSavedView: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly period: string | null;
  readonly q: string;
  readonly queue: string | null;
  readonly range: AdminDateRange;
  readonly recon: PayoutReconciliationView | null;
  readonly reverseWithdrawalRequestId: string | null;
  readonly returnTo: string | null;
  readonly sort: string;
  readonly status: string | null;
  readonly view: PayoutView;
  readonly withdrawalPage: number;
  readonly withdrawalPartnerId: string | null;
  readonly withdrawalReconciliation: 'unmatched' | 'matched' | null;
  readonly withdrawalStatus: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly workspace: PayoutWorkspace;
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
  const withdrawalPartnerId = readPayoutRecordId(params.withdrawalPartnerId);
  const withdrawalReconciliation = normalizeWithdrawalReconciliation(
    readSearchParam(params.withdrawalReconciliation),
  );
  const hasWithdrawalSavedView = Boolean(
    withdrawalStatusParam || withdrawalPartnerId || withdrawalReconciliation,
  );
  const view = normalizePayoutView(
    readSearchParam(params.view),
    hasWithdrawalSavedView,
    readSearchParam(params.workspace),
  );
  const rawQueue = readSearchParam(params.queue);
  const hasExplicitBatchScope = Boolean(
    readSearchParam(params.evidence) ||
      readSearchParam(params.status) ||
      readSearchParam(params.period),
  );
  const queue =
    view === 'batches'
      ? rawQueue
        ? readAllowedValue(params.queue, PAYOUT_QUEUES)
        : hasExplicitBatchScope
          ? null
          : 'open'
      : null;
  const recon =
    view === 'reconciliation'
      ? normalizePayoutReconciliationView(readSearchParam(params.recon)) ??
        (rawQueue === 'repair' ? 'payout-closeout-repair' : 'overview')
      : null;
  const withdrawalStatus =
    normalizePayoutWithdrawalStatus(withdrawalStatusParam) ??
    (recon === 'bank-unmatched' ? 'PAID' : null);

  return {
    details: view === 'batches' ? 'operations' : 'all',
    editPayoutBatchId: readPayoutRecordId(params.editPayoutBatchId),
    evidence: readAllowedValue(params.evidence, PAYOUT_EVIDENCE_FILTERS),
    hasWithdrawalSavedView,
    page: readPayoutPage(params.page),
    pageSize: readPayoutPageSize(params.pageSize),
    period: readPayoutPeriod(params.period),
    q: readBoundedQuery(params.q),
    queue,
    range: rangeParam ? normalizeDateRange(rangeParam) : 'all',
    recon,
    reverseWithdrawalRequestId: readPayoutRecordId(params.reverseWithdrawalRequestId),
    returnTo: readPayoutReturnTo(params.returnTo),
    sort: readAllowedValue(params.sort, PAYOUT_SORTS) ?? 'newest',
    status: readAllowedValue(params.status, PAYOUT_BATCH_STATUSES),
    view,
    withdrawalPage: readPayoutPage(params.withdrawalPage),
    withdrawalPartnerId,
    withdrawalReconciliation:
      recon === 'bank-unmatched' ? 'unmatched' : withdrawalReconciliation,
    withdrawalStatus,
    workspace:
      view === 'withdrawals' ? 'records' : view === 'reconciliation' ? 'audit' : 'operations',
  };
}

export function buildPayoutOperationsApiHrefs(filters: PayoutFilters) {
  const payoutParams = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
    view: 'summary',
  });
  addListFilters(payoutParams, filters);
  const payoutSkip = (filters.page - 1) * filters.pageSize;
  if (payoutSkip > 0) payoutParams.set('skip', String(payoutSkip));
  if (filters.recon === 'payout-closeout-repair') payoutParams.set('queue', 'repair');

  const withdrawalParams = new URLSearchParams({
    range: filters.range,
    take: String(filters.pageSize),
  });
  if (filters.q) withdrawalParams.set('q', filters.q);
  if (filters.sort !== 'newest') withdrawalParams.set('sort', filters.sort);
  const withdrawalSkip = (filters.withdrawalPage - 1) * filters.pageSize;
  if (withdrawalSkip > 0) withdrawalParams.set('skip', String(withdrawalSkip));
  if (filters.withdrawalStatus) withdrawalParams.set('status', filters.withdrawalStatus);
  if (filters.withdrawalPartnerId) withdrawalParams.set('providerProfileId', filters.withdrawalPartnerId);
  if (filters.withdrawalReconciliation) {
    withdrawalParams.set('reconciliation', filters.withdrawalReconciliation);
  }

  return {
    earningsHref: null,
    operationalPolicyHref: null,
    payoutBatchSummaryHref: buildPayoutSummaryHref(filters),
    payoutBatchOverviewSummaryHref: `/admin/payout-batches/summary?range=${encodeURIComponent(filters.range)}`,
    payoutBatchesHref:
      filters.view === 'batches' || filters.recon === 'payout-closeout-repair'
        ? `/admin/payout-batches?${payoutParams.toString()}`
        : null,
    providerWalletWithdrawalRequestsHref:
      filters.view === 'withdrawals' || filters.recon === 'bank-unmatched'
        ? `/admin/provider-wallet/withdrawal-requests?${withdrawalParams.toString()}`
        : null,
    providerWalletWithdrawalRequestSummaryHref:
      filters.view === 'withdrawals' || filters.recon === 'bank-unmatched'
        ? buildWithdrawalSummaryHref(filters)
        : null,
    selectedPayoutBatchHref: filters.editPayoutBatchId
      ? `/admin/payout-batches/${encodeURIComponent(filters.editPayoutBatchId)}`
      : null,
    providerWalletWithdrawalRequestGlobalSummaryHref:
      '/admin/provider-wallet/withdrawal-requests/summary?range=all',
  };
}

function buildPayoutSummaryHref(filters: PayoutFilters) {
  const params = new URLSearchParams({ range: filters.range });
  addListFilters(params, filters);
  if (filters.recon === 'payout-closeout-repair') params.set('queue', 'repair');
  params.delete('sort');
  return `/admin/payout-batches/summary?${params.toString()}`;
}

function buildWithdrawalSummaryHref(filters: PayoutFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.q) params.set('q', filters.q);
  if (filters.withdrawalPartnerId) params.set('providerProfileId', filters.withdrawalPartnerId);
  if (filters.withdrawalReconciliation) params.set('reconciliation', filters.withdrawalReconciliation);
  if (filters.withdrawalStatus) params.set('status', filters.withdrawalStatus);
  return `/admin/provider-wallet/withdrawal-requests/summary?${params.toString()}`;
}

function addListFilters(params: URLSearchParams, filters: PayoutFilters) {
  if (filters.evidence) params.set('evidence', filters.evidence);
  if (filters.period) params.set('period', filters.period);
  if (filters.q) params.set('q', filters.q);
  if (filters.queue) params.set('queue', filters.queue);
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (filters.status) params.set('status', filters.status);
}

export function payoutHref(input: {
  readonly details?: 'operations' | 'all';
  readonly editPayoutBatchId?: string | null;
  readonly evidence?: string | null;
  readonly focusWithdrawalRequests?: boolean;
  readonly page?: number;
  readonly pageSize?: number;
  readonly period?: string | null;
  readonly q?: string;
  readonly queue?: string | null;
  readonly range: AdminDateRange;
  readonly recon?: PayoutReconciliationView | null;
  readonly reverseWithdrawalRequestId?: string | null;
  readonly returnTo?: string | null;
  readonly sort?: string;
  readonly status?: string | null;
  readonly view?: PayoutView;
  readonly withdrawalStatus?: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly withdrawalPage?: number;
  readonly withdrawalPartnerId?: string | null;
  readonly withdrawalReconciliation?: 'unmatched' | 'matched' | null;
  readonly workspace?: PayoutWorkspace;
}) {
  const params = new URLSearchParams();
  const view = input.view ?? legacyWorkspaceView(input.workspace) ?? 'batches';
  if (view !== 'batches') params.set('view', view);
  if (view === 'reconciliation' && input.recon && input.recon !== 'overview') {
    params.set('recon', input.recon);
  }
  if (input.range && input.range !== 'all') params.set('range', input.range);
  if (input.q) params.set('q', input.q.slice(0, 120));
  if (input.queue) params.set('queue', input.queue);
  if (input.status) params.set('status', input.status);
  if (input.evidence) params.set('evidence', input.evidence);
  if (input.period) params.set('period', input.period);
  if (input.returnTo) params.set('returnTo', input.returnTo);
  if (input.sort && input.sort !== 'newest') params.set('sort', input.sort);
  if (input.editPayoutBatchId) params.set('editPayoutBatchId', input.editPayoutBatchId);
  if (input.reverseWithdrawalRequestId) {
    params.set('reverseWithdrawalRequestId', input.reverseWithdrawalRequestId);
  }
  if (input.withdrawalStatus) params.set('withdrawalStatus', input.withdrawalStatus);
  if (input.withdrawalPartnerId) params.set('withdrawalPartnerId', input.withdrawalPartnerId);
  if (input.withdrawalReconciliation) {
    params.set('withdrawalReconciliation', input.withdrawalReconciliation);
  }
  if (input.withdrawalPage && input.withdrawalPage > 1) {
    params.set('withdrawalPage', String(input.withdrawalPage));
  }
  if (input.pageSize && input.pageSize !== PAYOUT_OPERATIONS_API_LIMIT) {
    params.set('pageSize', String(input.pageSize));
  }
  if (input.page && input.page > 1) params.set('page', String(input.page));
  const query = params.toString();
  const href = query ? `/payouts?${query}` : '/payouts';
  return input.focusWithdrawalRequests ? `${href}#partner-wallet-withdrawal-requests` : href;
}

function readPayoutPeriod(value: string | string[] | undefined) {
  const period = readSearchParam(value).trim();
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period) ? period : null;
}

function readPayoutReturnTo(value: string | string[] | undefined) {
  const raw = readSearchParam(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw, 'http://admin.local');
    if (url.origin !== 'http://admin.local' || url.pathname !== '/finance-overview') return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function payoutWithdrawalClearSavedViewHref(filters: PayoutFilters) {
  return payoutHref({
    pageSize: filters.pageSize,
    q: filters.q,
    range: filters.range,
    sort: filters.sort,
    view: filters.view,
  });
}

function normalizePayoutView(
  value: string,
  hasWithdrawalSavedView: boolean,
  workspace: string,
): PayoutView {
  if (value === 'withdrawals' || value === 'records') return 'withdrawals';
  if (value === 'reconciliation' || value === 'audit') return 'reconciliation';
  if (workspace === 'audit') return 'reconciliation';
  if (workspace === 'records') return 'withdrawals';
  if (hasWithdrawalSavedView) return 'withdrawals';
  return 'batches';
}

function normalizePayoutReconciliationView(value: string): PayoutReconciliationView | null {
  return PAYOUT_RECONCILIATION_VIEWS.has(value) ? (value as PayoutReconciliationView) : null;
}

function legacyWorkspaceView(workspace?: PayoutWorkspace): PayoutView | null {
  if (workspace === 'records') return 'withdrawals';
  if (workspace === 'audit') return 'reconciliation';
  if (workspace) return 'batches';
  return null;
}

function normalizeWithdrawalReconciliation(value: string | null): 'unmatched' | 'matched' | null {
  return value === 'unmatched' || value === 'matched' ? value : null;
}

export function buildPayoutServerPagination<T>(
  rows: readonly T[],
  filters: Pick<PayoutFilters, 'page' | 'pageSize'>,
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
  if (!value) return null;
  return PAYOUT_WITHDRAWAL_STATUSES.has(value as AdminProviderWalletWithdrawalRequestStatus)
    ? (value as AdminProviderWalletWithdrawalRequestStatus)
    : null;
}

function readAllowedValue(
  value: string | string[] | undefined,
  allowed: ReadonlySet<string>,
) {
  const normalized = readSearchParam(value).trim();
  return allowed.has(normalized) ? normalized : null;
}

function readBoundedQuery(value: string | string[] | undefined) {
  return readSearchParam(value).trim().slice(0, 120);
}

function readPayoutPage(value: string | string[] | undefined) {
  const page = Number.parseInt(readSearchParam(value), 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readPayoutPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(readSearchParam(value), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) return PAYOUT_OPERATIONS_API_LIMIT;
  return Math.min(Math.trunc(pageSize), PAYOUT_OPERATIONS_API_MAX_LIMIT);
}

function readPayoutRecordId(value: string | string[] | undefined) {
  const recordId = readSearchParam(value).trim();
  return recordId && recordId.length <= 128 && /^[A-Za-z0-9_-]+$/u.test(recordId) ? recordId : null;
}
