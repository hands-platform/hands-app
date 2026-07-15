import type {
  AdminBankReconciliationSummary,
  AdminBankReconciliationWithdrawalCandidateSummary,
  AdminBookingPaymentClearingSummary,
  AdminBookingSettlementSnapshotSummary,
  AdminCashSettlementSummary,
  AdminCouponFinanceSummary,
  AdminEarningSummary,
  AdminFinanceOverviewAmountSummary,
  AdminFinanceOverviewReviewSlaSummary,
  AdminFinanceOverviewSummary,
  AdminFinanceOverviewWalletSummary,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxSummary,
  AdminPaymentFeeSummary,
  AdminPaymentSummary,
  AdminPayoutBatchSummary,
  AdminProviderWalletWithdrawalRequestSummary,
  AdminRefundSummary,
} from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { type AdminDateRange, dateRangeLabel, normalizeDateRange } from '../../lib/date-range';
import {
  bankReconciliationHref,
  bookingSettlementAuditHref,
  buildBankReconciliationSummaryApiHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildCouponFinanceSummaryApiHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildPaymentFeeSummaryApiHref,
  buildProviderWalletWithdrawalRequestSummaryApiHref,
  emptyBankReconciliationSummary,
  emptyBookingPaymentClearingSummary,
  emptyBookingSettlementSummary,
  emptyCouponFinanceSummary,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  emptyPaymentFeeSummary,
  emptyProviderWalletWithdrawalRequestSummary,
  generalLedgerHref,
  paymentClearingHref,
  type BookingSettlementFilters,
  type FinanceAccountingFilters,
  type MonthlyTaxClosingFilters,
  type PartnerWithholdingTaxFilters,
  TAX_SETTLEMENT_DEFAULT_TAKE,
} from '../finance-tax/tax-settlement-page-model';

export type FinanceOverviewRange = AdminDateRange;

export type FinanceOverviewFilters = {
  readonly period: string;
  readonly range: FinanceOverviewRange;
};

export type FinanceOverviewApiHrefs = {
  readonly overviewSummaryHref: string;
  readonly bankSummaryHref: string;
  readonly cashSettlementSummaryHref: string;
  readonly clearingSummaryHref: string;
  readonly couponSummaryHref: string;
  readonly earningsSummaryHref: string;
  readonly generalLedgerSummaryHref: string;
  readonly monthlyClosingSummaryHref: string;
  readonly partnerWithholdingSummaryHref: string;
  readonly paymentFeeSummaryHref: string;
  readonly paymentSummaryHref: string;
  readonly payoutSummaryHref: string;
  readonly refundSummaryHref: string;
  readonly settlementSummaryHref: string;
  readonly withdrawalSummaryHref: string;
};

export type FinanceOverviewKpi = {
  readonly amount?: number;
  readonly currency?: string;
  readonly detail: string;
  readonly href?: string;
  readonly label: string;
  readonly tone: FinanceOverviewTone;
  readonly value?: string;
};

export type FinanceOverviewSectionRow = {
  readonly amount?: number;
  readonly currency?: string;
  readonly detail: string;
  readonly href?: string;
  readonly label: string;
  readonly value?: string;
};

export type FinanceOverviewSection = {
  readonly description: string;
  readonly href?: string;
  readonly rows: readonly FinanceOverviewSectionRow[];
  readonly title: string;
  readonly tone: FinanceOverviewTone;
};

export type FinanceOverviewActionItem = {
  readonly amount?: number;
  readonly amountLabel?: string;
  readonly countLabel: string;
  readonly currency?: string;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: FinanceOverviewTone;
};

export type FinanceOverviewControlMetric = {
  readonly amount?: number;
  readonly currency?: string;
  readonly detail: string;
  readonly href: string;
  readonly label: string;
  readonly tone: FinanceOverviewTone;
  readonly value?: string;
};

export type FinanceOverviewSummaryInput = {
  readonly amountSummary: AdminFinanceOverviewAmountSummary;
  readonly bankSummary: AdminBankReconciliationSummary;
  readonly bankWithdrawalCandidateSummary: AdminBankReconciliationWithdrawalCandidateSummary;
  readonly cashSummary: AdminCashSettlementSummary | null;
  readonly clearingSummary: AdminBookingPaymentClearingSummary;
  readonly couponSummary: AdminCouponFinanceSummary;
  readonly earningsSummary: AdminEarningSummary | null;
  readonly financeReviewSlaSummary: AdminFinanceOverviewReviewSlaSummary;
  readonly monthlyClosingSummary: AdminMonthlyTaxClosingSummary;
  readonly partnerWithholdingSummary: AdminPartnerWithholdingTaxSummary;
  readonly paymentFeeSummary: AdminPaymentFeeSummary | null;
  readonly paymentSummary: AdminPaymentSummary | null;
  readonly payoutSummary: AdminPayoutBatchSummary | null;
  readonly refundSummary: AdminRefundSummary | null;
  readonly settlementSummary: AdminBookingSettlementSnapshotSummary;
  readonly walletSummary: AdminFinanceOverviewWalletSummary;
  readonly withdrawalSummary: AdminProviderWalletWithdrawalRequestSummary;
};

type FinanceOverviewSectionOptions = {
  readonly includeHiddenSections?: boolean;
};

