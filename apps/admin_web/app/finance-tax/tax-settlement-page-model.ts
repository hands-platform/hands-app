import type {
  AdminAccountingJournalBatchSummary,
  AdminBankReconciliationSummary,
  AdminBookingSettlementReversalEntry,
  AdminBookingSettlementSnapshot,
  AdminBookingSettlementReversalSummary,
  AdminBookingSettlementSnapshotSummary,
  AdminBookingPaymentClearingSummary,
  AdminCouponFinanceSummary,
  AdminPaymentFeeSummary,
  AdminPlatformVatSummary,
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingStatus,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxRow,
  AdminPartnerWithholdingTaxSummary,
  AdminProviderWalletWithdrawalRequestSummary,
} from '../../lib/admin-api';
import type { AdminDateRange } from '../../lib/date-range';
import { buildCsvDataHref } from '../../lib/csv-export';
import { formatMoney, shortId } from '../../lib/admin-format';
import { normalizeDateRange, readSearchParam } from '../../lib/date-range';

export type BookingSettlementReview =
  | 'all'
  | 'open'
  | 'declared'
  | 'paid'
  | 'closed'
  | 'posted'
  | 'reversed'
  | 'cash'
  | 'non-cash';

export type FinanceAccountingReview =
  | 'all'
  | 'draft'
  | 'posted'
  | 'reversed'
  | 'open'
  | 'partial'
  | 'cleared'
  | 'unmatched'
  | 'matched'
  | 'ignored'
  | 'inflow'
  | 'outflow';

export type BookingSettlementFilters = {
  readonly page: number;
  readonly range: AdminDateRange;
  readonly review: BookingSettlementReview;
  readonly take: number;
};

export type FinanceAccountingFilters = {
  readonly page: number;
  readonly range: AdminDateRange;
  readonly review: FinanceAccountingReview;
  readonly take: number;
};

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

export type MonthlyTaxClosingRemittanceEvidenceState = {
  readonly detail: string;
  readonly evidenceHref: string | null;
  readonly label: string;
  readonly tone: 'neutral' | 'success' | 'warning';
};

export type TaxFinanceWorkflowPage =
  | 'overview'
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
  'open',
  'declared',
  'paid',
  'closed',
  'posted',
  'reversed',
  'cash',
  'non-cash',
];
const FINANCE_ACCOUNTING_REVIEW_VALUES: readonly FinanceAccountingReview[] = [
  'all',
  'draft',
  'posted',
  'reversed',
  'open',
  'partial',
  'cleared',
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
  { label: 'Cash', review: 'cash' },
  { label: 'Non-cash', review: 'non-cash' },
  { label: 'All', review: 'all' },
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
  { label: 'Posted', review: 'posted' },
  { label: 'Draft', review: 'draft' },
  { label: 'Reversed', review: 'reversed' },
  { label: 'All', review: 'all' },
];

export const PAYMENT_CLEARING_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: FinanceAccountingReview;
}[] = [
  { label: 'Open', review: 'open' },
  { label: 'Partial', review: 'partial' },
  { label: 'Cleared', review: 'cleared' },
  { label: 'Reversed', review: 'reversed' },
  { label: 'All', review: 'all' },
];

export const BANK_RECONCILIATION_REVIEW_LINKS: readonly {
  readonly label: string;
  readonly review: FinanceAccountingReview;
}[] = [
  { label: 'Unmatched', review: 'unmatched' },
  { label: 'Matched', review: 'matched' },
  { label: 'Partial', review: 'partial' },
  { label: 'Inflow', review: 'inflow' },
  { label: 'Outflow', review: 'outflow' },
  { label: 'All', review: 'all' },
];

