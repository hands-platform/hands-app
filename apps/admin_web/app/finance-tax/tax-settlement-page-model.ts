import type {
  AdminAccountingJournalBatch,
  AdminAccountingJournalBatchSummary,
  AdminAccountingJournalSourceType,
  AdminBankReconciliationEvidenceSourceSummary,
  AdminBankReconciliationReviewOwnerSummary,
  AdminBankReconciliationSummary,
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementReversalSummary,
  AdminBookingSettlementSnapshotSummary,
  AdminBookingPaymentClearingSummary,
  AdminCouponFinanceSummary,
  AdminFinanceReviewOwnerWorkloadSummary,
  AdminPaymentFeeSummary,
  AdminPaymentMethod,
  AdminPlatformVatSummary,
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingPreflight,
  AdminMonthlyTaxClosingPreflightBlockerCode,
  AdminMonthlyTaxClosingStatus,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
  AdminProviderWalletWithdrawalRequestSummary,
} from '../../lib/admin-api';
import type { AdminDateRange } from '../../lib/date-range';
import { buildCsvContent, buildCsvDataHref } from '../../lib/csv-export';
import { formatMoney, shortId } from '../../lib/admin-format';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';

export type BookingSettlementReview =
  | 'all'
  | 'integrity-exceptions'
  | 'payment-evidence'
  | 'tax-workflow'
  | 'reversals'
  | 'allocation-mismatch'
  | 'clearing-evidence'
  | 'coupon-review'
  | 'coupon-evidence'
  | 'journal-evidence'
  | 'open'
  | 'tax-open'
  | 'declared'
  | 'paid'
  | 'closed'
  | 'resolved'
  | 'posted'
  | 'reversed'
  | 'cash'
  | 'non-cash'
  | 'payment-fee-evidence'
  | 'reversal-incomplete'
  | 'tax-evidence'
  | 'unknown';

export type BookingSettlementAuditOwner = 'accounting' | 'finance-operations' | 'tax-period-close';
export type BookingSettlementAuditReason =
  | 'allocation'
  | 'journal'
  | 'clearing'
  | 'bank-match'
  | 'fee-policy'
  | 'coupon'
  | 'tax-period'
  | 'reversal'
  | 'unknown';
export type BookingSettlementAuditStatus = 'open' | 'declared' | 'paid' | 'closed' | 'reversed';

export type FinanceAccountingReview =
  | 'all'
  | 'unresolved'
  | 'needs-action'
  | 'unbalanced'
  | 'draft'
  | 'posted'
  | 'reversed'
  | 'open'
  | 'partial'
  | 'cleared'
  | 'terminal'
  | 'unmatched'
  | 'matched'
  | 'ignored'
  | 'inflow'
  | 'outflow';

export type BookingSettlementFilters = {
  readonly cursor?: string;
  readonly owner?: BookingSettlementAuditOwner;
  readonly page: number;
  readonly paymentMethod?: AdminPaymentMethod;
  readonly period?: string;
  readonly q?: string;
  readonly range: AdminDateRange;
  readonly reason?: BookingSettlementAuditReason;
  readonly returnTo?: string;
  readonly review: BookingSettlementReview;
  readonly sort?: 'largest-discrepancy' | 'newest' | 'oldest';
  readonly status?: BookingSettlementAuditStatus;
  readonly take: number;
};

export type FinanceAccountingFilters = {
  readonly assigneeAdminId?: string;
  readonly assignment?: 'assigned' | 'unassigned';
  readonly bankReconciliationAge?: '48h';
  readonly bankReconciliationSource?: BankReconciliationEvidenceSource;
  readonly bankTransactionType?: 'INFLOW' | 'OUTFLOW';
  readonly page: number;
  readonly journalSource?: AdminAccountingJournalSourceType;
  readonly period?: string;
  readonly paymentClearingAge?: '48h';
  readonly q?: string;
  readonly range: AdminDateRange;
  readonly returnTo?: string;
  readonly review: FinanceAccountingReview;
  readonly sort?: 'largest-discrepancy' | 'newest' | 'oldest' | 'highest-remaining' | 'recent';
  readonly take: number;
  readonly workspace?: 'imports' | 'manual' | 'operations';
};

export type BankReconciliationEvidenceSource =
  | 'PAYMENT_CLEARING'
  | 'PARTNER_DEPOSIT'
  | 'WITHDRAWAL'
  | 'PAYOUT'
  | 'REFUND'
  | 'OTHER_JOURNAL'
  | 'UNCLASSIFIED';

export type PartnerWithholdingTaxFilters = {
  readonly page: number;
  readonly period: string;
  readonly take: number;
};

export type MonthlyTaxClosingFilters = {
  readonly page: number;
  readonly period: string;
  readonly take: number;
};

export type MonthlyTaxClosingStatusOption = {
  readonly value: AdminMonthlyTaxClosingStatus;
  readonly label: string;
  readonly helper: string;
};

export type MonthlyTaxClosingExportKind = 'summary' | 'rows' | 'accounting-journal';

export type MonthlyTaxClosingRemittanceEvidenceState = {
  readonly detail: string;
  readonly evidenceHref: string | null;
  readonly label: string;
  readonly tone: 'neutral' | 'success' | 'warning';
};

export type TaxFinanceWorkflowPage =
  | 'overview'
  | 'approval-queue'
  | 'booking-settlement-audit'
  | 'settlement-reversals'
  | 'general-ledger'
  | 'finance-approvers'
  | 'payment-clearing'
  | 'bank-reconciliation'
  | 'coupon-finance'
  | 'monthly-tax-closing'
  | 'platform-vat'
  | 'payment-fees'
  | 'partner-withholding-tax';

export type TaxFinanceWorkflowLink = {
  readonly key: TaxFinanceWorkflowPage;
  readonly label: string;
  readonly href: string;
};

export type BookingSettlementReversalTraceLink = {
  readonly href: string;
  readonly label: string;
  readonly value: string;
};

export type BookingSettlementReversalEvidenceState = {
  readonly detail: string;
  readonly label: string;
  readonly tone: 'danger' | 'success' | 'warning';
};

export type FinanceSettlementTraceLink = BookingSettlementReversalTraceLink;

export type FinancePayoutPriorityLink = {
  readonly key: string;
  readonly count: number | null;
  readonly amount: number | null;
  readonly currency: string | null;
  readonly amountSuffix: string | null;
  readonly label: string;
  readonly helper: string;
  readonly href: string;
  readonly signal: string;
};

export const TAX_SETTLEMENT_DEFAULT_TAKE = 10;
export const FINANCE_ACCOUNTING_PAGE_SIZE_LINKS = [10, 25, 50, 100] as const;
export const TAX_SETTLEMENT_MAX_TAKE = 100;

const BOOKING_SETTLEMENT_REVIEW_VALUES: readonly BookingSettlementReview[] = [
  'all',
  'integrity-exceptions',
  'payment-evidence',
  'tax-workflow',
  'reversals',
  'allocation-mismatch',
  'clearing-evidence',
  'coupon-evidence',
  'journal-evidence',
  'open',
  'tax-open',
  'declared',
  'paid',
  'closed',
  'resolved',
  'posted',
  'reversed',
  'cash',
  'non-cash',
  'payment-fee-evidence',
  'reversal-incomplete',
  'tax-evidence',
  'unknown',
];
const COUPON_FINANCE_REVIEW_VALUES: readonly BookingSettlementReview[] = [
  ...BOOKING_SETTLEMENT_REVIEW_VALUES,
  'coupon-review',
];
const FINANCE_ACCOUNTING_REVIEW_VALUES: readonly FinanceAccountingReview[] = [
  'all',
  'unresolved',
  'needs-action',
  'unbalanced',
  'draft',
  'posted',
  'reversed',
  'open',
  'partial',
  'cleared',
  'terminal',
  'unmatched',
  'matched',
  'ignored',
  'inflow',
  'outflow',
];

export const BOOKING_SETTLEMENT_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: BookingSettlementReview;
}[] = [
  { label: 'Needs action', review: 'open' },
  { label: 'Declared', review: 'declared' },
  { label: 'Paid', review: 'paid' },
  { label: 'Posted', review: 'posted' },
  { label: 'Payment fee evidence', review: 'payment-fee-evidence' },
  { label: 'Cash', review: 'cash' },
  { label: 'Non-cash', review: 'non-cash' },
  { label: 'All', review: 'all' },
];

export const BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: BookingSettlementReview;
}[] = [
  { label: 'Integrity exceptions', review: 'integrity-exceptions' },
  { label: 'Payment evidence', review: 'payment-evidence' },
  { label: 'Tax workflow', review: 'tax-workflow' },
  { label: 'Reversals', review: 'reversals' },
  { label: 'Resolved', review: 'resolved' },
  { label: 'All records', review: 'all' },
];

export const COUPON_FINANCE_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: BookingSettlementReview;
}[] = [
  { label: 'Coupon review flags', review: 'coupon-review' },
  { label: 'Tax open', review: 'open' },
  { label: 'Declared', review: 'declared' },
  { label: 'Paid', review: 'paid' },
  { label: 'Posted records', review: 'posted' },
  { label: 'Reversed records', review: 'reversed' },
  { label: 'Cash', review: 'cash' },
  { label: 'Non-cash', review: 'non-cash' },
  { label: 'All records', review: 'all' },
];

export const SETTLEMENT_REVERSAL_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: BookingSettlementReview;
}[] = [
  { label: 'Reversed', review: 'reversed' },
  { label: 'Cash', review: 'cash' },
  { label: 'Non-cash', review: 'non-cash' },
  { label: 'All', review: 'all' },
];

export const GENERAL_LEDGER_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: FinanceAccountingReview;
}[] = [
  { label: 'Needs action', review: 'needs-action' },
  { label: 'Blocked integrity', review: 'unbalanced' },
  { label: 'Draft batches', review: 'draft' },
  { label: 'Posted records', review: 'posted' },
  { label: 'Reversed records', review: 'reversed' },
  { label: 'All records', review: 'all' },
];

export const PAYMENT_CLEARING_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: FinanceAccountingReview;
}[] = [
  { label: 'All unresolved', review: 'unresolved' },
  { label: 'Needs bank match', review: 'open' },
  { label: 'Partial matches', review: 'partial' },
  { label: 'Cleared', review: 'cleared' },
  { label: 'Reversed', review: 'reversed' },
  { label: 'All records', review: 'all' },
];

export const BANK_RECONCILIATION_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: FinanceAccountingReview;
}[] = [
  { label: 'Needs action', review: 'unmatched' },
  { label: 'Partially matched', review: 'partial' },
  { label: 'Matched records', review: 'matched' },
  { label: 'Ignored records', review: 'ignored' },
  { label: 'Reversed records', review: 'reversed' },
  { label: 'All records', review: 'all' },
];