type FinanceOverviewTone = 'danger' | 'info' | 'neutral' | 'primary' | 'success' | 'warning';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export const financeOverviewRangeOptions: Array<{ value: FinanceOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function normalizeFinanceOverviewRange(value: string | undefined): FinanceOverviewRange {
  const range = normalizeDateRange(value ?? '');
  return range === 'all' ? 'today' : range;
}

export function financeOverviewHref(range: FinanceOverviewRange) {
  return `/finance-overview?${new URLSearchParams({ range }).toString()}`;
}

function financeBankWithdrawalCandidateHref(
  range: FinanceOverviewRange,
  candidate: 'eligible' | 'review' | 'strong',
  owner?: 'unassigned',
) {
  return `/finance-tax/bank-reconciliation?${new URLSearchParams({
    range,
    review: 'outflow',
    candidate,
    ...(owner ? { owner } : {}),
  }).toString()}`;
}

function financePartnerBankDepositReconciliationHref(period: string) {
  return `/finance-tax/partner-bank-deposits?${new URLSearchParams({
    status: 'EXECUTED',
    review: 'needs-reconciliation',
    period,
  }).toString()}`;
}

export function buildFinanceOverviewFilters(
  params: Record<string, string | string[] | undefined>,
): FinanceOverviewFilters {
  return {
    period: readFinanceOverviewPeriod(params.period),
    range: normalizeFinanceOverviewRange(readFirstParam(params.range)),
  };
}

export function buildFinanceOverviewApiHrefs(filters: FinanceOverviewFilters): FinanceOverviewApiHrefs {
  const settlementFilters = financeSettlementFilters(filters.range);
  const clearingFilters = financeAccountingFilters(filters.range, 'open');
  const bankFilters = financeAccountingFilters(filters.range, 'unmatched');
  const monthlyFilters = financeMonthlyFilters(filters.period);
  const withholdingFilters = financeWithholdingFilters(filters.period);

  return {
    overviewSummaryHref: `/admin/finance-overview?${new URLSearchParams({
      range: filters.range,
      period: filters.period,
    }).toString()}`,
    bankSummaryHref: buildBankReconciliationSummaryApiHref(bankFilters),
    cashSettlementSummaryHref: `/admin/cash-settlement-summary?${new URLSearchParams({
      range: filters.range,
    }).toString()}`,
    clearingSummaryHref: buildBookingPaymentClearingSummaryApiHref(clearingFilters),
    couponSummaryHref: buildCouponFinanceSummaryApiHref(settlementFilters),
    earningsSummaryHref: `/admin/earnings/summary?range=${encodeURIComponent(filters.range)}`,
    generalLedgerSummaryHref: `/admin/accounting-journal-batches/summary?range=${encodeURIComponent(
      filters.range,
    )}`,
    monthlyClosingSummaryHref: buildMonthlyTaxClosingSummaryApiHref(monthlyFilters),
    partnerWithholdingSummaryHref: buildPartnerWithholdingTaxSummaryApiHref(withholdingFilters),
    paymentFeeSummaryHref: buildPaymentFeeSummaryApiHref(monthlyFilters),
    paymentSummaryHref: `/admin/payments/summary?range=${encodeURIComponent(filters.range)}`,
    payoutSummaryHref: `/admin/payout-batches/summary?range=${encodeURIComponent(filters.range)}`,
    refundSummaryHref: `/admin/refunds/summary?range=${encodeURIComponent(filters.range)}`,
    settlementSummaryHref: buildBookingSettlementSnapshotSummaryApiHref(settlementFilters),
    withdrawalSummaryHref: buildProviderWalletWithdrawalRequestSummaryApiHref(settlementFilters),
  };
}

export function emptyFinanceOverviewSummaries(period: string): FinanceOverviewSummaryInput {
  return {
    amountSummary: {
      currency: 'VND',
      paymentFailedAmount: 0,
      refundCompletedAmount: 0,
      refundPendingAmount: 0,
    },
    bankSummary: emptyBankReconciliationSummary(),
    bankWithdrawalCandidateSummary: emptyBankWithdrawalCandidateSummary(),
    cashSummary: null,
    clearingSummary: emptyBookingPaymentClearingSummary(),
    couponSummary: emptyCouponFinanceSummary(),
    earningsSummary: null,
    financeReviewSlaSummary: {
      open48To72Count: 0,
      openOverdueCount: 0,
      openOver72Count: 0,
      resolvedInRangeCount: 0,
    },
    monthlyClosingSummary: emptyMonthlyTaxClosingSummary(period),
    partnerWithholdingSummary: emptyPartnerWithholdingTaxSummary(period),
    paymentFeeSummary: emptyPaymentFeeSummary(period),
    paymentSummary: null,
    payoutSummary: null,
    refundSummary: null,
    settlementSummary: emptyBookingSettlementSummary(),
    walletSummary: {
      currency: 'VND',
      customerWalletAccountCount: 0,
      customerWalletLiabilityAmount: 0,
      negativePartnerWalletAmount: 0,
      partnerNegativeWalletAccountCount: 0,
      partnerPositiveWalletAccountCount: 0,
      partnerWalletLiabilityAmount: 0,
    },
    withdrawalSummary: emptyProviderWalletWithdrawalRequestSummary(),
  };
}

function emptyBankWithdrawalCandidateSummary(): AdminBankReconciliationWithdrawalCandidateSummary {
  return {
    assignedCount: 0,
    assignments: [],
    currency: 'VND',
    eligibleCount: 0,
    noneAmount: 0,
    noneCount: 0,
    oldestReviewOccurredAt: null,
    oldestStrongOccurredAt: null,
    reviewAmount: 0,
    reviewCount: 0,
    reviewOver24hCount: 0,
    reviewOver48hCount: 0,
    strongAmount: 0,
    strongCount: 0,
    strongOver24hCount: 0,
    strongOver48hCount: 0,
    unassignedCount: 0,
  };
}

export function financeOverviewSummaryInput(summary: AdminFinanceOverviewSummary): FinanceOverviewSummaryInput {
  return {
    amountSummary: summary.amountSummary,
    bankSummary: summary.bankSummary,
    bankWithdrawalCandidateSummary: summary.bankWithdrawalCandidateSummary,
    cashSummary: summary.cashSummary,
    clearingSummary: summary.clearingSummary,
    couponSummary: summary.couponSummary,
    earningsSummary: summary.earningsSummary,
    financeReviewSlaSummary: summary.financeReviewSlaSummary ?? {
      open48To72Count: 0,
      openOverdueCount: 0,
      openOver72Count: 0,
      resolvedInRangeCount: 0,
    },
    monthlyClosingSummary: summary.monthlyClosingSummary,
    partnerWithholdingSummary: summary.partnerWithholdingSummary,
    paymentFeeSummary: summary.paymentFeeSummary,
    paymentSummary: summary.paymentSummary,
    payoutSummary: summary.payoutSummary,
    refundSummary: summary.refundSummary,
    settlementSummary: summary.settlementSummary,
    walletSummary: summary.walletSummary,
    withdrawalSummary: summary.withdrawalSummary,
  };
}

export function buildFinanceOverviewReviewSlaMetrics(
  input: Pick<FinanceOverviewSummaryInput, 'financeReviewSlaSummary'>,
  range: FinanceOverviewRange,
): FinanceOverviewKpi[] {
  const { open48To72Count, openOver72Count, resolvedInRangeCount } =
    input.financeReviewSlaSummary;

  return [
    {
      detail: 'Reviews beyond the 48-hour SLA that have not yet crossed 72 hours.',
      href: '/notifications?range=all&review=finance-overdue',
      label: 'Open 48–72h',
      tone: open48To72Count > 0 ? 'warning' : 'success',
      value: String(open48To72Count),
    },
    {
      detail: 'Reviews unresolved for more than 72 hours and requiring immediate ownership.',
      href: '/notifications?range=all&review=finance-overdue',
      label: 'Open 72h+',
      tone: openOver72Count > 0 ? 'danger' : 'success',
      value: String(openOver72Count),
    },
    {
      detail: 'Resolved Finance SLA alerts retained as audit evidence for the selected period.',
      href: `/notifications?${new URLSearchParams({
        range,
        review: 'finance-overdue-history',
      }).toString()}`,
      label: 'Resolved reviews',
      tone: 'info',
      value: String(resolvedInRangeCount),
    },
  ];
}

export function buildFinanceOverviewControlMetrics(
  input: FinanceOverviewSummaryInput,
  range: FinanceOverviewRange = 'today',
): FinanceOverviewControlMetric[] {
  const currency = financeOverviewCurrency(input);
  const revenueShare =
    input.settlementSummary.customerPaymentAmount > 0
      ? `${Math.round(
          (input.settlementSummary.platformFeeNetRevenue / input.settlementSummary.customerPaymentAmount) *
            1000,
        ) / 10}%`
      : '—';
  const walletExposure =
    input.walletSummary.customerWalletLiabilityAmount +
    input.walletSummary.partnerWalletLiabilityAmount +
    input.walletSummary.negativePartnerWalletAmount;
  const openFinanceRiskCount =
    financeOverviewReconciliationIssueCount(input) +
    (input.refundSummary?.openCount ?? 0) +
    (input.paymentSummary?.needsAction ?? 0);

  return [
    {
      detail: `${formatMoney(
        input.settlementSummary.platformFeeNetRevenue,
        currency,
      )} platform-fee revenue from ${formatMoney(
        input.settlementSummary.customerPaymentAmount,
        currency,
      )} gross payment volume.`,
      href: '/finance-tax/booking-settlement-audit',
      label: 'Revenue separation',
      tone: 'success',
      value: revenueShare,
    },
    {
      amount: walletExposure,
      currency: input.walletSummary.currency,
      detail: `${input.walletSummary.customerWalletAccountCount} customer wallet / ${input.walletSummary.partnerPositiveWalletAccountCount} positive Partner wallet / ${input.walletSummary.partnerNegativeWalletAccountCount} negative Partner wallet account(s).`,
      href: '/wallet-adjustments',
      label: 'Wallet exposure',
      tone: walletExposure > 0 ? 'warning' : 'success',
    },
    {
      detail: `${input.clearingSummary.openCount} payment clearing / ${input.bankSummary.unmatchedCount} bank unmatched / ${input.refundSummary?.openCount ?? 0} refund / ${input.settlementSummary.openTaxCount} tax / ${input.couponSummary.couponReviewFlagCount} coupon / ${input.paymentSummary?.needsAction ?? 0} payment action item(s), plus closeout deltas when present.`,
      href: '/finance-tax/payment-clearing?review=open',
      label: 'Open finance risks',
      tone: openFinanceRiskCount > 0 ? 'danger' : 'success',
      value: String(openFinanceRiskCount),
    },
    {
      detail: `${input.bankWithdrawalCandidateSummary.strongCount} strong / ${input.bankWithdrawalCandidateSummary.reviewCount} review / ${input.bankWithdrawalCandidateSummary.noneCount} without candidate across ${input.bankWithdrawalCandidateSummary.eligibleCount} open outflow transaction(s). ${input.bankWithdrawalCandidateSummary.strongOver24hCount + input.bankWithdrawalCandidateSummary.reviewOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.strongOver48hCount + input.bankWithdrawalCandidateSummary.reviewOver48hCount} over 48h.`,
      href:
        input.bankWithdrawalCandidateSummary.strongCount > 0
          ? financeBankWithdrawalCandidateHref(range, 'strong')
          : input.bankWithdrawalCandidateSummary.reviewCount > 0
            ? financeBankWithdrawalCandidateHref(range, 'review')
            : bankReconciliationHref(financeAccountingFilters(range, 'outflow')),
      label: 'Withdrawal matching',
      tone:
        input.bankWithdrawalCandidateSummary.strongOver48hCount +
            input.bankWithdrawalCandidateSummary.reviewOver48hCount >
          0
          ? 'danger'
          : input.bankWithdrawalCandidateSummary.strongCount > 0
          ? 'danger'
          : input.bankWithdrawalCandidateSummary.reviewCount > 0
            ? 'warning'
            : 'success',
      value: String(
        input.bankWithdrawalCandidateSummary.strongCount +
          input.bankWithdrawalCandidateSummary.reviewCount,
      ),
    },
    {
      detail: `${input.monthlyClosingSummary.period} delta ${formatMoney(
        input.monthlyClosingSummary.reconciliationDelta,
        input.monthlyClosingSummary.currency,
      )}.`,
      href: '/finance-tax/monthly-tax-closing',
      label: 'Monthly close status',
      tone:
        input.monthlyClosingSummary.status === 'CLOSED'
          ? 'success'
          : input.monthlyClosingSummary.reconciliationDelta === 0
            ? 'info'
            : 'warning',
      value: input.monthlyClosingSummary.status,
    },
  ];
}

export function buildFinanceOverviewKpis(input: FinanceOverviewSummaryInput): FinanceOverviewKpi[] {
  const currency = financeOverviewCurrency(input);
  const netRevenueEstimate =
    input.settlementSummary.platformFeeNetRevenue -
    input.couponSummary.companyCouponExpense -
    input.settlementSummary.paymentProcessingFee;
  const partnerWalletLiability = input.walletSummary.partnerWalletLiabilityAmount;
  const negativePartnerWallet = input.walletSummary.negativePartnerWalletAmount;
  const reconciliationIssues = financeOverviewReconciliationIssueCount(input);

  return [
    {
      ...financeOverviewMoneyValue(input.settlementSummary.customerPaymentAmount, currency),
      detail: 'Customer paid amount is not company revenue.',
      href: bookingSettlementAuditHref(financeSettlementFilters('today')),
      label: 'Gross Booking Amount',
      tone: 'primary',
    },
    {
      ...financeOverviewMoneyValue(input.settlementSummary.platformFeeNetRevenue, currency),
      detail: `Actual company revenue record. Gross platform fee: ${formatMoney(
        input.settlementSummary.platformFeeGross,
        currency,
      )}.`,
      href: '/finance-tax/platform-vat',
      label: 'Platform Fee',
      tone: 'success',
    },
    {
      ...financeOverviewMoneyValue(netRevenueEstimate, currency),
      detail: 'Platform fee minus company-funded coupon expense and payment processing fee.',
      href: '/finance-tax/payment-fees',
      label: 'Net Platform Revenue Estimate',
      tone: netRevenueEstimate < 0 ? 'danger' : 'info',
    },
    {
      ...financeOverviewMoneyValue(
        input.earningsSummary?.pendingNetAmount ?? input.settlementSummary.partnerPayoutAmount,
        currency,
      ),
      detail: 'Partner payable still pending or available before payout execution.',
      href: '/earnings',
      label: 'Partner Payout Pending',
      tone: (input.earningsSummary?.pendingNetAmount ?? input.settlementSummary.partnerPayoutAmount) > 0
        ? 'warning'
        : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(input.earningsSummary?.paidNetAmount ?? 0, currency),
      detail: 'Partner net amount already marked paid in earning records.',
      href: '/payouts',
      label: 'Partner Payout Completed',
      tone: 'success',
    },
    {
      ...financeOverviewMoneyValue(
        input.withdrawalSummary.pendingWithdrawalPayableAmount,
        input.withdrawalSummary.currency,
      ),
      detail: 'Approved/requested Partner withdrawals that still create withdrawal payable exposure.',
      href: '/payouts?withdrawalStatus=REVIEW_REQUIRED',
      label: 'Withdrawal Payable',
      tone: input.withdrawalSummary.pendingWithdrawalPayableAmount > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(
        input.walletSummary.customerWalletLiabilityAmount,
        input.walletSummary.currency,
      ),
      detail: `${input.walletSummary.customerWalletAccountCount} customer wallet account(s) with positive balance.`,
      href: '/wallet-adjustments?ownerType=CUSTOMER',
      label: 'Customer Wallet Liability',
      tone: input.walletSummary.customerWalletLiabilityAmount > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(partnerWalletLiability, input.walletSummary.currency),
      detail: `${input.walletSummary.partnerPositiveWalletAccountCount} Partner wallet account(s) with positive balance.`,
      href: '/wallet-adjustments?ownerType=PARTNER',
      label: 'Partner Wallet Liability',
      tone: partnerWalletLiability > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(negativePartnerWallet, input.walletSummary.currency),
      detail: 'Partner negative wallet is company receivable from cash booking fee or tax debt.',
      href: '/cash-settlements',
      label: 'Negative Partner Wallet',
      tone: negativePartnerWallet > 0 ? 'danger' : 'success',
    },
    {
      ...financeOverviewMoneyValue(input.cashSummary?.totalDebtAmount, input.cashSummary?.currency ?? currency),
      detail: 'Cash booking amount still requiring settlement evidence.',
      href: '/cash-settlements',
      label: 'Cash Pending Amount',
      tone: (input.cashSummary?.totalDebtAmount ?? 0) > 0 ? 'warning' : 'neutral',
      value: input.cashSummary ? undefined : '—',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.refundPendingAmount, input.amountSummary.currency),
      detail: `${input.refundSummary?.openCount ?? 0} open refund case(s).`,
      href: '/refunds?review=open',
      label: 'Refund Pending Amount',
      tone: (input.refundSummary?.openCount ?? 0) > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.refundCompletedAmount, input.amountSummary.currency),
      detail: `${input.refundSummary?.completedCount ?? 0} completed refund case(s).`,
      href: '/refunds?review=completed',
      label: 'Refund Completed Amount',
      tone: 'neutral',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.paymentFailedAmount, input.amountSummary.currency),
      detail: `${input.paymentSummary?.needsAction ?? 0} payment row(s) still need review.`,
      href: '/payments?review=needs-action',
      label: 'Payment Failed Amount',
      tone: (input.paymentSummary?.needsAction ?? 0) > 0 ? 'warning' : 'neutral',
    },
    {
      detail: 'Open tax rows are used until missing-partner tax profile count is exposed.',
      href: '/finance-tax/partner-withholding-tax',
      label: 'Tax Info Missing Partners',
      tone: input.settlementSummary.openTaxCount > 0 ? 'warning' : 'success',
      value: String(input.settlementSummary.openTaxCount),
    },
    {
      detail: 'Payment clearing, bank reconciliation, tax, coupon, and monthly formula mismatch signals.',
      href: '/finance-tax/payment-clearing?review=open',
      label: 'Reconciliation Issues',
      tone: reconciliationIssues > 0 ? 'danger' : 'success',
      value: String(reconciliationIssues),
    },
  ];
}