export function readBookingSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): BookingSettlementFilters {
  return {
    page: readTaxSettlementPage(readSearchParam(params.page)),
    range: normalizeDateRange(readSearchParam(params.range)),
    review: normalizeBookingSettlementReview(readSearchParam(params.review)),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function readFinanceAccountingFilters(
  params: Record<string, string | string[] | undefined>,
  fallbackReview: FinanceAccountingReview = 'all',
): FinanceAccountingFilters {
  return {
    page: readTaxSettlementPage(readSearchParam(params.page)),
    range: normalizeDateRange(readSearchParam(params.range)),
    review: normalizeFinanceAccountingReview(readSearchParam(params.review), fallbackReview),
    take: boundedTake(readSearchParam(params.take)),
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
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  params.set('take', String(filters.take));
  appendTaxSettlementSkip(params, filters);
  return `/admin/booking-settlement-snapshots?${params.toString()}`;
}

export function buildBookingSettlementSnapshotDetailApiHref(id: string) {
  return `/admin/booking-settlement-snapshots/${encodeURIComponent(id)}`;
}

export function buildBookingSettlementSnapshotSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
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
  return buildFinanceAccountingApiHref('/admin/accounting-journal-batches', filters);
}

export function buildAccountingJournalBatchSummaryApiHref(filters: FinanceAccountingFilters) {
  return buildFinanceAccountingSummaryApiHref('/admin/accounting-journal-batches/summary', filters);
}

export function buildAccountingJournalBatchDetailApiHref(id: string) {
  return `/admin/accounting-journal-batches/${encodeURIComponent(id)}`;
}

export function buildBookingPaymentClearingApiHref(filters: FinanceAccountingFilters) {
  return buildFinanceAccountingApiHref('/admin/booking-payment-clearing', filters);
}

export function buildBookingPaymentClearingSummaryApiHref(filters: FinanceAccountingFilters) {
  return buildFinanceAccountingSummaryApiHref('/admin/booking-payment-clearing/summary', filters);
}

export function buildBookingPaymentClearingDetailApiHref(id: string) {
  return `/admin/booking-payment-clearing/${encodeURIComponent(id)}`;
}

export function buildBankReconciliationApiHref(filters: FinanceAccountingFilters) {
  return buildFinanceAccountingApiHref('/admin/bank-reconciliation', filters);
}

export function buildBankReconciliationSummaryApiHref(filters: FinanceAccountingFilters) {
  return buildFinanceAccountingSummaryApiHref('/admin/bank-reconciliation/summary', filters);
}

export function buildBankReconciliationDetailApiHref(id: string) {
  return `/admin/bank-reconciliation/${encodeURIComponent(id)}`;
}

function buildFinanceAccountingApiHref(basePath: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range, take: String(filters.take) });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendTaxSettlementSkip(params, filters);
  return `${basePath}?${params.toString()}`;
}

function buildFinanceAccountingSummaryApiHref(basePath: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  return `${basePath}?${params.toString()}`;
}

export function buildCouponFinanceSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  return `/admin/booking-settlement-snapshots/coupon-finance-summary?${params.toString()}`;
}

export function buildCouponFinanceApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({
    range: filters.range,
  });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
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
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendTaxSettlementUiPagination(params, filters);
  return `/finance-tax/booking-settlement-audit?${params.toString()}`;
}

export function bookingSettlementAuditDetailHref(id: string) {
  return `/finance-tax/booking-settlement-audit/${encodeURIComponent(id)}`;
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
      href: bookingSettlementReversalHref({
        page: 1,
        range: 'all',
        review: 'reversed',
        take: TAX_SETTLEMENT_DEFAULT_TAKE,
      }),
      label: 'Settlement reversal',
      value: shortId(record.settlementReversalEntryId),
    });
  }

  return links;
}

export function generalLedgerHref(filters: FinanceAccountingFilters) {
  return financeAccountingHref('/finance-tax/general-ledger', filters);
}

export function generalLedgerDetailHref(id: string) {
  return `/finance-tax/general-ledger/${encodeURIComponent(id)}`;
}

export function paymentClearingHref(filters: FinanceAccountingFilters) {
  return financeAccountingHref('/finance-tax/payment-clearing', filters);
}

export function paymentClearingDetailHref(id: string) {
  return `/finance-tax/payment-clearing/${encodeURIComponent(id)}`;
}

export function bankReconciliationHref(filters: FinanceAccountingFilters) {
  return financeAccountingHref('/finance-tax/bank-reconciliation', filters);
}

export function bankReconciliationDetailHref(id: string) {
  return `/finance-tax/bank-reconciliation/${encodeURIComponent(id)}`;
}

function financeAccountingHref(pathname: string, filters: FinanceAccountingFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  appendTaxSettlementUiPagination(params, filters);
  return `${pathname}?${params.toString()}`;
}