export function readBookingSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): BookingSettlementFilters {
  const period = normalizeOptionalTaxPeriod(readSearchParam(params.period));
  const paymentMethod = normalizeOptionalPaymentMethod(readSearchParam(params.paymentMethod));
  const q = readSearchParam(params.q).trim();
  const returnTo = safeFinanceTaxOverviewReturnTo(readSearchParam(params.returnTo));
  const sort = readSearchParam(params.sort);
  return {
    page: readTaxSettlementPage(readSearchParam(params.page)),
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(period ? { period } : {}),
    ...(q ? { q } : {}),
    range: normalizeDateRange(readSearchParam(params.range)),
    ...(returnTo ? { returnTo } : {}),
    review: normalizeBookingSettlementReview(readSearchParam(params.review)),
    ...(sort ? { sort: normalizeBookingSettlementSort(sort) } : {}),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function readBookingSettlementAuditFilters(
  params: Record<string, string | string[] | undefined>,
): BookingSettlementFilters {
  const filters = readBookingSettlementFilters(params);
  const legacy = bookingSettlementAuditLegacyFilters(readSearchParam(params.review));
  const owner = normalizeBookingSettlementAuditOwner(readSearchParam(params.owner));
  const reason = normalizeBookingSettlementAuditReason(readSearchParam(params.reason)) ?? legacy.reason;
  const status = normalizeBookingSettlementAuditStatus(readSearchParam(params.status)) ?? legacy.status;
  return {
    ...filters,
    ...(owner ? { owner } : {}),
    range: readSearchParam(params.range) ? filters.range : 'all',
    ...(reason ? { reason } : {}),
    review: legacy.review,
    sort: normalizeBookingSettlementSort(readSearchParam(params.sort)),
    ...(status ? { status } : {}),
    take: boundedTake(readSearchParam(params.take) || '25'),
  };
}

export function readCouponFinanceFilters(
  params: Record<string, string | string[] | undefined>,
): BookingSettlementFilters {
  const filters = readBookingSettlementFilters(params);
  const review = readSearchParam(params.review);
  return {
    ...filters,
    review: COUPON_FINANCE_REVIEW_VALUES.includes(review as BookingSettlementReview)
      ? (review as BookingSettlementReview)
      : filters.review,
  };
}

export function readFinanceAccountingFilters(
  params: Record<string, string | string[] | undefined>,
  fallbackReview: FinanceAccountingReview = 'all',
): FinanceAccountingFilters {
  const assignment = normalizeFinanceAccountingAssignment(readSearchParam(params.assignment));
  const assigneeAdminId = readSearchParam(params.assigneeAdminId)?.trim() || undefined;
  const rawReview = readSearchParam(params.review);
  const legacyBankTransactionType = normalizeBankTransactionType(rawReview);
  const bankTransactionType =
    normalizeBankTransactionType(readSearchParam(params.type)) ?? legacyBankTransactionType;
  const review = legacyBankTransactionType
    ? fallbackReview
    : normalizeFinanceAccountingReview(rawReview, fallbackReview);
  const bankReconciliationAge =
    review === 'unmatched' || review === 'partial'
      ? normalizeBankReconciliationAge(readSearchParam(params.age))
      : undefined;
  const bankReconciliationSource = normalizeBankReconciliationEvidenceSource(readSearchParam(params.source));
  const journalSource = normalizeAccountingJournalSourceType(readSearchParam(params.source));
  const period = normalizeOptionalTaxPeriod(readSearchParam(params.period));
  const returnTo = safeFinanceTaxOverviewReturnTo(readSearchParam(params.returnTo));
  const workspace = normalizeFinanceAccountingWorkspace(readSearchParam(params.workspace));
  return {
    ...(assigneeAdminId ? { assigneeAdminId } : {}),
    ...(assignment ? { assignment } : {}),
    ...(bankReconciliationAge ? { bankReconciliationAge } : {}),
    ...(bankReconciliationSource ? { bankReconciliationSource } : {}),
    ...(journalSource ? { journalSource } : {}),
    ...(bankTransactionType ? { bankTransactionType } : {}),
    page: readTaxSettlementPage(readSearchParam(params.page)),
    ...(period ? { period } : {}),
    q: readSearchParam(params.q)?.trim() || undefined,
    range: normalizeDateRange(readSearchParam(params.range)),
    ...(returnTo ? { returnTo } : {}),
    review,
    sort: normalizeFinanceAccountingSort(readSearchParam(params.sort)),
    take: boundedTake(readSearchParam(params.take)),
    ...(workspace ? { workspace } : {}),
  };
}

export function readPaymentClearingFilters(
  params: Record<string, string | string[] | undefined>,
  fallbackReview: FinanceAccountingReview = 'unresolved',
): FinanceAccountingFilters {
  const filters = readFinanceAccountingFilters(params, fallbackReview);
  const paymentClearingAge =
    filters.review === 'unresolved' || filters.review === 'open' || filters.review === 'partial'
      ? normalizePaymentClearingAge(readSearchParam(params.age))
      : undefined;
  return {
    ...filters,
    bankReconciliationAge: undefined,
    ...(paymentClearingAge ? { paymentClearingAge } : {}),
    q: readSearchParam(params.q)?.trim() || undefined,
    range: readSearchParam(params.range) ? filters.range : 'all',
    sort: normalizePaymentClearingSort(readSearchParam(params.sort), filters.review),
  };
}

export function readPartnerWithholdingTaxFilters(
  params: Record<string, string | string[] | undefined>,
): PartnerWithholdingTaxFilters {
  return {
    page: readTaxSettlementPage(readSearchParam(params.page)),
    period: normalizeTaxPeriod(readSearchParam(params.period)),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function readMonthlyTaxClosingFilters(
  params: Record<string, string | string[] | undefined>,
): MonthlyTaxClosingFilters {
  return {
    page: readTaxSettlementPage(readSearchParam(params.page)),
    period: normalizeTaxPeriod(readSearchParam(params.period)),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function buildBookingSettlementSnapshotApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });
  params.set('review', filters.review);
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementPaymentMethod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  appendBookingSettlementAuditFacets(params, filters);
  params.set('take', String(filters.take));
  if (filters.cursor) {
    params.set('cursor', filters.cursor);
  } else {
    appendTaxSettlementSkip(params, filters);
  }
  return `/admin/booking-settlement-snapshots?${params.toString()}`;
}

export function buildBookingSettlementSnapshotDetailApiHref(id: string) {
  return `/admin/booking-settlement-snapshots/${encodeURIComponent(id)}`;
}

export function buildBookingSettlementSnapshotSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  params.set('review', filters.review);
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementPaymentMethod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  appendBookingSettlementAuditFacets(params, filters);
  return `/admin/booking-settlement-snapshots/summary?${params.toString()}`;
}

export function buildBookingSettlementReversalApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });
  if (isSettlementReversalReview(filters.review)) {
    params.set('review', filters.review);
  }
  params.set('take', String(filters.take));
  appendTaxSettlementSkip(params, filters);
  return `/admin/booking-settlement-reversals?${params.toString()}`;
}

export function buildBookingSettlementReversalDetailApiHref(id: string) {
  return `/admin/booking-settlement-reversals/${encodeURIComponent(id)}`;
}

export function buildBookingSettlementReversalSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (isSettlementReversalReview(filters.review)) {
    params.set('review', filters.review);
  }
  return `/admin/booking-settlement-reversals/summary?${params.toString()}`;
}

export function buildAccountingJournalBatchApiHref(filters: FinanceAccountingFilters) {
  return appendGeneralLedgerFilters(
    buildFinanceAccountingApiHref('/admin/accounting-journal-batches', filters),
    filters,
  );
}

export function buildAccountingJournalBatchSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendGeneralLedgerFilters(
    buildFinanceAccountingSummaryApiHref('/admin/accounting-journal-batches/summary', filters),
    filters,
  );
}

export function buildAccountingJournalBatchDetailApiHref(id: string) {
  return `/admin/accounting-journal-batches/${encodeURIComponent(id)}`;
}

export function buildBookingPaymentClearingApiHref(filters: FinanceAccountingFilters) {
  return appendPaymentClearingAge(
    buildFinanceAccountingApiHref('/admin/booking-payment-clearing', filters),
    filters,
  );
}

export function buildBookingPaymentClearingSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendPaymentClearingAge(
    buildFinanceAccountingSummaryApiHref('/admin/booking-payment-clearing/summary', filters),
    filters,
  );
}

export function buildBookingPaymentClearingReviewOwnerSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendPaymentClearingAge(
    buildFinanceAccountingSummaryApiHref('/admin/booking-payment-clearing/review-owner-summary', {
      ...filters,
      assigneeAdminId: undefined,
      assignment: undefined,
    }),
    filters,
  );
}

export function buildBookingPaymentClearingDetailApiHref(id: string) {
  return `/admin/booking-payment-clearing/${encodeURIComponent(id)}`;
}

export function buildBankReconciliationApiHref(filters: FinanceAccountingFilters) {
  return appendBankReconciliationFilters(
    buildFinanceAccountingApiHref('/admin/bank-reconciliation', filters),
    filters,
  );
}

export function buildBankReconciliationSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendBankReconciliationFilters(
    buildFinanceAccountingSummaryApiHref('/admin/bank-reconciliation/summary', filters),
    filters,
  );
}

export function buildBankReconciliationReviewOwnerSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendBankReconciliationFilters(
    buildFinanceAccountingSummaryApiHref('/admin/bank-reconciliation/review-owner-summary', filters),
    filters,
  );
}

export function buildBankReconciliationEvidenceSourceSummaryApiHref(filters: FinanceAccountingFilters) {
  return appendBankReconciliationAge(
    appendBankTransactionType(
      buildFinanceAccountingSummaryApiHref('/admin/bank-reconciliation/evidence-source-summary', filters),
      filters,
    ),
    filters,
  );
}

export function buildBankReconciliationDetailApiHref(id: string) {
  return `/admin/bank-reconciliation/${encodeURIComponent(id)}`;
}

function buildFinanceAccountingApiHref(basePath: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range, take: String(filters.take) });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendFinanceAccountingAssignment(params, filters);
  if (filters.period) params.set('period', filters.period);
  if (filters.q) params.set('q', filters.q);
  if (filters.sort) params.set('sort', filters.sort);
  appendTaxSettlementSkip(params, filters);
  return `${basePath}?${params.toString()}`;
}

function buildFinanceAccountingSummaryApiHref(basePath: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendFinanceAccountingAssignment(params, filters);
  if (filters.period) params.set('period', filters.period);
  if (filters.q) params.set('q', filters.q);
  return `${basePath}?${params.toString()}`;
}

export function buildCouponFinanceSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendBookingSettlementPeriod(params, filters);
  return `/admin/booking-settlement-snapshots/coupon-finance-summary?${params.toString()}`;
}

export function buildCouponFinanceApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendBookingSettlementPeriod(params, filters);
  params.set('take', String(filters.take));
  appendTaxSettlementSkip(params, filters);
  return `/admin/booking-settlement-snapshots/coupon-finance?${params.toString()}`;
}

export function buildPartnerWithholdingTaxApiHref(filters: PartnerWithholdingTaxFilters) {
  const params = new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  });
  appendTaxSettlementSkip(params, filters);
  return `/admin/partner-withholding-tax?${params.toString()}`;
}

export function buildPartnerWithholdingTaxSummaryApiHref(filters: PartnerWithholdingTaxFilters) {
  return `/admin/partner-withholding-tax/summary?${new URLSearchParams({
    period: filters.period,
  }).toString()}`;
}

export function buildProviderWalletWithdrawalRequestSummaryApiHref(filters: BookingSettlementFilters) {
  return `/admin/provider-wallet/withdrawal-requests/summary?${new URLSearchParams({
    range: filters.range,
  }).toString()}`;
}

export function buildMonthlyTaxClosingApiHref(filters: MonthlyTaxClosingFilters) {
  const params = new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  });
  appendTaxSettlementSkip(params, filters);
  return `/admin/monthly-tax-closings?${params.toString()}`;
}

export function buildMonthlyTaxClosingHistoryApiHref(filters: MonthlyTaxClosingFilters) {
  const params = new URLSearchParams({
    take: String(filters.take),
  });
  appendTaxSettlementSkip(params, filters);
  return `/admin/monthly-tax-closings?${params.toString()}`;
}

export function buildMonthlyTaxClosingSummaryApiHref(filters: MonthlyTaxClosingFilters) {
  return `/admin/monthly-tax-closings/summary?${new URLSearchParams({
    period: filters.period,
  }).toString()}`;
}

export function buildPlatformVatSummaryApiHref(filters: MonthlyTaxClosingFilters) {
  return `/admin/platform-vat/summary?${new URLSearchParams({
    period: filters.period,
  }).toString()}`;
}

export function buildPaymentFeeSummaryApiHref(filters: MonthlyTaxClosingFilters) {
  return `/admin/payment-fees/summary?${new URLSearchParams({
    period: filters.period,
  }).toString()}`;
}

export function bookingSettlementAuditHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  params.set('review', filters.review);
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementPaymentMethod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  appendBookingSettlementAuditFacets(params, filters);
  if (filters.returnTo) params.set('returnTo', filters.returnTo);
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/booking-settlement-audit?${params.toString()}`;
}

export function bookingSettlementAuditDetailHref(id: string, returnTo?: string) {
  const href = `/finance-tax/booking-settlement-audit/${encodeURIComponent(id)}`;
  return returnTo ? `${href}?${new URLSearchParams({ returnTo }).toString()}` : href;
}

export function safeBookingSettlementAuditReturnTo(value: string | null | undefined) {
  const fallback = bookingSettlementAuditHref({
    page: 1,
    range: 'all',
    review: 'integrity-exceptions',
    sort: 'oldest',
    take: 25,
  });
  if (!value || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    if (decodeURIComponent(value).includes('\\')) return fallback;
    const url = new URL(value, 'http://hands.local');
    if (url.origin !== 'http://hands.local' || url.pathname !== '/finance-tax/booking-settlement-audit') {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function bookingSettlementReversalHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (isSettlementReversalReview(filters.review)) {
    params.set('review', filters.review);
  }
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/settlement-reversals?${params.toString()}`;
}

export function bookingSettlementReversalDetailHref(id: string) {
  return `/finance-tax/settlement-reversals/${encodeURIComponent(id)}`;
}

export function buildBookingSettlementReversalTraceLinks(
  reversal: Pick<
    AdminBookingSettlementReversalEntry,
    | 'accountingJournalBatches'
    | 'monthlyPeriod'
    | 'originalMonthlyPeriod'
    | 'originalSettlementSnapshotId'
    | 'paymentClearingEntries'
  >,
): BookingSettlementReversalTraceLink[] {
  const journal = reversal.accountingJournalBatches?.[0] ?? null;
  const clearing = reversal.paymentClearingEntries?.[0] ?? null;
  const bankMatch = clearing?.bankReconciliationMatches?.find((match) => match.status !== 'REVERSED') ?? null;
  const links: BookingSettlementReversalTraceLink[] = [
    {
      href: bookingSettlementAuditDetailHref(reversal.originalSettlementSnapshotId),
      label: 'Original settlement',
      value: shortId(reversal.originalSettlementSnapshotId),
    },
    {
      href: monthlyTaxClosingHref({
        page: 1,
        period: reversal.originalMonthlyPeriod,
        take: TAX_SETTLEMENT_DEFAULT_TAKE,
      }),
      label: 'Original monthly close',
      value: reversal.originalMonthlyPeriod,
    },
    {
      href: monthlyTaxClosingHref({
        page: 1,
        period: reversal.monthlyPeriod,
        take: TAX_SETTLEMENT_DEFAULT_TAKE,
      }),
      label: 'Reversal monthly close',
      value: reversal.monthlyPeriod,
    },
  ];

  if (journal) {
    links.push({
      href: generalLedgerDetailHref(journal.id),
      label: 'Reversal journal',
      value: shortId(journal.id),
    });
  }

  if (clearing) {
    links.push({
      href: paymentClearingDetailHref(clearing.id),
      label: 'Payment clearing',
      value: shortId(clearing.id),
    });
  }

  if (bankMatch) {
    links.push({
      href: bankReconciliationDetailHref(bankMatch.bankTransactionId),
      label: 'Bank match',
      value: bankMatch.bankTransaction?.transferRef ?? shortId(bankMatch.bankTransactionId),
    });
  }

  return links;
}

export function buildBookingSettlementReversalEvidenceState(
  reversal: Pick<AdminBookingSettlementReversalEntry, 'accountingJournalBatches' | 'paymentClearingEntries'>,
): BookingSettlementReversalEvidenceState {
  const journal = reversal.accountingJournalBatches?.[0] ?? null;
  const clearing = reversal.paymentClearingEntries?.[0] ?? null;
  const journalStatus = journal?.status ?? 'missing';
  const clearingStatus = clearing?.status ?? 'missing';
  const detail = `Journal ${formatEvidenceStatus(journalStatus)} · Clearing ${formatEvidenceStatus(clearingStatus)}`;

  if (!journal && !clearing) {
    return {
      detail,
      label: 'Evidence missing',
      tone: 'danger',
    };
  }
  if (!journal) {
    return {
      detail,
      label: 'Missing journal',
      tone: 'danger',
    };
  }
  if (!clearing) {
    return {
      detail,
      label: 'Missing clearing',
      tone: 'danger',
    };
  }
  if (journal.status !== 'POSTED') {
    return {
      detail,
      label: 'Journal pending',
      tone: 'warning',
    };
  }
  if (clearing.status === 'OPEN') {
    return {
      detail,
      label: 'Clearing open',
      tone: 'warning',
    };
  }
  if (clearing.status === 'PARTIALLY_CLEARED') {
    return {
      detail,
      label: 'Clearing partial',
      tone: 'warning',
    };
  }
  return {
    detail,
    label: 'Evidence complete',
    tone: 'success',
  };
}