const financeOverviewPrimaryKpiLabels = [
  'Gross Booking Amount',
  'Platform Fee',
  'Net Platform Revenue Estimate',
  'Partner Payout Pending',
  'Payment Failed Amount',
  'Reconciliation Issues',
] as const;

export function buildFinanceOverviewPrimaryKpis(input: FinanceOverviewSummaryInput): FinanceOverviewKpi[] {
  const kpisByLabel = new Map(buildFinanceOverviewKpis(input).map((kpi) => [kpi.label, kpi]));

  return financeOverviewPrimaryKpiLabels.flatMap((label) => {
    const kpi = kpisByLabel.get(label);
    return kpi ? [kpi] : [];
  });
}

export function buildFinanceOverviewSections(
  input: FinanceOverviewSummaryInput,
  options: FinanceOverviewSectionOptions = {},
): FinanceOverviewSection[] {
  const includeHiddenSections = options.includeHiddenSections ?? true;
  const currency = financeOverviewCurrency(input);
  const paymentFeeSummary = input.paymentFeeSummary;
  const couponCost = input.couponSummary.companyCouponExpense;
  const netRevenueEstimate =
    input.settlementSummary.platformFeeNetRevenue - couponCost - input.settlementSummary.paymentProcessingFee;
  const averagePlatformFee =
    input.settlementSummary.count > 0
      ? Math.round(input.settlementSummary.platformFeeNetRevenue / input.settlementSummary.count)
      : null;
  const platformFeeRate =
    input.settlementSummary.customerPaymentAmount > 0
      ? `${Math.round(
          (input.settlementSummary.platformFeeGross / input.settlementSummary.customerPaymentAmount) * 1000,
        ) / 10}%`
      : '—';

  const sections: FinanceOverviewSection[] = [
    {
      title: 'Revenue & Platform Fee',
      description: 'Company revenue is platform fee only; gross customer payment stays separated.',
      href: '/finance-tax/booking-settlement-audit',
      tone: 'success',
      rows: [
        {
          ...financeOverviewMoneyValue(input.settlementSummary.customerPaymentAmount, currency),
          label: 'Gross booking amount',
          detail: 'Customer-paid amount, never treated as company revenue.',
        },
        {
          ...financeOverviewMoneyValue(input.settlementSummary.platformFeeNetRevenue, currency),
          label: 'Platform fee net revenue',
          detail: 'Actual company revenue after output VAT split.',
        },
        {
          ...financeOverviewMoneyValue(couponCost, input.couponSummary.currency),
          label: 'Company coupon cost',
          detail: 'Company-funded coupon expense from settlement metadata.',
          href: '/finance-tax/coupon-finance',
        },
        {
          ...financeOverviewMoneyValue(input.settlementSummary.paymentProcessingFee, currency),
          label: 'Payment processing fee',
          detail: 'Gateway or payment fee cost stored in settlement records.',
          href: '/finance-tax/payment-fees',
        },
        {
          ...financeOverviewMoneyValue(netRevenueEstimate, currency),
          label: 'Net platform revenue estimate',
          detail: 'Platform fee net revenue minus company coupon cost and processing fee.',
        },
        {
          ...financeOverviewMoneyValue(averagePlatformFee, currency),
          label: 'Average platform fee',
          value: averagePlatformFee === null ? '—' : undefined,
          detail: `${input.settlementSummary.count} settlement record row(s).`,
        },
        {
          label: 'Platform fee rate',
          value: platformFeeRate,
          detail: 'Platform fee gross divided by customer paid amount.',
        },
      ],
    },
    {
      title: 'Payment Method Status',
      description: 'Payment and gateway status with method-level processing fee records when available.',
      href: '/payments',
      tone: 'primary',
      rows: [
        {
          label: 'Authorized holds',
          value: String(input.paymentSummary?.authorized ?? 0),
          detail: 'Holds that should resolve through capture, release, or refund.',
        },
        {
          label: 'Pending cash rows',
          value: String(input.paymentSummary?.pendingCash ?? 0),
          detail: 'Cash payment rows waiting for collection and wallet debt evidence.',
        },
        {
          label: 'Callback review',
          value: String(input.paymentSummary?.callbackReview ?? 0),
          detail: 'Gateway callback attempts still needing evidence review.',
        },
        {
          label: 'Payment fee methods',
          value: String(paymentFeeSummary?.byPaymentMethod.length ?? 0),
          detail: paymentFeeSummary?.byPaymentMethod.length
            ? paymentFeeSummary.byPaymentMethod
                .map((row) =>
                  `${row.paymentMethod}: ${formatMoney(
                    row.paymentProcessingFeeTotal,
                    paymentFeeSummary.currency,
                  )}`,
                )
                .join(' / ')
            : 'No method-level payment fee summary yet.',
          href: '/finance-tax/payment-fees',
        },
      ],
    },
    {
      title: 'Partner Settlement',
      description: 'Partner payable, completed payout, and withdrawal payable exposure.',
      href: '/earnings',
      tone: 'warning',
      rows: [
        {
          ...financeOverviewMoneyValue(input.settlementSummary.partnerPayoutAmount, currency),
          label: 'Partner payout amount',
          detail: 'Partner payout from immutable settlement records.',
        },
        {
          ...financeOverviewMoneyValue(input.earningsSummary?.pendingNetAmount ?? 0, currency),
          label: 'Pending earning net',
          detail: 'Partner earning net not yet available or paid.',
        },
        {
          ...financeOverviewMoneyValue(input.earningsSummary?.availableNetAmount ?? 0, currency),
          label: 'Available earning net',
          detail: 'Partner earning net available for payout batching.',
        },
        {
          ...financeOverviewMoneyValue(input.earningsSummary?.paidNetAmount ?? 0, currency),
          label: 'Paid earning net',
          detail: 'Partner earning net already paid.',
        },
        {
          ...financeOverviewMoneyValue(
            input.withdrawalSummary.pendingWithdrawalPayableAmount,
            input.withdrawalSummary.currency,
          ),
          label: 'Withdrawal payable',
          detail: `${input.withdrawalSummary.requested} requested / ${input.withdrawalSummary.bankTransferPending} bank transfer pending.`,
          href: '/payouts?withdrawalStatus=REVIEW_REQUIRED',
        },
      ],
    },
    {
      title: 'Wallet Liability',
      description: 'Wallet balance exposure stays separate from platform fee revenue.',
      href: '/wallet-adjustments',
      tone: 'info',
      rows: [
        {
          ...financeOverviewMoneyValue(
            input.walletSummary.customerWalletLiabilityAmount,
            input.walletSummary.currency,
          ),
          label: 'Customer wallet liability',
          detail: `${input.walletSummary.customerWalletAccountCount} customer wallet account(s) with positive balance.`,
          href: '/wallet-adjustments?ownerType=CUSTOMER',
        },
        {
          ...financeOverviewMoneyValue(
            input.walletSummary.partnerWalletLiabilityAmount,
            input.walletSummary.currency,
          ),
          label: 'Partner wallet liability',
          detail: `${input.walletSummary.partnerPositiveWalletAccountCount} Partner wallet account(s) with positive balance.`,
          href: '/wallet-adjustments?ownerType=PARTNER',
        },
        {
          ...financeOverviewMoneyValue(
            input.walletSummary.negativePartnerWalletAmount,
            input.walletSummary.currency,
          ),
          label: 'Partner wallet receivable',
          detail: `${input.walletSummary.partnerNegativeWalletAccountCount} Partner wallet account(s) below zero.`,
          href: '/cash-settlements',
        },
        {
          label: 'Manual adjustments',
          value: 'Review',
          detail: 'Manual wallet adjustments must not move bank/cash or create platform revenue.',
          href: '/wallet-adjustments',
        },
      ],
    },
    {
      title: 'Tax Overview',
      description: 'Tax rows and remittance summary remain separated from revenue and payment fee cost.',
      href: '/finance-tax',
      tone: 'info',
      rows: [
        {
          ...financeOverviewMoneyValue(input.settlementSummary.companyOutputVat, currency),
          label: 'Company output VAT',
          detail: 'Company VAT payable from platform fee records.',
          href: '/finance-tax/platform-vat',
        },
        {
          ...financeOverviewMoneyValue(input.partnerWithholdingSummary.totalPartnerTaxWithheld, currency),
          label: 'Partner withholding',
          detail: `${input.partnerWithholdingSummary.partnerCountWithRevenue} Partner(s) with revenue in ${input.partnerWithholdingSummary.period}.`,
          href: '/finance-tax/partner-withholding-tax',
        },
        {
          label: 'Open tax rows',
          value: String(input.settlementSummary.openTaxCount),
          detail: 'Settlement rows still waiting for declaration, payment, or closeout review.',
        },
      ],
    },
    {
      title: 'Reconciliation',
      description: 'Booking settlement, payment clearing, bank matching, and monthly formula status.',
      href: '/finance-tax/payment-clearing',
      tone: 'danger',
      rows: [
        {
          label: 'Payment clearing open',
          value: String(input.clearingSummary.openCount),
          detail: formatMoney(input.clearingSummary.amount, input.clearingSummary.currency),
          href: '/finance-tax/payment-clearing?review=open',
        },
        {
          label: 'Bank unmatched',
          value: String(input.bankSummary.unmatchedCount),
          detail: formatMoney(input.bankSummary.amount, input.bankSummary.currency),
          href: '/finance-tax/bank-reconciliation?review=unmatched',
        },
        {
          ...financeOverviewMoneyValue(
            input.monthlyClosingSummary.reconciliationDelta,
            input.monthlyClosingSummary.currency,
          ),
          label: 'Monthly formula delta',
          detail: 'Must be 0 before final closeout.',
          href: '/finance-tax/monthly-tax-closing',
        },
        {
          label: 'Journal batches',
          value: 'Open GL',
          detail: 'Use General Ledger for debit/credit equality and record evidence.',
          href: '/finance-tax/general-ledger',
        },
      ],
    },
  ];

  if (includeHiddenSections) {
    sections.splice(
      4,
      0,
      {
        title: 'Cash Payment / Receivable',
        description: 'Cash booking debt means Partner receivable / negative wallet exposure.',
        href: '/cash-settlements',
        tone: 'danger',
        rows: [
          {
            ...financeOverviewMoneyValue(input.cashSummary?.totalDebtAmount, input.cashSummary?.currency ?? currency),
            label: 'Cash debt amount',
            value: input.cashSummary ? undefined : '—',
            detail: `${input.cashSummary?.rowCount ?? 0} row(s), ${input.cashSummary?.providerCount ?? 0} Partner(s).`,
          },
          {
            label: 'High debt Partners',
            value: String(input.cashSummary?.highDebtProviderCount ?? 0),
            detail: 'Partners whose negative wallet should be reviewed before accepting more work.',
          },
          {
            label: 'Missing payment evidence',
            value: String(input.cashSummary?.missingPaymentEvidenceCount ?? 0),
            detail: 'Cash rows missing supporting evidence.',
          },
        ],
      },
      {
        title: 'Refund & Dispute',
        description: 'Refund queue status without mixing refund amounts into platform fee revenue.',
        href: '/refunds',
        tone: 'warning',
        rows: [
          {
            ...financeOverviewMoneyValue(input.amountSummary.refundPendingAmount, input.amountSummary.currency),
            label: 'Open refunds',
            detail: 'Refund rows still needing resolution.',
          },
          {
            label: 'Needs update',
            value: String(input.refundSummary?.needsUpdateCount ?? 0),
            detail: 'Refund rows whose payment or booking state needs an update.',
          },
          {
            ...financeOverviewMoneyValue(input.amountSummary.refundCompletedAmount, input.amountSummary.currency),
            label: 'Completed refunds',
            detail: 'Completed refund cases in the active range.',
          },
        ],
      },
    );
  }

  return sections;
}