export function couponFinanceHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
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
      label: 'General ledger',
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
  const closeoutRiskCount = monthlyClosingSummary.openTaxCount + monthlyClosingSummary.couponReviewFlagCount;
  return [
    {
      key: 'today-needs-action',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: settlementSummary.openTaxCount,
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
      helper: 'Customer payment, settlement posting, refund, payment fee, or coupon clearing rows still open.',
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
    count: 0,
    currency: 'VND',
    customerPaymentAmount: 0,
    partnerPayoutAmount: 0,
    partnerWithholdingTotal: 0,
    platformFeeGross: 0,
    platformFeeNetRevenue: 0,
    companyOutputVat: 0,
    paymentProcessingFee: 0,
    openTaxCount: 0,
    paidTaxCount: 0,
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
    count: 0,
    currency: 'VND',
    postedCount: 0,
    reversedCount: 0,
    totalCredit: 0,
    totalDebit: 0,
  };
}

export function emptyBookingPaymentClearingSummary(): AdminBookingPaymentClearingSummary {
  return {
    amount: 0,
    clearedCount: 0,
    count: 0,
    currency: 'VND',
    openCount: 0,
  };
}

export function emptyBankReconciliationSummary(): AdminBankReconciliationSummary {
  return {
    amount: 0,
    count: 0,
    currency: 'VND',
    matchedCount: 0,
    unmatchedCount: 0,
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
    currency: 'VND',
  };
}

export function emptyMonthlyTaxClosingSummary(
  period = normalizeTaxPeriod(''),
): AdminMonthlyTaxClosingSummary {
  return {
    id: null,
    period,
    currency: 'VND',
    status: 'DRAFT',
    settlementCount: 0,
    customerPaymentAmountTotal: 0,
    partnerPayoutTotal: 0,
    platformFeeGrossTotal: 0,
    platformFeeNetRevenueTotal: 0,
    companyOutputVatTotal: 0,
    partnerVatWithheldTotal: 0,
    partnerPitWithheldTotal: 0,
    partnerWithholdingTotal: 0,
    paymentProcessingFeeTotal: 0,
    couponSettlementCount: 0,
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
    declaredAt: null,
    paidAt: null,
    closedAt: null,
    notes: null,
    remittanceMetadata: null,
  };
}