function formatEvidenceStatus(status: string) {
  return status === 'missing' ? status : status.toUpperCase();
}

export function buildFinanceSettlementTraceLinks(record: {
  readonly settlementSnapshotId?: string | null;
  readonly settlementReversalEntryId?: string | null;
}): FinanceSettlementTraceLink[] {
  const links: FinanceSettlementTraceLink[] = [];

  if (record.settlementSnapshotId) {
    links.push({
      href: bookingSettlementAuditDetailHref(record.settlementSnapshotId),
      label: 'Settlement record',
      value: shortId(record.settlementSnapshotId),
    });
  }

  if (record.settlementReversalEntryId) {
    links.push({
      href: bookingSettlementReversalDetailHref(record.settlementReversalEntryId),
      label: 'Settlement reversal',
      value: shortId(record.settlementReversalEntryId),
    });
  }

  return links;
}

export function generalLedgerHref(filters: FinanceAccountingFilters) {
  return appendGeneralLedgerFilters(financeAccountingHref('/finance-tax/general-ledger', filters), filters);
}

export function buildGeneralLedgerExportHref(filters: FinanceAccountingFilters) {
  const href = appendGeneralLedgerFilters(
    financeAccountingHref('/api/admin/finance-tax/general-ledger/export', {
      ...filters,
      page: 1,
      take: 100,
    }),
    filters,
  );
  const url = new URL(href, 'http://hands.local');
  url.searchParams.delete('page');
  url.searchParams.delete('take');
  return `${url.pathname}${url.search}`;
}

export function generalLedgerDetailHref(id: string, returnTo?: string) {
  const pathname = `/finance-tax/general-ledger/${encodeURIComponent(id)}`;
  return returnTo ? `${pathname}?returnTo=${encodeURIComponent(returnTo)}` : pathname;
}

export function safeGeneralLedgerReturnTo(value: string) {
  if (
    /^\/finance-tax\/general-ledger(?:\?|#|$)/.test(value) &&
    !value.startsWith('//') &&
    !value.includes('\\')
  ) {
    return value;
  }
  return '/finance-tax/general-ledger?range=all&review=needs-action&page=1&take=25';
}

export function paymentClearingHref(filters: FinanceAccountingFilters) {
  return appendPaymentClearingAge(financeAccountingHref('/finance-tax/payment-clearing', filters), filters);
}

export function paymentClearingDetailHref(id: string, returnTo?: string) {
  const pathname = `/finance-tax/payment-clearing/${encodeURIComponent(id)}`;
  return returnTo ? `${pathname}?returnTo=${encodeURIComponent(returnTo)}` : pathname;
}

export function safePaymentClearingDetailReturnTo(value: string) {
  if (
    /^\/finance-tax\/payment-clearing(?:\?|#|$)/.test(value) &&
    !value.startsWith('//') &&
    !value.includes('\\')
  ) {
    return value;
  }
  return '/finance-tax/payment-clearing?range=all&review=unresolved&page=1&take=25';
}

export function bankReconciliationHref(filters: FinanceAccountingFilters) {
  return appendBankReconciliationFilters(
    financeAccountingHref('/finance-tax/bank-reconciliation', filters),
    filters,
  );
}

export function bankReconciliationDetailHref(id: string, returnTo?: string) {
  const pathname = `/finance-tax/bank-reconciliation/${encodeURIComponent(id)}`;
  return returnTo ? `${pathname}?returnTo=${encodeURIComponent(returnTo)}` : pathname;
}

export function safeBankReconciliationReturnTo(value: string) {
  if (
    (/^\/finance-tax\/bank-reconciliation(?:\?|#|$)/.test(value) ||
      /^\/finance-tax\/payment-clearing\/[^/?]+(?:\?|$)/.test(value)) &&
    !value.startsWith('//') &&
    !value.includes('\\')
  ) {
    return value;
  }
  return '/finance-tax/bank-reconciliation?range=all&review=unmatched';
}

function financeAccountingHref(pathname: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendFinanceAccountingAssignment(params, filters);
  if (filters.period) params.set('period', filters.period);
  if (filters.q) params.set('q', filters.q);
  if (filters.returnTo) params.set('returnTo', filters.returnTo);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.workspace) params.set('workspace', filters.workspace);
  appendTaxSettlementUiPagination(params, filters);
  return `${pathname}?${params.toString()}`;
}

function appendGeneralLedgerFilters(href: string, filters: FinanceAccountingFilters) {
  const url = new URL(href, 'http://hands.local');
  url.searchParams.set('review', filters.review);
  if (filters.journalSource) url.searchParams.set('source', filters.journalSource);
  return `${url.pathname}${url.search}`;
}

function appendBankTransactionType(href: string, filters: FinanceAccountingFilters) {
  if (!filters.bankTransactionType) return href;
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}type=${filters.bankTransactionType}`;
}

function appendBankReconciliationFilters(href: string, filters: FinanceAccountingFilters) {
  const hrefWithType = appendBankTransactionType(href, filters);
  const hrefWithSource = filters.bankReconciliationSource
    ? `${hrefWithType}${hrefWithType.includes('?') ? '&' : '?'}source=${filters.bankReconciliationSource}`
    : hrefWithType;
  return appendBankReconciliationAge(hrefWithSource, filters);
}

function appendBankReconciliationAge(href: string, filters: FinanceAccountingFilters) {
  if (!filters.bankReconciliationAge || (filters.review !== 'unmatched' && filters.review !== 'partial')) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}age=${filters.bankReconciliationAge}`;
}

function appendPaymentClearingAge(href: string, filters: FinanceAccountingFilters) {
  if (
    !filters.paymentClearingAge ||
    (filters.review !== 'unresolved' && filters.review !== 'open' && filters.review !== 'partial')
  ) {
    return href;
  }
  const separator = href.includes('?') ? '&' : '?';
  return `${href}${separator}age=${filters.paymentClearingAge}`;
}

export function couponFinanceHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  if (filters.returnTo) params.set('returnTo', filters.returnTo);
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/coupon-finance?${params.toString()}`;
}

export function buildTaxSettlementServerPagination<T>(
  rows: readonly T[],
  filters: { readonly page: number; readonly take: number },
  totalRows: number,
) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.take));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.take;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    page,
    pageSize: filters.take,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
}

export function partnerWithholdingTaxHref(filters: PartnerWithholdingTaxFilters) {
  const params = new URLSearchParams({ period: filters.period });
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/partner-withholding-tax?${params.toString()}`;
}