export function buildFinanceOverviewVisibleSections(
  sections: readonly FinanceOverviewSection[],
): FinanceOverviewSection[] {
  const visibleTitles = new Set([
    'Revenue & Platform Fee',
    'Payment Method Status',
    'Partner Settlement',
    'Wallet Liability',
    'Tax Overview',
    'Reconciliation',
  ]);

  return sections.filter((section) => visibleTitles.has(section.title)).map((section) => {
    if (section.title === 'Reconciliation') {
      return {
        ...section,
        rows: section.rows.filter((row) => row.href !== '/finance-tax/monthly-tax-closing').slice(0, 3),
      };
    }

    return {
      ...section,
      rows: section.rows.slice(0, 3),
    };
  });
}

export function buildFinanceOverviewPageSections(input: FinanceOverviewSummaryInput): FinanceOverviewSection[] {
  return buildFinanceOverviewVisibleSections(
    buildFinanceOverviewSections(input, { includeHiddenSections: false }),
  );
}

export function buildFinanceOverviewVisibleActionItems(
  items: readonly FinanceOverviewActionItem[],
): FinanceOverviewActionItem[] {
  const actionable = items.filter((item) => item.tone === 'danger' || item.tone === 'warning');
  const clear = items.filter((item) => item.tone !== 'danger' && item.tone !== 'warning');
  return [...actionable, ...clear].slice(0, 4);
}