export function buildMonthlyTaxClosingMetrics(summary: AdminMonthlyTaxClosingSummary) {
  return [
    {
      label: 'Period status',
      value: summary.status,
      helper: 'Current stored closing status, or draft preview when no closing row exists yet.',
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
      helper: 'Customer payment minus payout, withholding, payment fees, and platform fee gross.',
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
  const deltaCount =
    (summary.reconciliationDelta !== 0 ? 1 : 0) + (summary.netRevenueDelta !== 0 ? 1 : 0);
  const deltaAmount = Math.abs(summary.reconciliationDelta) + Math.abs(summary.netRevenueDelta);

  return [
    {
      key: 'open-tax-rows',
      amount: null,
      currency: null,
      amountSuffix: null,
      count: summary.openTaxCount,
      label: 'Open tax rows',
      helper: 'Settlement rows still waiting for declaration, payment, or tax closeout review.',
      href: bookingSettlementAuditHref({ ...settlementFilters, page: 1, review: 'open' }),
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
      href: couponFinanceHref({ ...settlementFilters, page: 1, review: 'open' }),
      signal: 'Coupon review',
    },
    {
      key: 'cash-debt-gate',
      amount: summary.cashDebtTotal,
      currency: summary.currency,
      amountSuffix: null,
      count: null,
      label: 'Cash debt gate',
      helper: 'Partner cash booking debt that can block payout and monthly settlement closeout.',
      href: `/cash-settlements?${new URLSearchParams({ range: settlementFilters.range }).toString()}`,
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

export function buildMonthlyTaxClosingRemittanceEvidenceState(input: Pick<
  AdminMonthlyTaxClosingSummary,
  'paidAt' | 'remittanceMetadata' | 'status'
>): MonthlyTaxClosingRemittanceEvidenceState {
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
      helper: 'Settlement records included in this payment fee period.',
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
    platformFeeGrossTotal: 0,
    platformFeeNetRevenueTotal: 0,
    companyOutputVatTotal: 0,
    netRevenueDelta: 0,
    rateBreakdown: [],
  };
}

export function emptyPaymentFeeSummary(period = normalizeTaxPeriod('')): AdminPaymentFeeSummary {
  return {
    period,
    currency: 'VND',
    settlementCount: 0,
    customerPaymentAmountTotal: 0,
    paymentProcessingFeeTotal: 0,
    byPaymentMethod: [],
    byPayer: [],
    byTreatment: [],
  };
}

export function buildPlatformVatSummaryCsvHref(summary: AdminPlatformVatSummary) {
  return buildCsvDataHref(
    [
      {
        section: 'summary',
        period: summary.period,
        currency: summary.currency,
        bucket: '',
        rate_bps: '',
        settlement_count: summary.settlementCount,
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
        platform_fee_gross_total: row.platformFeeGrossTotal,
        platform_fee_net_revenue_total: row.platformFeeNetRevenueTotal,
        company_output_vat_total: row.companyOutputVatTotal,
        net_revenue_delta: '',
      })),
    ],
    PLATFORM_VAT_CSV_COLUMNS,
  );
}

export function buildPaymentFeeSummaryCsvHref(summary: AdminPaymentFeeSummary) {
  const rows = [
    {
      section: 'summary',
      period: summary.period,
      currency: summary.currency,
      bucket: '',
      settlement_count: summary.settlementCount,
      customer_payment_amount_total: summary.customerPaymentAmountTotal,
      payment_processing_fee_total: summary.paymentProcessingFeeTotal,
    },
    ...summary.byPaymentMethod.map((row) => ({
      section: 'method_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentMethod,
      settlement_count: row.settlementCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
    })),
    ...summary.byPayer.map((row) => ({
      section: 'payer_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentFeePayer,
      settlement_count: row.settlementCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
    })),
    ...summary.byTreatment.map((row) => ({
      section: 'treatment_breakdown',
      period: summary.period,
      currency: summary.currency,
      bucket: row.paymentFeeTreatment,
      settlement_count: row.settlementCount,
      customer_payment_amount_total: row.customerPaymentAmountTotal,
      payment_processing_fee_total: row.paymentProcessingFeeTotal,
    })),
  ];

  return buildCsvDataHref(rows, PAYMENT_FEE_CSV_COLUMNS);
}

export function buildMonthlyTaxClosingSummaryCsvHref(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvDataHref(
    [
      {
        period: summary.period,
        currency: summary.currency,
        status: summary.status,
        settlement_count: summary.settlementCount,
        customer_payment_amount_total: summary.customerPaymentAmountTotal,
        partner_payout_total: summary.partnerPayoutTotal,
        platform_fee_gross_total: summary.platformFeeGrossTotal,
        platform_fee_net_revenue_total: summary.platformFeeNetRevenueTotal,
        company_output_vat_total: summary.companyOutputVatTotal,
        partner_vat_withheld_total: summary.partnerVatWithheldTotal,
        partner_pit_withheld_total: summary.partnerPitWithheldTotal,
        partner_withholding_total: summary.partnerWithholdingTotal,
        payment_processing_fee_total: summary.paymentProcessingFeeTotal,
        coupon_settlement_count: summary.couponSettlementCount,
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
    ],
    MONTHLY_TAX_CLOSING_SUMMARY_CSV_COLUMNS,
  );
}

export function buildPartnerWithholdingTaxRowsCsvHref(rows: readonly AdminPartnerWithholdingTaxRow[]) {
  return buildCsvDataHref(
    rows.map((row) => ({
      provider_profile_id: row.providerProfileId,
      period: row.period,
      currency: row.currency,
      partner_name: row.partnerName,
      partner_phone: row.partnerPhone ?? '',
      completed_booking_count: row.completedBookingCount,
      gross_service_revenue: row.grossServiceRevenue,
      partner_payout_total: row.partnerPayoutTotal,
      partner_vat_withheld_total: row.partnerVatWithheldTotal,
      partner_pit_withheld_total: row.partnerPitWithheldTotal,
      total_partner_tax_withheld: row.totalPartnerTaxWithheld,
    })),
    PARTNER_WITHHOLDING_TAX_ROWS_CSV_COLUMNS,
  );
}

export function buildBookingSettlementSnapshotRowsCsvHref(rows: readonly AdminBookingSettlementSnapshot[]) {
  return buildCsvDataHref(
    rows.map((row) => ({
      snapshot_id: row.id,
      booking_id: row.bookingId,
      monthly_period: row.monthlyPeriod,
      posted_at: row.postedAt,
      closed_at: row.closedAt ?? row.booking?.closedAt ?? '',
      payment_method: row.paymentMethod,
      currency: row.currency,
      customer_profile_id: row.customerProfileId,
      customer_name: row.customerProfile?.user?.fullName ?? '',
      customer_phone: row.customerProfile?.user?.phone ?? '',
      provider_profile_id: row.providerProfileId,
      partner_name: row.providerProfile?.displayName ?? row.providerProfile?.user?.fullName ?? '',
      partner_phone: row.providerProfile?.user?.phone ?? '',
      customer_payment_amount: row.customerPaymentAmount,
      partner_payout_amount: row.partnerPayoutAmount,
      partner_taxable_revenue: row.partnerTaxableRevenue,
      partner_vat_withheld: row.partnerVatAmount,
      partner_pit_withheld: row.partnerPitAmount,
      total_partner_tax_withheld: row.partnerWithholdingTotal,
      payment_processing_fee: row.paymentProcessingFee,
      platform_fee_gross: row.platformFeeGross,
      platform_fee_net_revenue: row.platformFeeNetRevenue,
      company_output_vat: row.companyOutputVat,
      settlement_status: row.settlementStatus,
      tax_status: row.taxStatus,
      booking_status: row.booking?.status ?? '',
    })),
    BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS,
  );
}

export function buildMonthlyTaxClosingAccountingJournalCsvHref(summary: AdminMonthlyTaxClosingSummary) {
  return buildCsvDataHref(
    [
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
    ],
    ACCOUNTING_JOURNAL_CSV_COLUMNS,
  );
}

export function buildMonthlyTaxClosingRowsCsvHref(rows: readonly AdminMonthlyTaxClosing[]) {
  return buildCsvDataHref(
    rows.map((row) => ({
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
    })),
    MONTHLY_TAX_CLOSING_ROWS_CSV_COLUMNS,
  );
}

const PLATFORM_VAT_CSV_COLUMNS = [
  'section',
  'period',
  'currency',
  'bucket',
  'rate_bps',
  'settlement_count',
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
  'customer_payment_amount_total',
  'payment_processing_fee_total',
];

const PARTNER_WITHHOLDING_TAX_ROWS_CSV_COLUMNS = [
  'provider_profile_id',
  'period',
  'currency',
  'partner_name',
  'partner_phone',
  'completed_booking_count',
  'gross_service_revenue',
  'partner_payout_total',
  'partner_vat_withheld_total',
  'partner_pit_withheld_total',
  'total_partner_tax_withheld',
];

const BOOKING_SETTLEMENT_SNAPSHOT_ROWS_CSV_COLUMNS = [
  'snapshot_id',
  'booking_id',
  'monthly_period',
  'posted_at',
  'closed_at',
  'payment_method',
  'currency',
  'customer_profile_id',
  'customer_name',
  'customer_phone',
  'provider_profile_id',
  'partner_name',
  'partner_phone',
  'customer_payment_amount',
  'partner_payout_amount',
  'partner_taxable_revenue',
  'partner_vat_withheld',
  'partner_pit_withheld',
  'total_partner_tax_withheld',
  'payment_processing_fee',
  'platform_fee_gross',
  'platform_fee_net_revenue',
  'company_output_vat',
  'settlement_status',
  'tax_status',
  'booking_status',
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
  'customer_payment_amount_total',
  'partner_payout_total',
  'platform_fee_gross_total',
  'platform_fee_net_revenue_total',
  'company_output_vat_total',
  'partner_vat_withheld_total',
  'partner_pit_withheld_total',
  'partner_withholding_total',
  'payment_processing_fee_total',
  'coupon_settlement_count',
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
  return BOOKING_SETTLEMENT_REVIEW_LINKS.find((item) => item.review === review)?.label ?? 'Needs action';
}

export function financeAccountingReviewLabel(
  review: FinanceAccountingReview,
  links: readonly { readonly label: string; readonly review: FinanceAccountingReview }[],
) {
  return links.find((item) => item.review === review)?.label ?? 'All';
}

function normalizeBookingSettlementReview(value: string): BookingSettlementReview {
  return BOOKING_SETTLEMENT_REVIEW_VALUES.includes(value as BookingSettlementReview)
    ? (value as BookingSettlementReview)
    : 'open';
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