export function monthlyTaxClosingHref(filters: MonthlyTaxClosingFilters) {
  const params = new URLSearchParams({ period: filters.period });
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/monthly-tax-closing?${params.toString()}`;
}

export function platformVatHref(filters: MonthlyTaxClosingFilters) {
  return `/finance-tax/platform-vat?${new URLSearchParams({ period: filters.period }).toString()}`;
}

export function paymentFeeHref(filters: MonthlyTaxClosingFilters) {
  return `/finance-tax/payment-fees?${new URLSearchParams({ period: filters.period }).toString()}`;
}

export function buildTaxFinanceWorkflowLinks({
  accountingFilters,
  current,
  monthlyFilters,
  settlementFilters,
  withholdingFilters,
}: {
  readonly accountingFilters?: FinanceAccountingFilters;
  readonly current: TaxFinanceWorkflowPage;
  readonly monthlyFilters: MonthlyTaxClosingFilters;
  readonly settlementFilters: BookingSettlementFilters;
  readonly withholdingFilters: PartnerWithholdingTaxFilters;
}): TaxFinanceWorkflowLink[] {
  const ledgerFilters: FinanceAccountingFilters = accountingFilters ?? {
    page: settlementFilters.page,
    range: settlementFilters.range,
    review: 'all',
    take: settlementFilters.take,
  };
  const links: TaxFinanceWorkflowLink[] = [
    { key: 'overview', label: 'Tax overview', href: '/finance-tax' },
    { key: 'approval-queue', label: 'Finance approval queue', href: '/finance-tax/approval-queue' },
    {
      key: 'booking-settlement-audit',
      label: 'Booking settlement audit',
      href: bookingSettlementAuditHref(settlementFilters),
    },
    {
      key: 'settlement-reversals',
      label: 'Settlement reversals',
      href: bookingSettlementReversalHref(settlementFilters),
    },
    {
      key: 'general-ledger',
      label: 'Journal batches',
      href: generalLedgerHref(ledgerFilters),
    },
    {
      key: 'finance-approvers',
      label: 'Finance approvers',
      href: '/finance-tax/finance-approvers',
    },
    {
      key: 'payment-clearing',
      label: 'Payment clearing',
      href: paymentClearingHref(ledgerFilters),
    },
    {
      key: 'bank-reconciliation',
      label: 'Bank reconciliation',
      href: bankReconciliationHref(ledgerFilters),
    },
    {
      key: 'coupon-finance',
      label: 'Coupon finance',
      href: couponFinanceHref(settlementFilters),
    },
    {
      key: 'monthly-tax-closing',
      label: 'Monthly tax closing',
      href: monthlyTaxClosingHref(monthlyFilters),
    },
    { key: 'platform-vat', label: 'Platform VAT', href: platformVatHref(monthlyFilters) },
    { key: 'payment-fees', label: 'Payment fees', href: paymentFeeHref(monthlyFilters) },
    {
      key: 'partner-withholding-tax',
      label: 'Partner withholding tax',
      href: partnerWithholdingTaxHref(withholdingFilters),
    },
  ];

  return links.filter((link) => link.key !== current);
}

export function buildFinancePayoutPriorityLinks(
  settlementFilters: BookingSettlementFilters,
  withdrawalSummary: AdminProviderWalletWithdrawalRequestSummary | null = null,
): FinancePayoutPriorityLink[] {
  const range = settlementFilters.range;
  return [
    {
      key: 'withdrawal-requested',
      amount: withdrawalSummary?.requestedAmount ?? null,
      currency: withdrawalSummary?.currency ?? null,
      amountSuffix: null,
      count: withdrawalSummary?.requested ?? null,
      label: 'Withdrawal requested',
      helper: 'Partner withdrawal requests waiting for first finance review.',
      href: payoutWithdrawalStatusHref(range, 'REQUESTED'),
      signal: 'Finance review',
    },
    {
      key: 'review-required',
      amount: withdrawalSummary?.pendingWithdrawalPayableAmount ?? null,
      currency: withdrawalSummary?.currency ?? null,
      amountSuffix: withdrawalSummary ? 'locked' : null,
      count: withdrawalSummary?.reviewRequired ?? null,
      label: 'Review required',
      helper: 'Withdrawal requests blocked by an explicit review flag before bank payout.',
      href: payoutWithdrawalStatusHref(range, 'REVIEW_REQUIRED'),
      signal: 'Needs action',
    },
    {
      key: 'bank-transfer-pending',
      amount: withdrawalSummary?.bankTransferPendingAmount ?? null,
      currency: withdrawalSummary?.currency ?? null,
      amountSuffix: null,
      count: withdrawalSummary?.bankTransferPending ?? null,
      label: 'Bank transfer pending',
      helper: 'Approved requests already moved into the manual bank transfer lane.',
      href: payoutWithdrawalStatusHref(range, 'BANK_TRANSFER_PENDING'),
      signal: 'Banking',
    },
    {
      key: 'cash-debt-gate',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: null,
      label: 'Cash debt gate',
      helper:
        'Partner cash booking fee debt that can block final acceptance, service start, or payout release.',
      href: `/cash-settlements?${new URLSearchParams({ range }).toString()}`,
      signal: 'Cash debt',
    },
  ];
}

export function buildFinanceOperationsPriorityLinks({
  accountingFilters,
  bankSummary,
  clearingSummary,
  monthlyClosingFilters,
  monthlyClosingSummary,
  settlementFilters,
  settlementSummary,
}: {
  readonly accountingFilters: FinanceAccountingFilters;
  readonly bankSummary: AdminBankReconciliationSummary;
  readonly clearingSummary: AdminBookingPaymentClearingSummary;
  readonly monthlyClosingFilters: MonthlyTaxClosingFilters;
  readonly monthlyClosingSummary: AdminMonthlyTaxClosingSummary;
  readonly settlementFilters: BookingSettlementFilters;
  readonly settlementSummary: AdminBookingSettlementSnapshotSummary;
}): FinancePayoutPriorityLink[] {
  const clearingFilters: FinanceAccountingFilters = {
    ...accountingFilters,
    page: 1,
    review: 'open',
  };
  const bankFilters: FinanceAccountingFilters = {
    ...accountingFilters,
    page: 1,
    review: 'unmatched',
  };
  const closeoutRiskCount =
    monthlyClosingSummary.openTaxCount +
    monthlyClosingSummary.couponReviewFlagCount +
    monthlyClosingSummary.paymentFeeReviewFlagCount;
  return [
    {
      key: 'today-needs-action',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: settlementSummary.needsActionCount,
      label: 'Today needs action',
      helper: 'Settlement records waiting for declaration, payment, or closeout review in the active range.',
      href: bookingSettlementAuditHref({ ...settlementFilters, page: 1, review: 'open' }),
      signal: 'Needs action',
    },
    {
      key: 'payment-clearing-open',
      amount: clearingSummary.amount,
      currency: clearingSummary.currency,
      amountSuffix: null,
      count: clearingSummary.openCount,
      label: 'Payment clearing open',
      helper:
        'Customer payment, settlement posting, refund, payment fee, or coupon clearing rows still open.',
      href: paymentClearingHref(clearingFilters),
      signal: 'Unsettled',
    },
    {
      key: 'bank-unmatched',
      amount: bankSummary.amount,
      currency: bankSummary.currency,
      amountSuffix: null,
      count: bankSummary.unmatchedCount,
      label: 'Bank unmatched',
      helper: 'Company bank transactions still missing explicit reconciliation evidence.',
      href: bankReconciliationHref(bankFilters),
      signal: 'Unmatched',
    },
    {
      key: 'monthly-close-risk',
      amount: monthlyClosingSummary.cashDebtTotal > 0 ? monthlyClosingSummary.cashDebtTotal : null,
      currency: monthlyClosingSummary.cashDebtTotal > 0 ? monthlyClosingSummary.currency : null,
      amountSuffix: monthlyClosingSummary.cashDebtTotal > 0 ? 'cash debt' : null,
      count: closeoutRiskCount,
      label: 'Monthly close risk',
      helper: 'Open tax rows and coupon review flags that should be reviewed before monthly closing.',
      href: monthlyTaxClosingHref({ ...monthlyClosingFilters, page: 1 }),
      signal: 'Closeout risk',
    },
  ];
}

export function buildFinanceOperationsSummaryFilters(accountingFilters: FinanceAccountingFilters) {
  return {
    clearingFilters: {
      ...accountingFilters,
      page: 1,
      review: 'open' as const,
    },
    bankFilters: {
      ...accountingFilters,
      page: 1,
      review: 'unmatched' as const,
    },
  };
}

export function buildTaxFinanceMetrics(
  settlementSummary: AdminBookingSettlementSnapshotSummary,
  withholdingSummary: AdminPartnerWithholdingTaxSummary,
) {
  const currency = settlementSummary.currency || withholdingSummary.currency || 'VND';

  return [
    {
      label: 'Snapshot rows',
      value: settlementSummary.count,
      helper: 'Posted booking settlement records matching the active queue.',
      href: '/finance-tax/booking-settlement-audit',
    },
    {
      label: 'Open tax rows',
      value: settlementSummary.openTaxCount,
      helper: 'Snapshot rows still waiting for declaration, payment, or closeout.',
      href: '/finance-tax/booking-settlement-audit?review=open',
    },
    {
      label: 'Customer paid',
      value: formatMoney(settlementSummary.customerPaymentAmount, currency),
      helper: 'Customer payment amount captured by posted settlement records.',
    },
    {
      label: 'Partner payout',
      value: formatMoney(settlementSummary.partnerPayoutAmount, currency),
      helper: 'Partner payout amount before monthly payout execution.',
    },
    {
      label: 'Partner tax withheld',
      value: formatMoney(withholdingSummary.totalPartnerTaxWithheld, withholdingSummary.currency || currency),
      helper: 'VAT plus PIT withheld for the selected monthly tax period.',
      href: partnerWithholdingTaxHref({
        page: 1,
        period: withholdingSummary.period,
        take: TAX_SETTLEMENT_DEFAULT_TAKE,
      }),
    },
    {
      label: 'Company VAT',
      value: formatMoney(settlementSummary.companyOutputVat, currency),
      helper: 'Output VAT component from HANDS platform fee records.',
    },
    {
      label: 'Payment fees',
      value: formatMoney(settlementSummary.paymentProcessingFee, currency),
      helper: 'Payment processing fee cost recorded on settlement records.',
    },
    {
      label: 'Partners with revenue',
      value: withholdingSummary.partnerCountWithRevenue,
      helper: 'Partners with taxable settlement rows in the selected period.',
      href: partnerWithholdingTaxHref({
        page: 1,
        period: withholdingSummary.period,
        take: TAX_SETTLEMENT_DEFAULT_TAKE,
      }),
    },
  ];
}

export function emptyBookingSettlementSummary(): AdminBookingSettlementSnapshotSummary {
  return {
    actionRequiredCount: 0,
    allocationMismatchCount: 0,
    amountAtRisk: 0,
    checkedAt: '',
    clearCount: 0,
    clearingEvidenceIssueCount: 0,
    closedTaxCount: 0,
    count: 0,
    couponEvidenceIssueCount: 0,
    currency: 'VND',
    customerPaymentAmount: 0,
    declaredTaxCount: 0,
    feeEvidenceIssueCount: 0,
    journalEvidenceIssueCount: 0,
    integrityReasonCount: 0,
    needsActionCount: 0,
    oldestActionRequiredAt: null,
    oldestNeedsActionAt: null,
    partnerPayoutAmount: 0,
    partnerWithholdingTotal: 0,
    paymentEvidenceCount: 0,
    platformFeeGross: 0,
    platformFeeNetRevenue: 0,
    companyOutputVat: 0,
    paymentProcessingFee: 0,
    paymentFeeEvidenceIssueCount: 0,
    openTaxCount: 0,
    overdueTaxCount: 0,
    paidTaxCount: 0,
    resolvedCount: 0,
    reversalEvidenceCompleteCount: 0,
    reversalEvidenceIncompleteCount: 0,
    reversalIncompleteCount: 0,
    reversedClearCount: 0,
    reversedCount: 0,
    reversedWithOtherBlockersCount: 0,
    taxDueDateUnknownCount: 0,
    taxEvidenceIssueCount: 0,
    taxWorkflowCount: 0,
    unknownCount: 0,
  };
}

export function emptyBookingSettlementReversalSummary(): AdminBookingSettlementReversalSummary {
  return {
    count: 0,
    currency: 'VND',
    customerPaymentAmount: 0,
    partnerPayoutAmount: 0,
    partnerWithholdingTotal: 0,
    platformFeeGross: 0,
    platformFeeNetRevenue: 0,
    companyOutputVat: 0,
    paymentProcessingFee: 0,
    cashCount: 0,
    nonCashCount: 0,
  };
}

export function emptyAccountingJournalBatchSummary(): AdminAccountingJournalBatchSummary {
  return {
    balancedCount: 0,
    blockedAmount: 0,
    blockedCount: 0,
    clearCount: 0,
    count: 0,
    currency: 'VND',
    draftCount: 0,
    entryMismatchCount: 0,
    formulaDeltaCount: 0,
    generatedAt: '',
    headerEntryMismatchCount: 0,
    headerMismatchCount: 0,
    needsActionCount: 0,
    postedCount: 0,
    postedWithoutEntryCount: 0,
    reversedCount: 0,
    totalCredit: 0,
    totalDebit: 0,
    unbalancedAmount: 0,
    unbalancedCount: 0,
    unknownCount: 0,
  };
}

export function emptyBookingPaymentClearingSummary(): AdminBookingPaymentClearingSummary {
  return {
    amount: 0,
    assignedCount: 0,
    clearedCount: 0,
    count: 0,
    currency: 'VND',
    openAmount: 0,
    openCount: 0,
    over48hAmount: 0,
    over48hCount: 0,
    partiallyClearedAmount: 0,
    partiallyClearedCount: 0,
    reversedCount: 0,
    unassignedCount: 0,
  };
}

export function emptyBankReconciliationSummary(): AdminBankReconciliationSummary {
  return {
    amount: 0,
    assignedCount: 0,
    count: 0,
    currency: 'VND',
    ignoredCount: 0,
    matchedAmount: 0,
    matchedCount: 0,
    openExposureAmount: 0,
    partiallyMatchedAmount: 0,
    partiallyMatchedCount: 0,
    reversedCount: 0,
    unassignedCount: 0,
    unassignedOver48hAmount: 0,
    unassignedOver48hCount: 0,
    unmatchedAmount: 0,
    unmatchedCount: 0,
  };
}

export function emptyBankReconciliationReviewOwnerSummary(): AdminBankReconciliationReviewOwnerSummary {
  return emptyFinanceReviewOwnerWorkloadSummary();
}

export function emptyFinanceReviewOwnerWorkloadSummary(): AdminFinanceReviewOwnerWorkloadSummary {
  return {
    currency: 'VND',
    openAmount: 0,
    openCount: 0,
    owners: [],
    unassigned: {
      oldestOccurredAt: null,
      openAmount: 0,
      openCount: 0,
      over48hAmount: 0,
      over48hCount: 0,
    },
  };
}

export function emptyBankReconciliationEvidenceSourceSummary(): AdminBankReconciliationEvidenceSourceSummary {
  return {
    amount: 0,
    count: 0,
    currency: 'VND',
    sources: [
      'PAYMENT_CLEARING',
      'PARTNER_DEPOSIT',
      'WITHDRAWAL',
      'PAYOUT',
      'REFUND',
      'OTHER_JOURNAL',
      'UNCLASSIFIED',
    ].map((source) => ({
      amount: 0,
      count: 0,
      source: source as BankReconciliationEvidenceSource,
    })),
  };
}

export function emptyCouponFinanceSummary(): AdminCouponFinanceSummary {
  return {
    bookingServiceAmount: 0,
    companyCouponExpense: 0,
    couponDiscountAmount: 0,
    couponReviewFlagCount: 0,
    couponSettlementCount: 0,
    currency: 'VND',
    customerPaidAmount: 0,
    partnerFundedCouponAmount: 0,
    platformFeeDiscountAmount: 0,
    reversedCompanyCouponExpense: 0,
    reversedCouponDiscountAmount: 0,
    settlementBaseAmount: 0,
  };
}

export function emptyPartnerWithholdingTaxSummary(
  period = normalizeTaxPeriod(''),
): AdminPartnerWithholdingTaxSummary {
  return {
    period,
    currency: 'VND',
    partnerCountWithRevenue: 0,
    taxableBookingCount: 0,
    grossServiceRevenue: 0,
    partnerPayoutTotal: 0,
    partnerVatWithheldTotal: 0,
    partnerPitWithheldTotal: 0,
    totalPartnerTaxWithheld: 0,
  };
}

export function emptyProviderWalletWithdrawalRequestSummary(): AdminProviderWalletWithdrawalRequestSummary {
  return {
    total: 0,
    requested: 0,
    reviewRequired: 0,
    bankTransferPending: 0,
    lockReleased: 0,
    totalAmount: 0,
    requestedAmount: 0,
    pendingWithdrawalPayableAmount: 0,
    bankTransferPendingAmount: 0,
    paidAmount: 0,
    returnedAmount: 0,
    paidUnreconciled: 0,
    paidUnreconciledAmount: 0,
    paidReconciled: 0,
    paidReconciledAmount: 0,
    currency: 'VND',
  };
}

export function emptyMonthlyTaxClosingSummary(
  period = normalizeTaxPeriod(''),
): AdminMonthlyTaxClosingSummary {
  return {
    generatedAt: null,
    hasActivity: false,
    id: null,
    journalReconciliationIssueCount: 0,
    monthlyClosingHistoryCount: 0,
    period,
    currency: 'VND',
    status: 'DRAFT',
    periodState: 'NOT_STARTED',
    settlementCount: 0,
    reversalCount: 0,
    customerPaymentAmountTotal: 0,
    partnerPayoutTotal: 0,
    platformFeeGrossTotal: 0,
    platformFeeNetRevenueTotal: 0,
    companyOutputVatTotal: 0,
    partnerVatWithheldTotal: 0,
    partnerPitWithheldTotal: 0,
    partnerWithholdingTotal: 0,
    paymentProcessingFeeTotal: 0,
    paymentFeeReviewFlagCount: 0,
    partnerDepositReconciliationOpenCount: 0,
    partnerDepositReconciliationOpenAmount: 0,
    payoutBankOutflowReconciliationOpenCount: 0,
    payoutBankOutflowReconciliationOpenAmount: 0,
    payoutReturnInflowReconciliationOpenCount: 0,
    payoutReturnInflowReconciliationOpenAmount: 0,
    couponSettlementCount: 0,
    couponReversalCount: 0,
    couponDiscountAmountTotal: 0,
    companyCouponExpenseTotal: 0,
    partnerFundedCouponAmountTotal: 0,
    platformFeeDiscountAmountTotal: 0,
    couponReviewFlagCount: 0,
    cashDebtTotal: 0,
    nonCashPartnerPayoutTotal: 0,
    partnerCountWithRevenue: 0,
    openTaxCount: 0,
    paidTaxCount: 0,
    reconciliationDelta: 0,
    netRevenueDelta: 0,
    preflight: {
      blockers: [],
      nextStatus: 'REVIEWED',
      ready: true,
    },
    declaredAt: null,
    paidAt: null,
    closedAt: null,
    notes: null,
    remittanceMetadata: null,
  };
}

export function buildMonthlyTaxClosingMetrics(summary: AdminMonthlyTaxClosingSummary) {
  const periodState = summary.periodState ?? summary.status;
  return [
    {
      label: 'Period status',
      value: periodState,
      helper: summary.id
        ? 'Stored monthly close state.'
        : 'No monthly close record has been started for this period.',
    },
    {
      label: 'Settlements',
      value: summary.settlementCount,
      helper: 'Settlement records included in this monthly tax period.',
    },
    {
      label: 'Customer paid',
      value: formatMoney(summary.customerPaymentAmountTotal, summary.currency),
      helper: 'Customer payment total. This is not company revenue.',
    },
    {
      label: 'Partner withholding',
      value: formatMoney(summary.partnerWithholdingTotal, summary.currency),
      helper: 'Partner VAT plus PIT withheld for the month.',
    },
    {
      label: 'Company output VAT',
      value: formatMoney(summary.companyOutputVatTotal, summary.currency),
      helper: 'Company VAT payable from platform fee gross.',
    },
    {
      label: 'Payment fees',
      value: formatMoney(summary.paymentProcessingFeeTotal, summary.currency),
      helper: 'Processing fees tracked separately from tax.',
    },
    {
      label: 'Coupon expense',
      value: formatMoney(summary.companyCouponExpenseTotal, summary.currency),
      helper: 'Company-funded coupon expense for this period. It does not reduce platform revenue or VAT.',
    },
    {
      label: 'Formula delta',
      value: formatMoney(summary.reconciliationDelta, summary.currency),
      helper:
        'Customer payment plus company-funded coupon expense minus Partner payout, withholding, and platform fee gross. Payment processing fees are excluded.',
    },
    {
      label: 'Net revenue delta',
      value: formatMoney(summary.netRevenueDelta, summary.currency),
      helper: 'Platform fee gross minus company output VAT and net revenue.',
    },
  ];
}

export function buildMonthlyTaxClosingRiskLinks(
  summary: AdminMonthlyTaxClosingSummary,
  settlementFilters: BookingSettlementFilters,
  closingFilters: MonthlyTaxClosingFilters,
): FinancePayoutPriorityLink[] {
  const returnTo = `/finance-tax?${new URLSearchParams({ period: closingFilters.period }).toString()}`;
  const deltaCount = (summary.reconciliationDelta !== 0 ? 1 : 0) + (summary.netRevenueDelta !== 0 ? 1 : 0);
  const deltaAmount = Math.abs(summary.reconciliationDelta) + Math.abs(summary.netRevenueDelta);

  return [
    {
      key: 'journal-reconciliation-issues',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: summary.journalReconciliationIssueCount,
      label: 'Journal reconciliation',
      helper: 'Posted journal batches with blocked header, entry, formula, or period integrity prevent monthly close advancement.',
      href: `/finance-tax/general-ledger?${new URLSearchParams({
        q: closingFilters.period,
        range: 'all',
        review: 'unbalanced',
      }).toString()}`,
      signal: 'Journal blocker',
    },
    {
      key: 'open-tax-rows',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: summary.openTaxCount,
      label: 'Open tax rows',
      helper: 'Settlement rows still waiting for declaration, payment, or tax closeout review.',
      href: bookingSettlementAuditHref({
        ...settlementFilters,
        page: 1,
        period: closingFilters.period,
        range: 'all',
        returnTo,
        review: 'tax-open',
        sort: 'oldest',
      }),
      signal: 'Tax review',
    },
    {
      key: 'coupon-review-flags',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: summary.couponReviewFlagCount,
      label: 'Coupon review flags',
      helper: 'Coupon settlement rows that should be checked before the monthly period is closed.',
      href: couponFinanceHref({
        ...settlementFilters,
        page: 1,
        period: closingFilters.period,
        returnTo,
        review: 'coupon-review',
        sort: 'oldest',
      }),
      signal: 'Coupon review',
    },
    {
      key: 'payment-fee-review-flags',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: summary.paymentFeeReviewFlagCount,
      label: 'Payment fee evidence',
      helper: `${summary.paymentFeeReviewFlagCount} processor settlement row(s) lack resolved payment fee policy evidence and block declaration.`,
      href: bookingSettlementAuditHref({
        ...settlementFilters,
        page: 1,
        period: closingFilters.period,
        range: 'all',
        returnTo,
        review: 'payment-fee-evidence',
        sort: 'oldest',
      }),
      signal: 'Fee policy review',
    },
    {
      key: 'partner-deposit-reconciliation',
      amount: summary.partnerDepositReconciliationOpenAmount,
      currency: summary.currency,
      amountSuffix: null,
      count: summary.partnerDepositReconciliationOpenCount,
      label: 'Partner deposit reconciliation',
      helper: `${summary.partnerDepositReconciliationOpenCount} executed Partner bank deposit(s) still need complete company bank evidence matching before declaration.`,
      href: `/finance-tax/partner-bank-deposits?${new URLSearchParams({
        period: closingFilters.period,
        review: 'needs-reconciliation',
        returnTo,
        sort: 'oldest',
      }).toString()}`,
      signal: 'Bank evidence',
    },
    {
      key: 'payout-bank-outflow-reconciliation',
      amount: summary.payoutBankOutflowReconciliationOpenAmount,
      currency: summary.currency,
      amountSuffix: null,
      count: summary.payoutBankOutflowReconciliationOpenCount,
      label: 'Payout bank outflow reconciliation',
      helper: `${summary.payoutBankOutflowReconciliationOpenCount} paid Partner payout batch(es) still need a complete OUTFLOW match to the posted bank credit before declaration.`,
      href: bankReconciliationHref({
        bankReconciliationSource: 'PAYOUT',
        bankTransactionType: 'OUTFLOW',
        page: 1,
        period: closingFilters.period,
        range: 'all',
        returnTo,
        review: 'unmatched',
        sort: 'oldest',
        take: settlementFilters.take,
        workspace: 'operations',
      }),
      signal: 'Payout evidence',
    },
    {
      key: 'payout-return-inflow-reconciliation',
      amount: summary.payoutReturnInflowReconciliationOpenAmount,
      currency: summary.currency,
      amountSuffix: null,
      count: summary.payoutReturnInflowReconciliationOpenCount,
      label: 'Payout return inflow reconciliation',
      helper: `${summary.payoutReturnInflowReconciliationOpenCount} Partner payout return(s) still need a complete INFLOW match to the posted reversal bank debit before declaration.`,
      href: bankReconciliationHref({
        bankReconciliationSource: 'PAYOUT',
        bankTransactionType: 'INFLOW',
        page: 1,
        period: closingFilters.period,
        range: 'all',
        returnTo,
        review: 'unmatched',
        sort: 'oldest',
        take: settlementFilters.take,
        workspace: 'operations',
      }),
      signal: 'Return evidence',
    },
    {
      key: 'cash-debt-gate',
      amount: summary.cashDebtTotal,
      currency: summary.currency,
      amountSuffix: null,
      count: null,
      label: 'Cash debt gate',
      helper:
        'Partner cash booking debt affects payout and collection work. It is a review flag, not a tax-close formula blocker.',
      href: `/cash-settlements?${new URLSearchParams({
        period: closingFilters.period,
        returnTo,
      }).toString()}`,
      signal: 'Cash debt',
    },
    {
      key: 'reconciliation-deltas',
      amount: deltaAmount,
      currency: summary.currency,
      amountSuffix: null,
      count: deltaCount,
      label: 'Reconciliation deltas',
      helper: 'Formula and net revenue deltas must be 0 before declaration or final closeout.',
      href: monthlyTaxClosingHref({ ...closingFilters, page: 1 }),
      signal: 'Formula check',
    },
  ];
}

export function resolveMonthlyTaxClosingPreflight(
  summary: AdminMonthlyTaxClosingSummary,
): AdminMonthlyTaxClosingPreflight {
  if (summary.periodState === 'FUTURE_PERIOD' && summary.preflight) {
    return summary.preflight;
  }
  const expectedNextStatus = monthlyTaxClosingNextStatusOptions(summary.status)[0]?.value ?? null;
  if (summary.preflight && summary.preflight.nextStatus === expectedNextStatus) {
    return summary.preflight;
  }

  const nextStatus = expectedNextStatus;
  const blockers: AdminMonthlyTaxClosingPreflight['blockers'] = [];
  if (summary.reconciliationDelta !== 0) {
    blockers.push({
      code: 'RECONCILIATION_DELTA',
      message: 'Customer payment reconciliation must equal 0 before the period can advance.',
    });
  }
  if (summary.netRevenueDelta !== 0) {
    blockers.push({
      code: 'NET_REVENUE_DELTA',
      message:
        'Platform fee, company VAT, and net revenue reconciliation must equal 0 before the period can advance.',
    });
  }
  if (summary.journalReconciliationIssueCount > 0) {
    blockers.push({
      code: 'POSTED_JOURNAL_DELTA',
      message: `${summary.journalReconciliationIssueCount} posted journal batch(es) have an open reconciliation delta.`,
    });
  }
  if (nextStatus && nextStatus !== 'REVIEWED') {
    if (summary.paymentFeeReviewFlagCount > 0) {
      blockers.push({
        code: 'PAYMENT_FEE_EVIDENCE',
        message: `${summary.paymentFeeReviewFlagCount} settlement(s) still need resolved payment fee policy evidence.`,
      });
    }
    if (summary.partnerDepositReconciliationOpenCount > 0) {
      blockers.push({
        code: 'PARTNER_DEPOSIT_RECONCILIATION',
        message: `${summary.partnerDepositReconciliationOpenCount} executed Partner bank deposit(s) still need complete bank reconciliation.`,
      });
    }
    if (summary.payoutBankOutflowReconciliationOpenCount > 0) {
      blockers.push({
        code: 'PAYOUT_BANK_OUTFLOW_RECONCILIATION',
        message: `${summary.payoutBankOutflowReconciliationOpenCount} paid Partner payout batch(es) still need complete bank outflow reconciliation.`,
      });
    }
    if (summary.payoutReturnInflowReconciliationOpenCount > 0) {
      blockers.push({
        code: 'PAYOUT_RETURN_INFLOW_RECONCILIATION',
        message: `${summary.payoutReturnInflowReconciliationOpenCount} Partner payout return(s) still need complete bank inflow reconciliation.`,
      });
    }
  }

  return {
    blockers,
    nextStatus,
    ready: Boolean(nextStatus) && blockers.length === 0,
  };
}

export function buildMonthlyTaxClosingPreflightLinks(
  summary: AdminMonthlyTaxClosingSummary,
  settlementFilters: BookingSettlementFilters,
  closingFilters: MonthlyTaxClosingFilters,
): FinancePayoutPriorityLink[] {
  const riskLinks = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, closingFilters);
  const preflight = resolveMonthlyTaxClosingPreflight(summary);
  const linksByKey = new Map<string, FinancePayoutPriorityLink>();

  for (const blocker of preflight.blockers) {
    const base = monthlyTaxClosingPreflightBaseLink(
      blocker.code,
      summary,
      riskLinks,
      settlementFilters,
      closingFilters,
    );
    const existing = linksByKey.get(base.key);
    linksByKey.set(base.key, {
      ...base,
      helper: existing ? `${existing.helper} ${blocker.message}` : blocker.message,
    });
  }

  return [...linksByKey.values()];
}

function monthlyTaxClosingPreflightBaseLink(
  code: AdminMonthlyTaxClosingPreflightBlockerCode,
  summary: AdminMonthlyTaxClosingSummary,
  riskLinks: FinancePayoutPriorityLink[],
  settlementFilters: BookingSettlementFilters,
  closingFilters: MonthlyTaxClosingFilters,
): FinancePayoutPriorityLink {
  const riskKeyByCode: Partial<Record<AdminMonthlyTaxClosingPreflightBlockerCode, string>> = {
    NET_REVENUE_DELTA: 'reconciliation-deltas',
    PARTNER_DEPOSIT_RECONCILIATION: 'partner-deposit-reconciliation',
    PAYOUT_BANK_OUTFLOW_RECONCILIATION: 'payout-bank-outflow-reconciliation',
    PAYOUT_RETURN_INFLOW_RECONCILIATION: 'payout-return-inflow-reconciliation',
    PAYMENT_FEE_EVIDENCE: 'payment-fee-review-flags',
    POSTED_JOURNAL_DELTA: 'journal-reconciliation-issues',
    RECONCILIATION_DELTA: 'reconciliation-deltas',
  };
  const riskLink = riskLinks.find((link) => link.key === riskKeyByCode[code]);
  if (riskLink) {
    return riskLink;
  }

  if (code === 'NEGATIVE_WITHHOLDING') {
    return {
      amount: summary.partnerWithholdingTotal,
      amountSuffix: null,
      count: null,
      currency: summary.currency,
      helper: '',
      href: partnerWithholdingTaxHref({
        page: 1,
        period: closingFilters.period,
        take: settlementFilters.take,
      }),
      key: 'negative-withholding',
      label: 'Partner withholding balance',
      signal: 'Reversal review',
    };
  }
  if (code === 'REMITTANCE_EVIDENCE') {
    return {
      amount: summary.partnerWithholdingTotal,
      amountSuffix: null,
      count: null,
      currency: summary.currency,
      helper: '',
      href: monthlyTaxClosingHref({ ...closingFilters, page: 1 }),
      key: 'remittance-evidence',
      label: 'Remittance evidence',
      signal: 'Final close evidence',
    };
  }

  return {
    amount: summary.partnerWithholdingTotal,
    amountSuffix: null,
    count: null,
    currency: summary.currency,
    helper: '',
    href: `/finance-tax/general-ledger?${new URLSearchParams({
      q: `withholding-remittance:${closingFilters.period}`,
      range: 'all',
    }).toString()}`,
    key: 'remittance-journal',
    label: 'Withholding remittance journal',
    signal: code === 'REMITTANCE_AMOUNT_MISMATCH' ? 'Amount mismatch' : 'Journal required',
  };
}

export function buildMonthlyTaxClosingRemittanceEvidenceState(
  input: Pick<AdminMonthlyTaxClosingSummary, 'paidAt' | 'remittanceMetadata' | 'status'>,
): MonthlyTaxClosingRemittanceEvidenceState {
  const metadata = input.remittanceMetadata ?? null;
  const paidAt = metadata?.paidAt ?? input.paidAt ?? null;
  const transferRef = metadata?.transferRef ?? null;
  const evidenceHref = metadata?.evidenceUrl ?? null;

  if (!paidAt) {
    return {
      detail: 'Tax declaration is not paid yet.',
      evidenceHref: null,
      label: 'Pending remittance',
      tone: 'neutral',
    };
  }
  if (!transferRef) {
    return {
      detail: 'Missing transfer reference',
      evidenceHref,
      label: 'Evidence incomplete',
      tone: 'warning',
    };
  }
  if (!evidenceHref) {
    return {
      detail: 'Missing evidence URL',
      evidenceHref: null,
      label: 'Evidence incomplete',
      tone: 'warning',
    };
  }

  return {
    detail: `${transferRef} · ${metadata?.channel ?? 'Manual remittance'}`,
    evidenceHref,
    label: 'Evidence retained',
    tone: 'success',
  };
}

export function monthlyTaxClosingNextStatusOptions(
  status: AdminMonthlyTaxClosingStatus,
): MonthlyTaxClosingStatusOption[] {
  switch (status) {
    case 'DRAFT':
      return [
        {
          value: 'REVIEWED',
          label: 'Reviewed',
          helper: 'Snapshot the monthly totals after finance review.',
        },
      ];
    case 'REVIEWED':
      return [
        {
          value: 'DECLARED',
          label: 'Declared',
          helper: 'Mark the period as submitted to the tax portal.',
        },
      ];
    case 'DECLARED':
      return [
        {
          value: 'PAID',
          label: 'Paid',
          helper: 'Record that withholding tax and company VAT payment were completed.',
        },
      ];
    case 'PAID':
      return [
        {
          value: 'CLOSED',
          label: 'Closed',
          helper: 'Lock this monthly period after payment evidence is checked.',
        },
      ];
    default:
      return [];
  }
}

export function buildPlatformVatMetrics(summary: AdminPlatformVatSummary) {
  return [
    {
      label: 'Settlements',
      value: summary.settlementCount,
      helper: 'Settlement records included in this platform VAT period.',
    },
    {
      label: 'Reversals',
      value: summary.reversalCount,
      helper: 'Closed-period reversal entries reducing VAT and revenue in this period.',
    },
    {
      label: 'Platform fee gross',
      value: formatMoney(summary.platformFeeGrossTotal, summary.currency),
      helper: 'HANDS platform fee including company output VAT.',
    },
    {
      label: 'Company output VAT',
      value: formatMoney(summary.companyOutputVatTotal, summary.currency),
      helper: 'VAT payable from HANDS platform fee gross.',
    },
    {
      label: 'Net revenue',
      value: formatMoney(summary.platformFeeNetRevenueTotal, summary.currency),
      helper: 'Company revenue after removing output VAT.',
    },
    {
      label: 'Formula delta',
      value: formatMoney(summary.netRevenueDelta, summary.currency),
      helper: 'Platform fee gross minus output VAT and net revenue.',
    },
  ];
}

export function buildPaymentFeeMetrics(summary: AdminPaymentFeeSummary) {
  return [
    {
      label: 'Settlements',
      value: summary.settlementCount,
      helper: 'Posted settlement records included in this payment fee period.',
    },
    {
      label: 'Reversals',
      value: summary.reversalCount,
      helper: 'Closed-period reversal entries netted into this payment fee period.',
    },
    {
      label: 'Customer paid',
      value: formatMoney(summary.customerPaymentAmountTotal, summary.currency),
      helper: 'Customer payment volume used to audit payment fee cost.',
    },
    {
      label: 'Payment fees',
      value: formatMoney(summary.paymentProcessingFeeTotal, summary.currency),
      helper: 'Processing fees. This is not Partner withholding tax or company output VAT.',
    },
  ];
}

export function emptyPlatformVatSummary(period = normalizeTaxPeriod('')): AdminPlatformVatSummary {
  return {
    period,
    currency: 'VND',
    settlementCount: 0,
    reversalCount: 0,
    manualReviewCount: 0,
    platformFeeGrossTotal: 0,
    platformFeeNetRevenueTotal: 0,
    companyOutputVatTotal: 0,
    netRevenueDelta: 0,
    rateBreakdown: [],
  };
}

export function buildMonthlyTaxCloseoutCommandState(summary: AdminMonthlyTaxClosingSummary): {
  readonly detail: string;
  readonly scope: string;
  readonly tone: 'danger' | 'neutral' | 'success' | 'warning';
  readonly value: string;
} {
  const transferRef = summary.remittanceMetadata?.transferRef;

  if (summary.status === 'CLOSED') {
    return {
      detail: transferRef
        ? `Closed with tax payment evidence ${transferRef}.`
        : 'The monthly tax period is closed with payment evidence retained.',
      scope: 'Records',
      tone: 'success',
      value: 'Closed',
    };
  }
  if (summary.status === 'PAID') {
    return {
      detail: transferRef
        ? `Payment evidence ${transferRef} is recorded. Close the monthly period after final review.`
        : 'Tax payment is recorded. Close the monthly period after final review.',
      scope: 'Needs action',
      tone: 'warning',
      value: 'Close period',
    };
  }
  if (summary.status === 'DECLARED') {
    return {
      detail: 'The declaration is submitted. Record remittance and its evidence next.',
      scope: 'Needs action',
      tone: 'warning',
      value: 'Record payment',
    };
  }
  if (summary.status === 'REVIEWED') {
    return {
      detail: 'The totals are reviewed. Submit the declaration before recording payment.',
      scope: 'Needs action',
      tone: 'warning',
      value: 'Declare',
    };
  }
  if (summary.status === 'REVERSED') {
    return {
      detail: 'The closing was reversed. Review reversal evidence before starting closeout again.',
      scope: 'Needs action',
      tone: 'danger',
      value: 'Review reversal',
    };
  }
  return {
    detail: 'Review the tax registers and booking settlement evidence before declaration.',
    scope: 'Needs action',
    tone: summary.companyOutputVatTotal + summary.partnerWithholdingTotal > 0 ? 'warning' : 'neutral',
    value:
      summary.companyOutputVatTotal + summary.partnerWithholdingTotal > 0 ? 'Review totals' : 'No tax due',
  };
}

export function emptyPaymentFeeSummary(period = normalizeTaxPeriod('')): AdminPaymentFeeSummary {
  return {
    period,
    currency: 'VND',
    settlementCount: 0,
    reversalCount: 0,
    customerPaymentAmountTotal: 0,
    paymentProcessingFeeTotal: 0,
    byPaymentMethod: [],
    byPayer: [],
    byTreatment: [],
    policyReadiness: {
      activePolicy: null,
      configuredMethods: [],
      missingMethods: ['MOMO', 'VNPAY', 'CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'],
      status: 'MISSING_ACTIVE_POLICY',
    },
    remediationPreview: {
      status: 'BLOCKED',
      policyVersionId: null,
      blockers: [
        {
          code: 'ACTIVE_POLICY_REQUIRED',
          message:
            'A payment fee policy covering the full selected period is required before historical fee differences can be previewed.',
        },
      ],
      evidenceReviewCount: 0,
      evidenceCustomerPaymentAmountTotal: 0,
      recordedFeeTotal: 0,
      expectedFeeTotal: null,
      delta: null,
    },
  };
}

export function buildPlatformVatSummaryCsvHref(summary: AdminPlatformVatSummary) {
  return buildCsvDataHref(buildPlatformVatSummaryCsvRows(summary), PLATFORM_VAT_CSV_COLUMNS);
}

export function buildPlatformVatSummaryCsvContent(summary: AdminPlatformVatSummary) {
  return buildCsvContent(buildPlatformVatSummaryCsvRows(summary), PLATFORM_VAT_CSV_COLUMNS);
}

function buildPlatformVatSummaryCsvRows(summary: AdminPlatformVatSummary) {
  return [
    {
      section: 'summary',
      period: summary.period,
      currency: summary.currency,
      bucket: '',
      rate_bps: '',
      settlement_count: summary.settlementCount,
      reversal_count: summary.reversalCount,
      platform_fee_gross_total: summary.platformFeeGrossTotal,
      platform_fee_net_revenue_total: summary.platformFeeNetRevenueTotal,
      company_output_vat_total: summary.companyOutputVatTotal,
      net_revenue_delta: summary.netRevenueDelta,
    },
    ...summary.rateBreakdown.map((row) => ({
      section: 'rate_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.category,
      rate_bps: row.platformVatRateBps,
      settlement_count: row.settlementCount,
      reversal_count: row.reversalCount,
      platform_fee_gross_total: row.platformFeeGrossTotal,
      platform_fee_net_revenue_total: row.platformFeeNetRevenueTotal,
      company_output_vat_total: row.companyOutputVatTotal,
      net_revenue_delta: '',
    })),
  ];
}

export function buildPlatformVatExportHref(filters: MonthlyTaxClosingFilters) {
  return `/api/admin/finance-tax/platform-vat/export?period=${encodeURIComponent(filters.period)}`;
}

export function buildPaymentFeeSummaryCsvHref(summary: AdminPaymentFeeSummary) {
  return buildCsvDataHref(buildPaymentFeeSummaryCsvRows(summary), PAYMENT_FEE_CSV_COLUMNS);
}

export function buildPaymentFeeSummaryCsvContent(summary: AdminPaymentFeeSummary) {
  return buildCsvContent(buildPaymentFeeSummaryCsvRows(summary), PAYMENT_FEE_CSV_COLUMNS);
}

function buildPaymentFeeSummaryCsvRows(summary: AdminPaymentFeeSummary) {
  return [
    {
      section: 'summary',
      period: summary.period,
      currency: summary.currency,
      bucket: '',
      settlement_count: summary.settlementCount,
      reversal_count: summary.reversalCount,
      customer_payment_amount_total: summary.customerPaymentAmountTotal,
      payment_processing_fee_total: summary.paymentProcessingFeeTotal,
      evidence_review_count: summary.remediationPreview.evidenceReviewCount,
      evidence_customer_payment_amount_total: summary.remediationPreview.evidenceCustomerPaymentAmountTotal,
      evidence_recorded_fee_total: summary.remediationPreview.recordedFeeTotal,
      remediation_expected_fee_total: summary.remediationPreview.expectedFeeTotal ?? '',
      remediation_delta: summary.remediationPreview.delta ?? '',
    },
    ...summary.byPaymentMethod.map((row) => ({
      section: 'method_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentMethod,
      settlement_count: row.settlementCount,
      reversal_count: row.reversalCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
      evidence_review_count: row.evidenceReviewCount,
      evidence_customer_payment_amount_total: row.evidenceCustomerPaymentAmountTotal,
      evidence_recorded_fee_total: row.evidenceRecordedFeeTotal,
      remediation_expected_fee_total: row.remediationExpectedFeeTotal ?? '',
      remediation_delta: row.remediationDelta ?? '',
    })),
    ...summary.byPayer.map((row) => ({
      section: 'payer_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentFeePayer,
      settlement_count: row.settlementCount,
      reversal_count: row.reversalCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
      evidence_review_count: '',
      evidence_customer_payment_amount_total: '',
      evidence_recorded_fee_total: '',
      remediation_expected_fee_total: '',
      remediation_delta: '',
    })),
    ...summary.byTreatment.map((row) => ({
      section: 'treatment_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentFeeTreatment,
      settlement_count: row.settlementCount,
      reversal_count: row.reversalCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
      evidence_review_count: '',
      evidence_customer_payment_amount_total: '',
      evidence_recorded_fee_total: '',
      remediation_expected_fee_total: '',
      remediation_delta: '',
    })),
  ];
}

export function buildPaymentFeeExportHref(filters: MonthlyTaxClosingFilters) {
  return `/api/admin/finance-tax/payment-fees/export?period=${encodeURIComponent(filters.period)}`;
}

export function buildMonthlyTaxClosingSummaryCsvHref(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvDataHref(
    buildMonthlyTaxClosingSummaryCsvRows(summary),
    MONTHLY_TAX_CLOSING_SUMMARY_CSV_COLUMNS,
  );
}

export function buildMonthlyTaxClosingSummaryCsvContent(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvContent(
    buildMonthlyTaxClosingSummaryCsvRows(summary),
    MONTHLY_TAX_CLOSING_SUMMARY_CSV_COLUMNS,
  );
}

function buildMonthlyTaxClosingSummaryCsvRows(summary: AdminMonthlyTaxClosingSummary) {
  return [
    {
      period: summary.period,
      currency: summary.currency,
      status: summary.status,
      settlement_count: summary.settlementCount,
      reversal_count: summary.reversalCount ?? 0,
      customer_payment_amount_total: summary.customerPaymentAmountTotal,
      partner_payout_total: summary.partnerPayoutTotal,
      platform_fee_gross_total: summary.platformFeeGrossTotal,
      platform_fee_net_revenue_total: summary.platformFeeNetRevenueTotal,
      company_output_vat_total: summary.companyOutputVatTotal,
      partner_vat_withheld_total: summary.partnerVatWithheldTotal,
      partner_pit_withheld_total: summary.partnerPitWithheldTotal,
      partner_withholding_total: summary.partnerWithholdingTotal,
      payment_processing_fee_total: summary.paymentProcessingFeeTotal,
      payment_fee_review_flag_count: summary.paymentFeeReviewFlagCount,
      partner_deposit_reconciliation_open_count: summary.partnerDepositReconciliationOpenCount,
      partner_deposit_reconciliation_open_amount: summary.partnerDepositReconciliationOpenAmount,
      payout_bank_outflow_reconciliation_open_count: summary.payoutBankOutflowReconciliationOpenCount,
      payout_bank_outflow_reconciliation_open_amount: summary.payoutBankOutflowReconciliationOpenAmount,
      payout_return_inflow_reconciliation_open_count: summary.payoutReturnInflowReconciliationOpenCount,
      payout_return_inflow_reconciliation_open_amount: summary.payoutReturnInflowReconciliationOpenAmount,
      coupon_settlement_count: summary.couponSettlementCount,
      coupon_reversal_count: summary.couponReversalCount ?? 0,
      coupon_discount_amount_total: summary.couponDiscountAmountTotal,
      company_coupon_expense_total: summary.companyCouponExpenseTotal,
      partner_funded_coupon_amount_total: summary.partnerFundedCouponAmountTotal,
      platform_fee_discount_amount_total: summary.platformFeeDiscountAmountTotal,
      coupon_review_flag_count: summary.couponReviewFlagCount,
      cash_debt_total: summary.cashDebtTotal,
      non_cash_partner_payout_total: summary.nonCashPartnerPayoutTotal,
      partner_count_with_revenue: summary.partnerCountWithRevenue,
      open_tax_count: summary.openTaxCount,
      paid_tax_count: summary.paidTaxCount,
      reconciliation_delta: summary.reconciliationDelta,
      net_revenue_delta: summary.netRevenueDelta,
    },
  ];
}

export function buildPartnerWithholdingTaxRowsCsvHref(rows: readonly AdminPartnerWithholdingTaxRow[]) {
  return buildCsvDataHref(
    buildPartnerWithholdingTaxRowsCsvRows(rows),
    PARTNER_WITHHOLDING_TAX_ROWS_CSV_COLUMNS,
  );
}

export function buildPartnerWithholdingTaxRowsCsvContent(rows: readonly AdminPartnerWithholdingTaxRow[]) {
  return buildCsvContent(
    buildPartnerWithholdingTaxRowsCsvRows(rows),
    PARTNER_WITHHOLDING_TAX_ROWS_CSV_COLUMNS,
  );
}

function buildPartnerWithholdingTaxRowsCsvRows(rows: readonly AdminPartnerWithholdingTaxRow[]) {
  return rows.map((row) => ({
    provider_profile_id: row.providerProfileId,
    period: row.period,
    currency: row.currency,
    partner_name: row.partnerName,
    partner_phone: row.partnerPhone ?? '',
    completed_booking_count: row.completedBookingCount,
    posted_settlement_count: row.postedSettlementCount ?? row.completedBookingCount,
    reversal_count: row.reversalCount ?? 0,
    gross_service_revenue: row.grossServiceRevenue,
    partner_payout_total: row.partnerPayoutTotal,
    partner_vat_withheld_total: row.partnerVatWithheldTotal,
    partner_pit_withheld_total: row.partnerPitWithheldTotal,
    total_partner_tax_withheld: row.totalPartnerTaxWithheld,
  }));
}

export function buildPartnerWithholdingTaxExportHref(filters: PartnerWithholdingTaxFilters) {
  const params = new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  });
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  return `/api/admin/finance-tax/partner-withholding-tax/export?${params.toString()}`;
}

export function buildBookingSettlementSnapshotRowsCsvHref(rows: readonly AdminBookingSettlementSnapshot[]) {
  return buildCsvDataHref(
    buildBookingSettlementSnapshotRowsCsvRows(rows),
    BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS,
  );
}

export function buildBookingSettlementSnapshotRowsCsvContent(
  rows: readonly AdminBookingSettlementSnapshot[],
  context?: {
    readonly activeFilters: string;
    readonly generatedAt: string;
    readonly generatedBy: string;
    readonly sort: string;
    readonly timezone: string;
    readonly totalRows: number;
  },
) {
  return buildCsvContent(
    buildBookingSettlementSnapshotRowsCsvRows(rows, context),
    BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS,
  );
}

const ACCOUNTING_JOURNAL_BATCH_CSV_COLUMNS = [
  'generated_at',
  'timezone',
  'generated_by',
  'active_filters',
  'sort',
  'total_rows',
  'journal_batch_id',
  'source_key',
  'source_type',
  'source_id',
  'booking_id',
  'payment_id',
  'monthly_period',
  'posted_at',
  'status',
  'currency',
  'header_debit',
  'header_credit',
  'entry_count',
  'entry_debit',
  'entry_credit',
  'formula_delta',
  'discrepancy_amount',
  'integrity_state',
  'blocker_codes',
  'integrity_checked_at',
] as const;

export function buildAccountingJournalBatchRowsCsvContent(
  rows: readonly AdminAccountingJournalBatch[],
  context: {
    readonly activeFilters: string;
    readonly generatedAt: string;
    readonly generatedBy: string;
    readonly sort: string;
    readonly timezone: string;
    readonly totalRows: number;
  },
) {
  return buildCsvContent(
    rows.map((row) => ({
      generated_at: context.generatedAt,
      timezone: context.timezone,
      generated_by: context.generatedBy,
      active_filters: context.activeFilters,
      sort: context.sort,
      total_rows: context.totalRows,
      journal_batch_id: row.id,
      source_key: row.sourceKey,
      source_type: row.sourceType,
      source_id: row.sourceId,
      booking_id: row.bookingId ?? '',
      payment_id: row.paymentId ?? '',
      monthly_period: row.monthlyPeriod ?? '',
      posted_at: row.postedAt,
      status: row.status,
      currency: row.currency,
      header_debit: row.totalDebit,
      header_credit: row.totalCredit,
      entry_count: row.integrity?.entryCount ?? '',
      entry_debit: row.integrity?.entryDebit ?? '',
      entry_credit: row.integrity?.entryCredit ?? '',
      formula_delta: row.integrity?.formulaDelta ?? '',
      discrepancy_amount: row.integrity?.discrepancyAmount ?? '',
      integrity_state: row.integrity?.state ?? 'UNKNOWN',
      blocker_codes: row.integrity?.blockerCodes.join('|') ?? 'INTEGRITY_UNAVAILABLE',
      integrity_checked_at: row.integrity?.checkedAt ?? '',
    })),
    [...ACCOUNTING_JOURNAL_BATCH_CSV_COLUMNS],
  );
}

function buildBookingSettlementSnapshotRowsCsvRows(
  rows: readonly AdminBookingSettlementSnapshot[],
  context?: {
    readonly activeFilters: string;
    readonly generatedAt: string;
    readonly generatedBy: string;
    readonly sort: string;
    readonly timezone: string;
    readonly totalRows: number;
  },
) {
  return rows.map((row) => {
    const health = row.settlementAuditHealth as AdminBookingSettlementSnapshot['settlementAuditHealth'] | undefined;
    const metadata = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : null;
    const companyCouponExpense = health?.allocation.companyCouponExpense ?? finiteCsvNumber(metadata?.companyCouponExpense);
    return {
      generated_at: context?.generatedAt ?? '',
      timezone: context?.timezone ?? '',
      generated_by: context?.generatedBy ?? '',
      active_filters: context?.activeFilters ?? '',
      sort: context?.sort ?? '',
      total_rows: context?.totalRows ?? rows.length,
      snapshot_id: row.id,
      booking_id: row.bookingId,
      payment_id: row.paymentId ?? '',
      monthly_period: row.monthlyPeriod,
      posted_at: row.postedAt,
      closed_at: row.closedAt ?? row.booking?.closedAt ?? '',
      reversed_at: health?.evidence.reversal.reversedAt ?? '',
      payment_method: row.paymentMethod,
      currency: row.currency,
      customer_profile_id: row.customerProfileId,
      customer_name: row.customerProfile?.user?.fullName ?? '',
      provider_profile_id: row.providerProfileId,
      partner_name: row.providerProfile?.displayName ?? row.providerProfile?.user?.fullName ?? '',
      customer_payment_amount: row.customerPaymentAmount,
      company_coupon_expense: companyCouponExpense,
      partner_payout_amount: row.partnerPayoutAmount,
      partner_taxable_revenue: row.partnerTaxableRevenue,
      partner_vat_withheld: row.partnerVatAmount,
      partner_pit_withheld: row.partnerPitAmount,
      total_partner_tax_withheld: row.partnerWithholdingTotal,
      payment_processing_fee: row.paymentProcessingFee,
      payment_fee_policy_version_id: row.paymentFeePolicyVersionId ?? '',
      payment_fee_evidence_state: health?.checks.paymentFeePolicy ?? 'UNAVAILABLE',
      platform_fee_gross: row.platformFeeGross,
      platform_fee_net_revenue: row.platformFeeNetRevenue,
      company_output_vat: row.companyOutputVat,
      settlement_status: row.settlementStatus,
      tax_status: row.taxStatus,
      booking_status: row.booking?.status ?? '',
      allocation_delta: health?.allocation.delta ?? '',
      allocation_formula_version: health?.formulaVersion ?? 'UNAVAILABLE',
      canonical_journal_ids: health?.evidence.canonicalJournal.ids.join('|') ?? '',
      canonical_journal_state: health?.checks.canonicalJournal ?? 'UNAVAILABLE',
      canonical_clearing_ids: health?.evidence.canonicalClearing.ids.join('|') ?? '',
      canonical_clearing_state: health?.checks.canonicalClearing ?? 'UNAVAILABLE',
      bank_match_state: health?.checks.bankMatch ?? 'UNAVAILABLE',
      bank_matched_amount: health?.evidence.canonicalClearing.matchedAmount ?? '',
      bank_unmatched_amount: health?.evidence.canonicalClearing.unmatchedAmount ?? '',
      reversal_lifecycle: health?.evidence.reversal.lifecycle ?? 'UNAVAILABLE',
      reversal_state: health?.checks.reversal ?? 'UNAVAILABLE',
      reversal_entry_ids: health?.evidence.reversal.ids.join('|') ?? '',
      reversal_journal_count: health?.evidence.reversal.journalCount ?? '',
      reversal_clearing_count: health?.evidence.reversal.clearingCount ?? '',
      reversal_reason: health?.evidence.reversal.reason ?? row.reversalReason ?? '',
      tax_evidence_state: health?.checks.taxPeriod ?? 'UNAVAILABLE',
      coupon_evidence_state: health?.checks.couponPolicy ?? 'UNAVAILABLE',
      audit_state: health?.state ?? 'UNAVAILABLE',
      blocker_codes: health?.blockers.map((blocker) => blocker.code).join('|') ?? '',
      audit_checked_at: health?.checkedAt ?? '',
    };
  });
}

function finiteCsvNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : '';
}

export function buildBookingSettlementAuditExportHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    review: filters.review,
  });
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementPaymentMethod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  appendBookingSettlementAuditFacets(params, filters);
  return `/api/admin/finance-tax/booking-settlement-audit/export?${params.toString()}`;
}

export function buildCouponFinanceExportHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
    review: filters.review,
    take: String(filters.take),
  });
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  appendBookingSettlementPeriod(params, filters);
  appendBookingSettlementQueryAndSort(params, filters);
  if (filters.returnTo) params.set('returnTo', filters.returnTo);
  return `/api/admin/finance-tax/coupon-finance/export?${params.toString()}`;
}

export function buildMonthlyTaxClosingAccountingJournalCsvHref(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvDataHref(
    buildMonthlyTaxClosingAccountingJournalCsvRows(summary),
    ACCOUNTING_JOURNAL_CSV_COLUMNS,
  );
}

export function buildMonthlyTaxClosingAccountingJournalCsvContent(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvContent(
    buildMonthlyTaxClosingAccountingJournalCsvRows(summary),
    ACCOUNTING_JOURNAL_CSV_COLUMNS,
  );
}

function buildMonthlyTaxClosingAccountingJournalCsvRows(summary: AdminMonthlyTaxClosingSummary) {
  return [
    {
      entry: 'customer_payment_clearing',
      period: summary.period,
      currency: summary.currency,
      direction: 'DEBIT',
      account: 'Booking payment clearing / payment receivable',
      amount: summary.customerPaymentAmountTotal,
      memo: 'Customer payment amount is not company revenue.',
    },
    {
      entry: 'partner_wallet_liability',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Partner wallet liability',
      amount: summary.nonCashPartnerPayoutTotal,
      memo: 'Non-cash partner payout liability credited after service completion.',
    },
    {
      entry: 'partner_vat_pit_payable',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Partner VAT/PIT payable',
      amount: summary.partnerWithholdingTotal,
      memo: 'Partner VAT/PIT is withholding tax collected and remitted on behalf of partners.',
    },
    {
      entry: 'platform_fee_net_revenue',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Platform fee net revenue',
      amount: summary.platformFeeNetRevenueTotal,
      memo: 'Company revenue is platform fee net of company output VAT.',
    },
    {
      entry: 'company_output_vat_payable',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Company output VAT payable',
      amount: summary.companyOutputVatTotal,
      memo: 'Company output VAT is VAT payable, not company net revenue.',
    },
    {
      entry: 'payment_processing_fee_clearing',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Payment processing fee clearing',
      amount: summary.paymentProcessingFeeTotal,
      memo: 'Payment processing fee is not tax and must be tracked separately.',
    },
    {
      entry: 'customer_coupon_marketing_expense',
      period: summary.period,
      currency: summary.currency,
      direction: 'DEBIT',
      account: 'Customer coupon marketing expense',
      amount: summary.companyCouponExpenseTotal,
      memo: 'Company-funded coupons are marketing expense, not reduced platform fee revenue or output VAT.',
    },
    {
      entry: 'coupon_discount_clearing',
      period: summary.period,
      currency: summary.currency,
      direction: 'CREDIT',
      account: 'Coupon discount clearing',
      amount: summary.companyCouponExpenseTotal,
      memo: 'Offset for company-funded coupon discounts applied to completed booking settlements.',
    },
    {
      entry: 'partner_receivable_cash_debt',
      period: summary.period,
      currency: summary.currency,
      direction: 'DEBIT',
      account: 'Partner receivable / negative wallet',
      amount: summary.cashDebtTotal,
      memo: 'Cash bookings create partner receivable when wallet is insufficient. Closed periods require reversal entries, not direct edits.',
    },
  ];
}

export function buildMonthlyTaxClosingRowsCsvHref(rows: readonly AdminMonthlyTaxClosing[]) {
  return buildCsvDataHref(buildMonthlyTaxClosingRowsCsvRows(rows), MONTHLY_TAX_CLOSING_ROWS_CSV_COLUMNS);
}

export function buildMonthlyTaxClosingRowsCsvContent(rows: readonly AdminMonthlyTaxClosing[]) {
  return buildCsvContent(buildMonthlyTaxClosingRowsCsvRows(rows), MONTHLY_TAX_CLOSING_ROWS_CSV_COLUMNS);
}

function buildMonthlyTaxClosingRowsCsvRows(rows: readonly AdminMonthlyTaxClosing[]) {
  return rows.map((row) => ({
    id: row.id,
    period: row.period,
    currency: row.currency,
    status: row.status,
    settlement_count: row.settlementCount,
    platform_fee_gross_total: row.platformFeeGrossTotal,
    platform_fee_net_revenue_total: row.platformFeeNetRevenueTotal,
    company_output_vat_total: row.companyOutputVatTotal,
    partner_vat_withheld_total: row.partnerVatWithheldTotal,
    partner_pit_withheld_total: row.partnerPitWithheldTotal,
    partner_withholding_total: row.partnerWithholdingTotal,
    payment_processing_fee_total: row.paymentProcessingFeeTotal,
    cash_debt_total: row.cashDebtTotal,
    non_cash_partner_payout_total: row.nonCashPartnerPayoutTotal,
    declared_at: row.declaredAt ?? '',
    paid_at: row.paidAt ?? '',
    closed_at: row.closedAt ?? '',
    notes: row.notes ?? '',
  }));
}

export function buildMonthlyTaxClosingExportHref(
  filters: MonthlyTaxClosingFilters,
  kind: MonthlyTaxClosingExportKind,
) {
  const params = new URLSearchParams({
    kind,
    period: filters.period,
    take: String(filters.take),
  });
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
  return `/api/admin/finance-tax/monthly-tax-closing/export?${params.toString()}`;
}

const PLATFORM_VAT_CSV_COLUMNS = [
  'section',
  'period',
  'currency',
  'bucket',
  'rate_bps',
  'settlement_count',
  'reversal_count',
  'platform_fee_gross_total',
  'platform_fee_net_revenue_total',
  'company_output_vat_total',
  'net_revenue_delta',
];

const PAYMENT_FEE_CSV_COLUMNS = [
  'section',
  'period',
  'currency',
  'bucket',
  'settlement_count',
  'reversal_count',
  'customer_payment_amount_total',
  'payment_processing_fee_total',
  'evidence_review_count',
  'evidence_customer_payment_amount_total',
  'evidence_recorded_fee_total',
  'remediation_expected_fee_total',
  'remediation_delta',
];

const PARTNER_WITHHOLDING_TAX_ROWS_CSV_COLUMNS = [
  'provider_profile_id',
  'period',
  'currency',
  'partner_name',
  'partner_phone',
  'completed_booking_count',
  'posted_settlement_count',
  'reversal_count',
  'gross_service_revenue',
  'partner_payout_total',
  'partner_vat_withheld_total',
  'partner_pit_withheld_total',
  'total_partner_tax_withheld',
];

const BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS = [
  'generated_at',
  'timezone',
  'generated_by',
  'active_filters',
  'sort',
  'total_rows',
  'snapshot_id',
  'booking_id',
  'payment_id',
  'monthly_period',
  'posted_at',
  'closed_at',
  'reversed_at',
  'payment_method',
  'currency',
  'customer_profile_id',
  'customer_name',
  'provider_profile_id',
  'partner_name',
  'customer_payment_amount',
  'company_coupon_expense',
  'partner_payout_amount',
  'partner_taxable_revenue',
  'partner_vat_withheld',
  'partner_pit_withheld',
  'total_partner_tax_withheld',
  'payment_processing_fee',
  'payment_fee_policy_version_id',
  'payment_fee_evidence_state',
  'platform_fee_gross',
  'platform_fee_net_revenue',
  'company_output_vat',
  'settlement_status',
  'tax_status',
  'booking_status',
  'allocation_delta',
  'allocation_formula_version',
  'canonical_journal_ids',
  'canonical_journal_state',
  'canonical_clearing_ids',
  'canonical_clearing_state',
  'bank_match_state',
  'bank_matched_amount',
  'bank_unmatched_amount',
  'reversal_lifecycle',
  'reversal_state',
  'reversal_entry_ids',
  'reversal_journal_count',
  'reversal_clearing_count',
  'reversal_reason',
  'tax_evidence_state',
  'coupon_evidence_state',
  'audit_state',
  'blocker_codes',
  'audit_checked_at',
];

const ACCOUNTING_JOURNAL_CSV_COLUMNS = [
  'entry',
  'period',
  'currency',
  'direction',
  'account',
  'amount',
  'memo',
];

const MONTHLY_TAX_CLOSING_SUMMARY_CSV_COLUMNS = [
  'period',
  'currency',
  'status',
  'settlement_count',
  'reversal_count',
  'customer_payment_amount_total',
  'partner_payout_total',
  'platform_fee_gross_total',
  'platform_fee_net_revenue_total',
  'company_output_vat_total',
  'partner_vat_withheld_total',
  'partner_pit_withheld_total',
  'partner_withholding_total',
  'payment_processing_fee_total',
  'payment_fee_review_flag_count',
  'partner_deposit_reconciliation_open_count',
  'partner_deposit_reconciliation_open_amount',
  'payout_bank_outflow_reconciliation_open_count',
  'payout_bank_outflow_reconciliation_open_amount',
  'payout_return_inflow_reconciliation_open_count',
  'payout_return_inflow_reconciliation_open_amount',
  'coupon_settlement_count',
  'coupon_reversal_count',
  'coupon_discount_amount_total',
  'company_coupon_expense_total',
  'partner_funded_coupon_amount_total',
  'platform_fee_discount_amount_total',
  'coupon_review_flag_count',
  'cash_debt_total',
  'non_cash_partner_payout_total',
  'partner_count_with_revenue',
  'open_tax_count',
  'paid_tax_count',
  'reconciliation_delta',
  'net_revenue_delta',
];

const MONTHLY_TAX_CLOSING_ROWS_CSV_COLUMNS = [
  'id',
  'period',
  'currency',
  'status',
  'settlement_count',
  'platform_fee_gross_total',
  'platform_fee_net_revenue_total',
  'company_output_vat_total',
  'partner_vat_withheld_total',
  'partner_pit_withheld_total',
  'partner_withholding_total',
  'payment_processing_fee_total',
  'cash_debt_total',
  'non_cash_partner_payout_total',
  'declared_at',
  'paid_at',
  'closed_at',
  'notes',
];

export function reviewLabel(review: BookingSettlementReview) {
  return (
    BOOKING_SETTLEMENT_AUDIT_REVIEW_LINKS.find((item) => item.review === review)?.label ??
    BOOKING_SETTLEMENT_REVIEW_LINKS.find((item) => item.review === review)?.label ??
    'Needs action'
  );
}

export function financeAccountingReviewLabel(
  review: FinanceAccountingReview,
  links: readonly { readonly label: string; readonly review: FinanceAccountingReview }[],
) {
  if (review === 'terminal') return 'Cleared & reversed history';
  return links.find((item) => item.review === review)?.label ?? 'All';
}

function normalizeBookingSettlementReview(value: string): BookingSettlementReview {
  return BOOKING_SETTLEMENT_REVIEW_VALUES.includes(value as BookingSettlementReview)
    ? (value as BookingSettlementReview)
    : 'open';
}

function bookingSettlementAuditLegacyFilters(value: string): {
  reason?: BookingSettlementAuditReason;
  review: BookingSettlementReview;
  status?: BookingSettlementAuditStatus;
} {
  switch (value) {
    case 'allocation-mismatch':
      return { reason: 'allocation', review: 'integrity-exceptions' };
    case 'journal-evidence':
      return { reason: 'journal', review: 'integrity-exceptions' };
    case 'coupon-evidence':
      return { reason: 'coupon', review: 'integrity-exceptions' };
    case 'unknown':
      return { reason: 'unknown', review: 'integrity-exceptions' };
    case 'clearing-evidence':
      return { reason: 'clearing', review: 'payment-evidence' };
    case 'payment-fee-evidence':
      return { reason: 'fee-policy', review: 'payment-evidence' };
    case 'tax-evidence':
      return { review: 'tax-workflow' };
    case 'tax-open':
      return { review: 'tax-workflow', status: 'open' };
    case 'declared':
      return { review: 'tax-workflow', status: 'declared' };
    case 'paid':
      return { review: 'tax-workflow', status: 'paid' };
    case 'closed':
      return { review: 'tax-workflow', status: 'closed' };
    case 'reversal-incomplete':
      return { reason: 'reversal', review: 'reversals' };
    case 'reversed':
      return { review: 'reversals' };
    case 'open':
    case 'needs-action':
    case '':
      return { review: 'integrity-exceptions' };
    default:
      return { review: normalizeBookingSettlementReview(value) };
  }
}

function normalizeBookingSettlementAuditOwner(value: string): BookingSettlementAuditOwner | undefined {
  return value === 'accounting' || value === 'finance-operations' || value === 'tax-period-close'
    ? value
    : undefined;
}

function normalizeBookingSettlementAuditReason(value: string): BookingSettlementAuditReason | undefined {
  return [
    'allocation',
    'journal',
    'clearing',
    'bank-match',
    'fee-policy',
    'coupon',
    'tax-period',
    'reversal',
    'unknown',
  ].includes(value)
    ? (value as BookingSettlementAuditReason)
    : undefined;
}

function normalizeBookingSettlementAuditStatus(value: string): BookingSettlementAuditStatus | undefined {
  return ['open', 'declared', 'paid', 'closed', 'reversed'].includes(value)
    ? (value as BookingSettlementAuditStatus)
    : undefined;
}

function normalizeBookingSettlementSort(value: string) {
  if (value === 'largest-discrepancy' || value === 'newest') return value;
  return 'oldest' as const;
}

function isSettlementReversalReview(review: BookingSettlementReview) {
  return review === 'reversed' || review === 'cash' || review === 'non-cash';
}

function normalizeFinanceAccountingReview(
  value: string,
  fallback: FinanceAccountingReview,
): FinanceAccountingReview {
  return FINANCE_ACCOUNTING_REVIEW_VALUES.includes(value as FinanceAccountingReview)
    ? (value as FinanceAccountingReview)
    : fallback;
}

function normalizePaymentClearingSort(value: string, review: FinanceAccountingReview) {
  if (value === 'highest-remaining' || value === 'recent') return value;
  if (value === 'oldest') return value;
  return review === 'unresolved' || review === 'open' || review === 'partial'
    ? ('oldest' as const)
    : ('recent' as const);
}

function normalizeFinanceAccountingAssignment(value: string) {
  return value === 'assigned' || value === 'unassigned' ? value : undefined;
}

function normalizeFinanceAccountingSort(value: string) {
  return value === 'oldest' ||
    value === 'newest' ||
    value === 'largest-discrepancy' ||
    value === 'highest-remaining' ||
    value === 'recent'
    ? value
    : undefined;
}

function normalizeAccountingJournalSourceType(value: string) {
  const normalized = value.toUpperCase();
  const supported: readonly AdminAccountingJournalSourceType[] = [
    'BOOKING_SETTLEMENT',
    'BOOKING_SETTLEMENT_REVERSAL',
    'MANUAL_WALLET_ADJUSTMENT',
    'PROVIDER_WITHDRAWAL',
    'PROVIDER_PAYOUT_BATCH',
    'PROVIDER_BANK_DEPOSIT',
    'REFERRAL_REWARD',
    'REFUND',
    'PAYMENT_CALLBACK',
    'BANK_RECONCILIATION_ADJUSTMENT',
    'WITHHOLDING_REMITTANCE',
  ];
  return supported.includes(normalized as AdminAccountingJournalSourceType)
    ? (normalized as AdminAccountingJournalSourceType)
    : undefined;
}

function normalizeFinanceAccountingWorkspace(value: string) {
  return value === 'imports' || value === 'manual' || value === 'operations'
    ? value
    : undefined;
}

export function safeFinanceTaxOverviewReturnTo(value: string | null | undefined) {
  if (!value || value.startsWith('//') || value.includes('\\')) return undefined;
  try {
    if (decodeURIComponent(value).includes('\\')) return undefined;
    const url = new URL(value, 'http://hands.local');
    if (url.origin !== 'http://hands.local' || url.pathname !== '/finance-tax') return undefined;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return undefined;
  }
}

function normalizeBankReconciliationAge(value: string) {
  return value.toLowerCase() === '48h' ? ('48h' as const) : undefined;
}

function normalizePaymentClearingAge(value: string) {
  return value.toLowerCase() === '48h' ? ('48h' as const) : undefined;
}

function normalizeBankTransactionType(value: string) {
  const normalized = value.toUpperCase();
  return normalized === 'INFLOW' || normalized === 'OUTFLOW' ? normalized : undefined;
}

function normalizeBankReconciliationEvidenceSource(
  value: string,
): BankReconciliationEvidenceSource | undefined {
  const normalized = value.toUpperCase().replaceAll('-', '_') as BankReconciliationEvidenceSource;
  return [
    'PAYMENT_CLEARING',
    'PARTNER_DEPOSIT',
    'WITHDRAWAL',
    'PAYOUT',
    'REFUND',
    'OTHER_JOURNAL',
    'UNCLASSIFIED',
  ].includes(normalized)
    ? normalized
    : undefined;
}

function payoutWithdrawalStatusHref(range: AdminDateRange, withdrawalStatus: string) {
  return `/payouts?${new URLSearchParams({ range, withdrawalStatus }).toString()}`;
}

function normalizeTaxPeriod(value: string) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function normalizeOptionalTaxPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) ? value : null;
}

const ADMIN_PAYMENT_METHODS: readonly AdminPaymentMethod[] = [
  'MOMO',
  'VNPAY',
  'CASH',
  'CARD',
  'BANK_TRANSFER',
  'CUSTOMER_WALLET',
  'MANUAL',
];

function normalizeOptionalPaymentMethod(value: string): AdminPaymentMethod | null {
  const normalized = value.toUpperCase() as AdminPaymentMethod;
  return ADMIN_PAYMENT_METHODS.includes(normalized) ? normalized : null;
}

function appendBookingSettlementPeriod(params: URLSearchParams, filters: BookingSettlementFilters) {
  if (filters.period) {
    params.set('period', filters.period);
  }
}

function appendBookingSettlementPaymentMethod(params: URLSearchParams, filters: BookingSettlementFilters) {
  if (filters.paymentMethod) {
    params.set('paymentMethod', filters.paymentMethod);
  }
}

function appendBookingSettlementQueryAndSort(params: URLSearchParams, filters: BookingSettlementFilters) {
  if (filters.q) params.set('q', filters.q);
  if (filters.sort) params.set('sort', filters.sort);
}

function appendBookingSettlementAuditFacets(params: URLSearchParams, filters: BookingSettlementFilters) {
  if (filters.owner) params.set('owner', filters.owner);
  if (filters.reason) params.set('reason', filters.reason);
  if (filters.status) params.set('status', filters.status);
}

function boundedTake(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return TAX_SETTLEMENT_DEFAULT_TAKE;
  }
  return Math.min(parsed, TAX_SETTLEMENT_MAX_TAKE);
}

function readTaxSettlementPage(value: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return Math.min(parsed, 1000);
}

function appendTaxSettlementSkip(
  params: URLSearchParams,
  filters: { readonly page: number; readonly take: number },
) {
  const skip = (filters.page - 1) * filters.take;
  if (skip > 0) {
    params.set('skip', String(skip));
  }
}

function appendTaxSettlementUiPagination(
  params: URLSearchParams,
  filters: { readonly page: number; readonly take: number },
) {
  if (filters.take !== TAX_SETTLEMENT_DEFAULT_TAKE) {
    params.set('take', String(filters.take));
  }
  if (filters.page > 1) {
    params.set('page', String(filters.page));
  }
}

function appendFinanceAccountingAssignment(
  params: URLSearchParams,
  filters: Pick<FinanceAccountingFilters, 'assigneeAdminId' | 'assignment'>,
) {
  if (filters.assignment) {
    params.set('assignment', filters.assignment);
  }
  if (filters.assigneeAdminId) {
    params.set('assigneeAdminId', filters.assigneeAdminId);
  }
}