export function buildFinanceOverviewActionItems(
  input: Pick<
    FinanceOverviewSummaryInput,
    | 'bankSummary'
    | 'bankWithdrawalCandidateSummary'
    | 'cashSummary'
    | 'clearingSummary'
    | 'monthlyClosingSummary'
    | 'refundSummary'
    | 'settlementSummary'
    | 'withdrawalSummary'
  > &
    Partial<Pick<FinanceOverviewSummaryInput, 'amountSummary' | 'financeReviewSlaSummary'>>,
  range: FinanceOverviewRange = 'today',
): FinanceOverviewActionItem[] {
  const settlementFilters = financeSettlementFilters(range);
  const clearingFilters = financeAccountingFilters(range, 'open');
  const bankFilters = financeAccountingFilters(range, 'unmatched');
  const cashDebtAmount = input.cashSummary?.totalDebtAmount ?? input.monthlyClosingSummary.cashDebtTotal;
  const monthlyFormulaIssueCount =
    (input.monthlyClosingSummary.reconciliationDelta !== 0 ? 1 : 0) +
    (input.monthlyClosingSummary.netRevenueDelta !== 0 ? 1 : 0);
  const refundCurrency = input.amountSummary?.currency ?? input.monthlyClosingSummary.currency;
  const refundPendingAmount = input.amountSummary?.refundPendingAmount ?? 0;

  return [
    {
      countLabel: `${input.financeReviewSlaSummary?.openOver72Count ?? 0} over 72h`,
      detail: 'Finance review SLA breaches requiring immediate owner follow-up.',
      href: '/notifications?range=all&review=finance-overdue',
      label: 'Finance reviews over 72h',
      tone: (input.financeReviewSlaSummary?.openOver72Count ?? 0) > 0 ? 'danger' : 'success',
    },
    {
      amount: input.clearingSummary.amount,
      countLabel: `${input.clearingSummary.openCount} open`,
      currency: input.clearingSummary.currency,
      detail: 'Customer payment, settlement posting, refund, payment fee, or coupon clearing rows still open.',
      href: paymentClearingHref(clearingFilters),
      label: 'Payment clearing open',
      tone: input.clearingSummary.openCount > 0 ? 'warning' : 'success',
    },
    {
      amount: input.bankSummary.amount,
      countLabel: `${input.bankSummary.unmatchedCount} unmatched`,
      currency: input.bankSummary.currency,
      detail: 'Company bank transactions missing explicit reconciliation evidence.',
      href: bankReconciliationHref(bankFilters),
      label: 'Bank reconciliation unmatched',
      tone: input.bankSummary.unmatchedCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.monthlyClosingSummary.partnerDepositReconciliationOpenAmount,
      countLabel: `${input.monthlyClosingSummary.partnerDepositReconciliationOpenCount} open`,
      currency: input.monthlyClosingSummary.currency,
      detail: 'Executed Partner deposits whose GL bank debit is not fully matched to imported bank evidence.',
      href: financePartnerBankDepositReconciliationHref(input.monthlyClosingSummary.period),
      label: 'Partner deposit reconciliation',
      tone:
        input.monthlyClosingSummary.partnerDepositReconciliationOpenCount > 0
          ? 'danger'
          : 'success',
    },
    {
      countLabel: `${input.bankWithdrawalCandidateSummary.unassignedCount} unassigned`,
      detail: 'Open withdrawal reconciliation reviews without an accountable owner.',
      href: financeBankWithdrawalCandidateHref(range, 'eligible', 'unassigned'),
      label: 'Unassigned withdrawal reviews',
      tone: input.bankWithdrawalCandidateSummary.unassignedCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.bankWithdrawalCandidateSummary.strongAmount,
      countLabel: `${input.bankWithdrawalCandidateSummary.strongCount} strong`,
      currency: input.bankWithdrawalCandidateSummary.currency,
      detail: `Exact transfer evidence ready for reconciliation. ${input.bankWithdrawalCandidateSummary.strongOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.strongOver48hCount} over 48h.`,
      href: financeBankWithdrawalCandidateHref(range, 'strong'),
      label: 'Strong withdrawal candidates',
      tone: input.bankWithdrawalCandidateSummary.strongCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.bankWithdrawalCandidateSummary.reviewAmount,
      countLabel: `${input.bankWithdrawalCandidateSummary.reviewCount} review`,
      currency: input.bankWithdrawalCandidateSummary.currency,
      detail: `Approximate transfer evidence requiring operator review. ${input.bankWithdrawalCandidateSummary.reviewOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.reviewOver48hCount} over 48h.`,
      href: financeBankWithdrawalCandidateHref(range, 'review'),
      label: 'Withdrawal candidates to review',
      tone:
        input.bankWithdrawalCandidateSummary.reviewOver48hCount > 0
          ? 'danger'
          : input.bankWithdrawalCandidateSummary.reviewCount > 0
            ? 'warning'
            : 'success',
    },
    {
      amount: cashDebtAmount,
      countLabel: `${input.cashSummary?.highDebtProviderCount ?? 0} high debt`,
      currency: input.cashSummary?.currency ?? input.monthlyClosingSummary.currency,
      detail: 'Partner negative wallet / cash receivable that can block payout or matching.',
      href: range === 'today' ? '/cash-settlements?queue=high-debt' : `/cash-settlements?range=${range}&queue=high-debt`,
      label: 'Cash debt recovery',
      tone: cashDebtAmount > 0 ? 'danger' : 'success',
    },
    {
      amount: refundPendingAmount,
      countLabel: `${input.refundSummary?.openCount ?? 0} open`,
      currency: refundCurrency,
      detail: 'Refund cases requiring booking/payment/reversal evidence.',
      href: '/refunds?review=open',
      label: 'Refund queue',
      tone: (input.refundSummary?.openCount ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      amount: input.withdrawalSummary.pendingWithdrawalPayableAmount,
      countLabel: `${input.withdrawalSummary.requested} requested`,
      currency: input.withdrawalSummary.currency,
      detail: 'Withdrawal payable exposure waiting for review or manual bank transfer.',
      href: '/payouts?withdrawalStatus=REVIEW_REQUIRED',
      label: 'Withdrawal payable',
      tone: input.withdrawalSummary.requested > 0 ? 'warning' : 'success',
    },
    {
      amountLabel: `${monthlyFormulaIssueCount} formula issue(s)`,
      countLabel: `${input.settlementSummary.openTaxCount} open tax`,
      detail: 'Open tax rows, coupon review flags, or monthly formula deltas before closeout.',
      href: bookingSettlementAuditHref({ ...settlementFilters, review: 'open' }),
      label: 'Tax and closeout review',
      tone:
        input.settlementSummary.openTaxCount > 0 ||
        input.monthlyClosingSummary.couponReviewFlagCount > 0 ||
        monthlyFormulaIssueCount > 0
          ? 'warning'
          : 'success',
    },
    {
      amountLabel: 'Debit / credit equality',
      countLabel: 'GL',
      detail: 'Open journal batches to verify persistent double-entry evidence.',
      href: generalLedgerHref(financeAccountingFilters(range, 'all')),
      label: 'General ledger audit',
      tone: 'info',
    },
  ];
}

export function buildFinanceOverviewRangeLabel(range: FinanceOverviewRange) {
  return dateRangeLabel(range);
}

function financeOverviewMoneyValue(amount: number | null | undefined, currency: string) {
  return amount === null || amount === undefined ? {} : { amount, currency };
}

export function financeOverviewCurrency(input: FinanceOverviewSummaryInput) {
  return (
    input.settlementSummary.currency ||
    input.earningsSummary?.currency ||
    input.cashSummary?.currency ||
    input.monthlyClosingSummary.currency ||
    'VND'
  );
}

function financeOverviewReconciliationIssueCount(input: FinanceOverviewSummaryInput) {
  return (
    input.clearingSummary.openCount +
    input.bankSummary.unmatchedCount +
    input.settlementSummary.openTaxCount +
    input.couponSummary.couponReviewFlagCount +
    (input.monthlyClosingSummary.reconciliationDelta !== 0 ? 1 : 0) +
    (input.monthlyClosingSummary.netRevenueDelta !== 0 ? 1 : 0)
  );
}

function financeSettlementFilters(range: FinanceOverviewRange): BookingSettlementFilters {
  return {
    page: 1,
    range,
    review: 'all',
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  };
}

function financeAccountingFilters(
  range: FinanceOverviewRange,
  review: FinanceAccountingFilters['review'],
): FinanceAccountingFilters {
  return {
    page: 1,
    range,
    review,
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  };
}

function financeMonthlyFilters(period: string): MonthlyTaxClosingFilters {
  return {
    page: 1,
    period,
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  };
}

function financeWithholdingFilters(period: string): PartnerWithholdingTaxFilters {
  return {
    page: 1,
    period,
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  };
}

function readFinanceOverviewPeriod(value: string | string[] | undefined) {
  const raw = readFirstParam(value);
  return /^\d{4}-\d{2}$/.test(raw) ? raw : currentVietnamMonthPeriod();
}

function readFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function currentVietnamMonthPeriod() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    month: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}`;
}
