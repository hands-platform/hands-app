import type {
  AdminAccountingJournalBatchSummary,
  AdminBankReconciliationSummary,
  AdminBankReconciliationWithdrawalCandidateSummary,
  AdminBookingPaymentClearingSummary,
  AdminBookingSettlementSnapshotSummary,
  AdminCashSettlementSummary,
  AdminCompanyBankAccountApprovalSummary,
  AdminCouponFinanceSummary,
  AdminEarningSummary,
  AdminFinanceOverviewAmountSummary,
  AdminFinanceOverviewComparisonMetric,
  AdminFinanceOverviewComparisonSummary,
  AdminFinanceOverviewPartnerDepositQueueSummary,
  AdminFinanceOverviewReviewSlaSummary,
  AdminFinanceOverviewSummary,
  AdminFinanceOverviewTaxProfileSummary,
  AdminFinanceOverviewWalletSummary,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxSummary,
  AdminPaymentFeeSummary,
  AdminPaymentSummary,
  AdminPayoutBatchSummary,
  AdminProviderWalletWithdrawalRequestSummary,
  AdminRefundSummary,
} from '../../lib/admin-api';
import { formatMoney, formatRelativeAge } from '../../lib/admin-format';
import { adminCountLabel } from '../../lib/admin-copy';
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
export type FinanceOverviewWorkspace = 'command' | 'flow' | 'queues';

export type FinanceOverviewFilters = {
  readonly period: string;
  readonly range: FinanceOverviewRange;
  readonly workspace: FinanceOverviewWorkspace;
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
  readonly assigneeLabel?: string;
  readonly amount?: number;
  readonly amountLabel?: string;
  readonly countLabel: string;
  readonly currency?: string;
  readonly detail: string;
  readonly href: string;
  readonly impactScore: number;
  readonly label: string;
  readonly oldestAgeMinutes: number;
  readonly oldestLabel?: string;
  readonly ownerLabel: string;
  readonly ownerState: 'assigned' | 'shared' | 'unassigned';
  readonly slaBreached: boolean;
  readonly sourceIndex: number;
  readonly tone: FinanceOverviewTone;
};

type FinanceOverviewActionItemDraft = Omit<
  FinanceOverviewActionItem,
  'impactScore' | 'oldestAgeMinutes' | 'slaBreached' | 'sourceIndex'
>;

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
  readonly comparisonSummary: AdminFinanceOverviewComparisonSummary;
  readonly companyBankAccountApprovalSummary: AdminCompanyBankAccountApprovalSummary;
  readonly couponSummary: AdminCouponFinanceSummary;
  readonly earningsSummary: AdminEarningSummary | null;
  readonly financeReviewSlaSummary: AdminFinanceOverviewReviewSlaSummary;
  readonly generalLedgerSummary: AdminAccountingJournalBatchSummary;
  readonly monthlyClosingSummary: AdminMonthlyTaxClosingSummary;
  readonly partnerDepositQueueSummary: AdminFinanceOverviewPartnerDepositQueueSummary;
  readonly partnerWithholdingSummary: AdminPartnerWithholdingTaxSummary;
  readonly paymentFeeSummary: AdminPaymentFeeSummary | null;
  readonly paymentSummary: AdminPaymentSummary | null;
  readonly payoutSummary: AdminPayoutBatchSummary | null;
  readonly refundSummary: AdminRefundSummary | null;
  readonly settlementSummary: AdminBookingSettlementSnapshotSummary;
  readonly taxProfileSummary: AdminFinanceOverviewTaxProfileSummary;
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

export function financeOverviewHref(
  range: FinanceOverviewRange,
  options: {
    readonly period?: string;
    readonly workspace?: FinanceOverviewWorkspace;
  } = {},
) {
  const workspace = options.workspace ?? 'command';
  if (workspace === 'command') return '/finance-overview';
  if (workspace === 'queues') return '/finance-overview?view=queues';

  const params = new URLSearchParams({ view: 'flow', range });
  if (options.period) params.set('period', options.period);
  return `/finance-overview?${params.toString()}`;
}

export function financeOverviewCanonicalHref(filters: FinanceOverviewFilters) {
  return financeOverviewHref(filters.range, {
    period: filters.period,
    workspace: filters.workspace,
  });
}

export function isFinanceOverviewCanonicalRequest(
  params: Record<string, string | string[] | undefined>,
  filters: FinanceOverviewFilters,
) {
  const expected = new URL(financeOverviewCanonicalHref(filters), 'http://finance.local').searchParams;
  const allowedKeys = new Set(['period', 'range', 'view']);

  if (Object.keys(params).some((key) => !allowedKeys.has(key))) return false;

  for (const key of allowedKeys) {
    const actual = params[key];
    if (Array.isArray(actual)) return false;
    if ((actual ?? null) !== (expected.get(key) ?? null)) return false;
  }

  return true;
}

function financeBankWithdrawalCandidateHref(
  range: AdminDateRange,
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

function financePartnerBankDepositReconciliationHref(owner?: 'unassigned') {
  return `/finance-tax/partner-bank-deposits?${new URLSearchParams({
    review: 'needs-reconciliation',
    sort: 'oldest',
    scope: 'all-open',
    returnTo: '/finance-overview?view=queues',
    ...(owner ? { owner } : {}),
  }).toString()}`;
}

function financeReviewSlaHref(owner?: 'unassigned') {
  return `/notifications?${new URLSearchParams({
    range: 'all',
    review: 'finance-overdue',
    ...(owner ? { financeOwner: owner } : {}),
  }).toString()}`;
}

function financeOwnedQueueHref(href: string, unassignedCount: number) {
  if (unassignedCount <= 0) return href;
  const [pathname, search = ''] = href.split('?');
  const params = new URLSearchParams(search);
  params.set('owner', 'unassigned');
  return `${pathname}?${params.toString()}`;
}

export function buildFinanceOverviewFilters(
  params: Record<string, string | string[] | undefined>,
): FinanceOverviewFilters {
  return {
    period: readFinanceOverviewPeriod(params.period),
    range: normalizeFinanceOverviewRange(readFirstParam(params.range)),
    workspace: normalizeFinanceOverviewWorkspace(readFirstParam(params.view)),
  };
}

export function normalizeFinanceOverviewWorkspace(value: string | undefined): FinanceOverviewWorkspace {
  return value === 'flow' || value === 'queues' ? value : 'command';
}

export function buildFinanceOverviewApiHrefs(filters: FinanceOverviewFilters): FinanceOverviewApiHrefs {
  const settlementFilters = financeSettlementFilters(filters.range);
  const clearingFilters = financeAccountingFilters('all', 'open');
  const bankFilters = financeAccountingFilters('all', 'unmatched');
  const monthlyFilters = financeMonthlyFilters(filters.period);
  const withholdingFilters = financeWithholdingFilters(filters.period);

  return {
    overviewSummaryHref: `/admin/finance-overview?${new URLSearchParams({
      range: filters.range,
      period: filters.period,
    }).toString()}`,
    bankSummaryHref: buildBankReconciliationSummaryApiHref(bankFilters),
    cashSettlementSummaryHref: `/admin/cash-settlement-summary?${new URLSearchParams({
      range: 'all',
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
    refundSummaryHref: '/admin/refunds/summary?range=all',
    settlementSummaryHref: buildBookingSettlementSnapshotSummaryApiHref(settlementFilters),
    withdrawalSummaryHref: buildProviderWalletWithdrawalRequestSummaryApiHref(
      financeSettlementFilters('all'),
    ),
  };
}

export function emptyFinanceOverviewSummaries(period: string): FinanceOverviewSummaryInput {
  return {
    amountSummary: {
      currency: 'VND',
      paymentFailedCount: 0,
      paymentFailedAmount: 0,
      refundCompletedCount: 0,
      refundCompletedAmount: 0,
      refundPendingCount: 0,
      refundPendingAmount: 0,
    },
    bankSummary: emptyBankReconciliationSummary(),
    bankWithdrawalCandidateSummary: emptyBankWithdrawalCandidateSummary(),
    cashSummary: null,
    clearingSummary: emptyBookingPaymentClearingSummary(),
    comparisonSummary: emptyFinanceOverviewComparisonSummary(),
    companyBankAccountApprovalSummary: emptyCompanyBankAccountApprovalSummary(),
    couponSummary: emptyCouponFinanceSummary(),
    earningsSummary: null,
    financeReviewSlaSummary: {
      assignedCount: 0,
      assignments: [],
      oldestOpenAt: null,
      open48To72Count: 0,
      openOverdueCount: 0,
      openOver72Count: 0,
      resolvedInRangeCount: 0,
      unassignedCount: 0,
    },
    generalLedgerSummary: {
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
    },
    monthlyClosingSummary: emptyMonthlyTaxClosingSummary(period),
    partnerDepositQueueSummary: emptyFinanceOverviewPartnerDepositQueueSummary(),
    partnerWithholdingSummary: emptyPartnerWithholdingTaxSummary(period),
    paymentFeeSummary: emptyPaymentFeeSummary(period),
    paymentSummary: null,
    payoutSummary: null,
    refundSummary: null,
    settlementSummary: emptyBookingSettlementSummary(),
    taxProfileSummary: {
      actionRequiredCount: 0,
      approvedCount: 0,
      missingCount: 0,
      pendingReviewCount: 0,
      rejectedCount: 0,
      relevantPartnerCount: 0,
    },
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

export function financeOverviewSummaryInput(
  summary: AdminFinanceOverviewSummary,
): FinanceOverviewSummaryInput {
  return {
    amountSummary: summary.amountSummary,
    bankSummary: summary.bankSummary,
    bankWithdrawalCandidateSummary: summary.bankWithdrawalCandidateSummary,
    cashSummary: summary.cashSummary,
    clearingSummary: summary.clearingSummary,
    comparisonSummary: summary.comparisonSummary ?? emptyFinanceOverviewComparisonSummary(),
    companyBankAccountApprovalSummary:
      summary.companyBankAccountApprovalSummary ?? emptyCompanyBankAccountApprovalSummary(),
    couponSummary: summary.couponSummary,
    earningsSummary: summary.earningsSummary,
    financeReviewSlaSummary: summary.financeReviewSlaSummary ?? {
      assignedCount: 0,
      assignments: [],
      oldestOpenAt: null,
      open48To72Count: 0,
      openOverdueCount: 0,
      openOver72Count: 0,
      resolvedInRangeCount: 0,
      unassignedCount: 0,
    },
    generalLedgerSummary: summary.generalLedgerSummary ?? emptyFinanceOverviewGeneralLedgerSummary(),
    monthlyClosingSummary: summary.monthlyClosingSummary,
    partnerDepositQueueSummary:
      summary.partnerDepositQueueSummary ?? emptyFinanceOverviewPartnerDepositQueueSummary(),
    partnerWithholdingSummary: summary.partnerWithholdingSummary,
    paymentFeeSummary: summary.paymentFeeSummary,
    paymentSummary: summary.paymentSummary,
    payoutSummary: summary.payoutSummary,
    refundSummary: summary.refundSummary,
    settlementSummary: summary.settlementSummary,
    taxProfileSummary: summary.taxProfileSummary ?? {
      actionRequiredCount: 0,
      approvedCount: 0,
      missingCount: 0,
      pendingReviewCount: 0,
      rejectedCount: 0,
      relevantPartnerCount: 0,
    },
    walletSummary: summary.walletSummary,
    withdrawalSummary: summary.withdrawalSummary,
  };
}

export function buildFinanceOverviewReviewSlaMetrics(
  input: Pick<FinanceOverviewSummaryInput, 'financeReviewSlaSummary'>,
  range: FinanceOverviewRange,
): FinanceOverviewKpi[] {
  const { open48To72Count, openOver72Count, resolvedInRangeCount } = input.financeReviewSlaSummary;

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
      ? `${
          Math.round(
            (input.settlementSummary.platformFeeNetRevenue / input.settlementSummary.customerPaymentAmount) *
              1000,
          ) / 10
        }%`
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
      detail: `${adminCountLabel(input.walletSummary.customerWalletAccountCount, 'customer wallet account')} / ${adminCountLabel(input.walletSummary.partnerPositiveWalletAccountCount, 'positive Partner wallet account')} / ${adminCountLabel(input.walletSummary.partnerNegativeWalletAccountCount, 'negative Partner wallet account')}.`,
      href: '/wallet-adjustments',
      label: 'Wallet exposure',
      tone: walletExposure > 0 ? 'warning' : 'success',
    },
    {
      detail: `${input.clearingSummary.openCount} payment clearing / ${input.bankSummary.unmatchedCount} bank unmatched / ${input.refundSummary?.openCount ?? 0} refund / ${input.settlementSummary.openTaxCount} tax / ${input.couponSummary.couponReviewFlagCount} coupon / ${adminCountLabel(input.paymentSummary?.needsAction ?? 0, 'payment action item')}, plus closeout deltas when present.`,
      href: '/finance-tax/payment-clearing?review=open',
      label: 'Open finance risks',
      tone: openFinanceRiskCount > 0 ? 'danger' : 'success',
      value: String(openFinanceRiskCount),
    },
    {
      detail: `${input.bankWithdrawalCandidateSummary.strongCount} strong / ${input.bankWithdrawalCandidateSummary.reviewCount} review / ${input.bankWithdrawalCandidateSummary.noneCount} without candidate across ${adminCountLabel(input.bankWithdrawalCandidateSummary.eligibleCount, 'open outflow transaction')}. ${input.bankWithdrawalCandidateSummary.strongOver24hCount + input.bankWithdrawalCandidateSummary.reviewOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.strongOver48hCount + input.bankWithdrawalCandidateSummary.reviewOver48hCount} over 48h.`,
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
        input.bankWithdrawalCandidateSummary.strongCount + input.bankWithdrawalCandidateSummary.reviewCount,
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

export function buildFinanceOverviewKpis(
  input: FinanceOverviewSummaryInput,
  range: FinanceOverviewRange = 'today',
): FinanceOverviewKpi[] {
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
      href: bookingSettlementAuditHref(financeSettlementFilters(range)),
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
      ...financeOverviewMoneyValue(input.settlementSummary.partnerPayoutAmount, currency),
      detail: 'Partner payable generated by settlements in the selected period.',
      href: '/earnings',
      label: 'Partner Payout Generated',
      tone: 'info',
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
      tone:
        (input.earningsSummary?.pendingNetAmount ?? input.settlementSummary.partnerPayoutAmount) > 0
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
      detail: `${adminCountLabel(input.walletSummary.customerWalletAccountCount, 'customer wallet account')} with positive balance.`,
      href: '/wallet-adjustments?ownerType=CUSTOMER',
      label: 'Customer Wallet Liability',
      tone: input.walletSummary.customerWalletLiabilityAmount > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(partnerWalletLiability, input.walletSummary.currency),
      detail: `${adminCountLabel(input.walletSummary.partnerPositiveWalletAccountCount, 'Partner wallet account')} with positive balance.`,
      href: '/wallet-adjustments?ownerType=PARTNER',
      label: 'Partner Wallet Liability',
      tone: partnerWalletLiability > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(negativePartnerWallet, input.walletSummary.currency),
      detail: 'Partner negative wallet is company receivable from cash booking fee or tax debt.',
      href: '/cash-settlements',
      label: 'Partner Receivable',
      tone: negativePartnerWallet > 0 ? 'danger' : 'success',
    },
    {
      ...financeOverviewMoneyValue(
        input.cashSummary?.totalDebtAmount,
        input.cashSummary?.currency ?? currency,
      ),
      detail: 'Cash booking amount still requiring settlement evidence.',
      href: '/cash-settlements',
      label: 'Cash Pending Amount',
      tone: (input.cashSummary?.totalDebtAmount ?? 0) > 0 ? 'warning' : 'neutral',
      value: input.cashSummary ? undefined : '—',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.refundPendingAmount, input.amountSummary.currency),
      detail: `${adminCountLabel(input.refundSummary?.openCount ?? 0, 'open refund case')}.`,
      href: '/refunds?review=open',
      label: 'Refund Pending Amount',
      tone: (input.refundSummary?.openCount ?? 0) > 0 ? 'warning' : 'neutral',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.refundCompletedAmount, input.amountSummary.currency),
      detail: `${adminCountLabel(input.refundSummary?.completedCount ?? 0, 'completed refund case')}.`,
      href: '/refunds?review=completed',
      label: 'Refund Completed Amount',
      tone: 'neutral',
    },
    {
      ...financeOverviewMoneyValue(input.amountSummary.paymentFailedAmount, input.amountSummary.currency),
      detail: `${adminCountLabel(input.paymentSummary?.needsAction ?? 0, 'payment row')} still ${(input.paymentSummary?.needsAction ?? 0) === 1 ? 'needs' : 'need'} review.`,
      href: '/payments?review=needs-action',
      label: 'Payment Failed Amount',
      tone: (input.paymentSummary?.needsAction ?? 0) > 0 ? 'warning' : 'neutral',
    },
    {
      detail: `${input.taxProfileSummary.missingCount} missing · ${input.taxProfileSummary.pendingReviewCount} pending · ${input.taxProfileSummary.rejectedCount} rejected among ${adminCountLabel(input.taxProfileSummary.relevantPartnerCount, 'settlement-active Partner')}.`,
      href: '/finance-tax/partner-withholding-tax',
      label: 'Tax Info Missing Partners',
      tone: input.taxProfileSummary.actionRequiredCount > 0 ? 'warning' : 'success',
      value: String(input.taxProfileSummary.actionRequiredCount),
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
  'Partner Payout Generated',
] as const;

export function buildFinanceOverviewPrimaryKpis(
  input: FinanceOverviewSummaryInput,
  range: FinanceOverviewRange = 'today',
): FinanceOverviewKpi[] {
  const kpisByLabel = new Map(buildFinanceOverviewKpis(input, range).map((kpi) => [kpi.label, kpi]));

  return financeOverviewPrimaryKpiLabels.flatMap((label) => {
    const kpi = kpisByLabel.get(label);
    return kpi ? [kpi] : [];
  });
}

const financeOverviewCurrentPositionKpiLabels = [
  'Customer Wallet Liability',
  'Partner Wallet Liability',
  'Partner Receivable',
  'Withdrawal Payable',
] as const;

export function buildFinanceOverviewCurrentPositionKpis(
  input: FinanceOverviewSummaryInput,
): FinanceOverviewKpi[] {
  const kpisByLabel = new Map(buildFinanceOverviewKpis(input).map((kpi) => [kpi.label, kpi]));

  return financeOverviewCurrentPositionKpiLabels.flatMap((label) => {
    const kpi = kpisByLabel.get(label);
    return kpi ? [kpi] : [];
  });
}

export function buildFinanceOverviewTodayMovementKpis(
  input: FinanceOverviewSummaryInput,
): FinanceOverviewKpi[] {
  const currency = financeOverviewCurrency(input);
  const settlementCount = input.settlementSummary.count;

  return [
    {
      amount: input.settlementSummary.customerPaymentAmount,
      currency: input.settlementSummary.currency || currency,
      detail: `${adminCountLabel(settlementCount, 'settlement record')} posted today.`,
      href: bookingSettlementAuditHref(financeSettlementFilters('today')),
      label: 'Customer Payments Today',
      tone: settlementCount > 0 ? 'info' : 'success',
    },
    {
      amount: input.amountSummary.paymentFailedAmount,
      currency: input.amountSummary.currency || currency,
      detail: `${adminCountLabel(input.amountSummary.paymentFailedCount, 'failed payment')} created today.`,
      href: '/payments?range=today&review=needs-action',
      label: 'Failed Payments Today',
      tone:
        input.amountSummary.paymentFailedCount > 0 || input.amountSummary.paymentFailedAmount > 0
          ? 'danger'
          : 'success',
    },
    {
      amount: input.amountSummary.refundPendingAmount,
      currency: input.amountSummary.currency || currency,
      detail: `${adminCountLabel(input.amountSummary.refundPendingCount, 'pending refund request')} created today.`,
      href: '/refunds?range=today&review=open',
      label: 'Pending Refunds Created Today',
      tone:
        input.amountSummary.refundPendingCount > 0 || input.amountSummary.refundPendingAmount > 0
          ? 'warning'
          : 'success',
    },
    {
      amount: input.settlementSummary.partnerPayoutAmount,
      currency: input.settlementSummary.currency || currency,
      detail: `${adminCountLabel(settlementCount, 'settlement record')} generated Partner payable today.`,
      href: '/earnings?range=today',
      label: 'Partner Payout Generated Today',
      tone: settlementCount > 0 ? 'info' : 'success',
    },
  ];
}

export function isFinanceTodayMovementClear(input: FinanceOverviewSummaryInput) {
  return (
    input.settlementSummary.count === 0 &&
    input.settlementSummary.customerPaymentAmount === 0 &&
    input.settlementSummary.partnerPayoutAmount === 0 &&
    input.amountSummary.paymentFailedCount === 0 &&
    input.amountSummary.paymentFailedAmount === 0 &&
    input.amountSummary.refundPendingCount === 0 &&
    input.amountSummary.refundPendingAmount === 0
  );
}

export function isFinanceOverviewRangeMovementClear(input: FinanceOverviewSummaryInput) {
  return (
    input.settlementSummary.customerPaymentAmount === 0 &&
    input.settlementSummary.platformFeeNetRevenue === 0 &&
    input.settlementSummary.partnerPayoutAmount === 0 &&
    input.settlementSummary.paymentProcessingFee === 0 &&
    input.couponSummary.companyCouponExpense === 0
  );
}

export function buildFinanceOverviewMonthlyCloseKpis(
  input: FinanceOverviewSummaryInput,
): FinanceOverviewKpi[] {
  const { monthlyClosingSummary } = input;

  return [
    {
      amount: monthlyClosingSummary.companyOutputVatTotal,
      currency: monthlyClosingSummary.currency,
      detail: `${monthlyClosingSummary.period} company output VAT from posted platform-fee settlements.`,
      href: `/finance-tax/platform-vat?period=${encodeURIComponent(monthlyClosingSummary.period)}`,
      label: 'Platform VAT',
      tone: monthlyClosingSummary.openTaxCount > 0 ? 'warning' : 'info',
    },
    {
      amount: monthlyClosingSummary.partnerWithholdingTotal,
      currency: monthlyClosingSummary.currency,
      detail: `${adminCountLabel(monthlyClosingSummary.openTaxCount, 'open tax record')} and ${adminCountLabel(monthlyClosingSummary.paidTaxCount, 'paid tax record')}.`,
      href: `/finance-tax/partner-withholding-tax?period=${encodeURIComponent(monthlyClosingSummary.period)}`,
      label: 'Partner Withholding',
      tone: monthlyClosingSummary.openTaxCount > 0 ? 'warning' : 'success',
    },
    {
      amount: monthlyClosingSummary.reconciliationDelta,
      currency: monthlyClosingSummary.currency,
      detail: 'Monthly journal, settlement, bank, and closeout reconciliation difference.',
      href: `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(monthlyClosingSummary.period)}`,
      label: 'Reconciliation Delta',
      tone: monthlyClosingSummary.reconciliationDelta === 0 ? 'success' : 'danger',
    },
    {
      detail:
        monthlyClosingSummary.status === 'CLOSED'
          ? `${monthlyClosingSummary.period} is closed. Changes require reversal records.`
          : `${monthlyClosingSummary.period} remains open for closeout review.`,
      href: `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(monthlyClosingSummary.period)}`,
      label: 'Close Status',
      tone:
        monthlyClosingSummary.status === 'CLOSED'
          ? 'success'
          : monthlyClosingSummary.reconciliationDelta === 0
            ? 'info'
            : 'warning',
      value: monthlyClosingSummary.status,
    },
  ];
}

export function buildFinanceOverviewRecordsSection(
  input: FinanceOverviewSummaryInput,
  range: FinanceOverviewRange,
): FinanceOverviewSection {
  return {
    description: 'Open the persistent accounting records behind Finance totals and decisions.',
    rows: [
      {
        detail: `${input.generalLedgerSummary.postedCount} posted · ${input.generalLedgerSummary.blockedCount} integrity blocked`,
        href: generalLedgerHref(financeAccountingFilters('all', 'all')),
        label: 'Journal Batches',
        value: `${input.generalLedgerSummary.count} total batches`,
      },
      {
        detail: `${input.settlementSummary.needsActionCount} need review · ${input.settlementSummary.resolvedCount} resolved`,
        href: bookingSettlementAuditHref(financeSettlementFilters(range)),
        label: 'Booking Settlement Records',
        value: `${input.settlementSummary.count} records`,
      },
      {
        detail: 'Refund and closed-period correction records that preserve the original settlement.',
        href: `/finance-tax/settlement-reversals?range=${encodeURIComponent(range)}`,
        label: 'Settlement Reversals',
        value: `${input.settlementSummary.reversedCount} records`,
      },
      {
        detail: `${adminCountLabel(input.couponSummary.couponReviewFlagCount, 'review flag')} · company-funded expense kept separate from revenue`,
        href: `/finance-tax/coupon-finance?range=${encodeURIComponent(range)}`,
        label: 'Coupon Finance',
        value: `${input.couponSummary.couponSettlementCount} settlements`,
      },
    ],
    title: 'Records',
    tone: input.generalLedgerSummary.blockedCount > 0 ? 'danger' : 'neutral',
  };
}

export function buildFinanceOverviewComparisonKpis(
  input: Pick<FinanceOverviewSummaryInput, 'comparisonSummary' | 'settlementSummary'>,
  range: FinanceOverviewRange,
): FinanceOverviewKpi[] {
  const { comparisonSummary, settlementSummary } = input;
  const currency = settlementSummary.currency || 'VND';

  return [
    {
      detail: financeOverviewComparisonCountDetail(
        comparisonSummary.settlementCount,
        comparisonSummary.previousRangeLabel,
      ),
      href: `/finance-tax/booking-settlement-audit?range=${encodeURIComponent(range)}`,
      label: 'Settlement records',
      tone: financeOverviewGrowthTone(comparisonSummary.settlementCount),
      value: String(comparisonSummary.settlementCount.current),
    },
    {
      amount: comparisonSummary.customerPaymentAmount.current,
      currency,
      detail: financeOverviewComparisonMoneyDetail(
        comparisonSummary.customerPaymentAmount,
        comparisonSummary.previousRangeLabel,
        currency,
      ),
      href: `/finance-tax/booking-settlement-audit?range=${encodeURIComponent(range)}`,
      label: 'Gross customer payments',
      tone: financeOverviewGrowthTone(comparisonSummary.customerPaymentAmount),
    },
    {
      amount: comparisonSummary.platformFeeNetRevenue.current,
      currency,
      detail: financeOverviewComparisonMoneyDetail(
        comparisonSummary.platformFeeNetRevenue,
        comparisonSummary.previousRangeLabel,
        currency,
      ),
      href: `/finance-tax/booking-settlement-audit?range=${encodeURIComponent(range)}`,
      label: 'Platform fee net revenue',
      tone: financeOverviewGrowthTone(comparisonSummary.platformFeeNetRevenue),
    },
    {
      amount: comparisonSummary.partnerPayoutAmount.current,
      currency,
      detail: financeOverviewComparisonMoneyDetail(
        comparisonSummary.partnerPayoutAmount,
        comparisonSummary.previousRangeLabel,
        currency,
      ),
      href: `/earnings?range=${encodeURIComponent(range)}`,
      label: 'Partner payout generated',
      tone: 'info',
    },
  ];
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
      ? `${
          Math.round(
            (input.settlementSummary.platformFeeGross / input.settlementSummary.customerPaymentAmount) * 1000,
          ) / 10
        }%`
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
          detail: `${adminCountLabel(input.settlementSummary.count, 'settlement record row')}.`,
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
      description: 'Current payment and gateway states. Monthly payment-fee records stay with period close controls.',
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
          label: 'Open payout batches',
          value: String(input.payoutSummary?.open ?? 0),
          detail: `${input.payoutSummary?.needsReview ?? 0} need review · ${input.payoutSummary?.payoutHolds ?? 0} payout hold · ${input.payoutSummary?.missingTransferRefs ?? 0} missing transfer reference.`,
          href: '/payouts',
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
          detail: `${adminCountLabel(input.walletSummary.customerWalletAccountCount, 'customer wallet account')} with positive balance.`,
          href: '/wallet-adjustments?ownerType=CUSTOMER',
        },
        {
          ...financeOverviewMoneyValue(
            input.walletSummary.partnerWalletLiabilityAmount,
            input.walletSummary.currency,
          ),
          label: 'Partner wallet liability',
          detail: `${adminCountLabel(input.walletSummary.partnerPositiveWalletAccountCount, 'Partner wallet account')} with positive balance.`,
          href: '/wallet-adjustments?ownerType=PARTNER',
        },
        {
          ...financeOverviewMoneyValue(
            input.walletSummary.negativePartnerWalletAmount,
            input.walletSummary.currency,
          ),
          label: 'Partner wallet receivable',
          detail: `${adminCountLabel(input.walletSummary.partnerNegativeWalletAccountCount, 'Partner wallet account')} below zero.`,
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
      description: 'Tax, remittance, and monthly payment-fee records remain separate from platform revenue.',
      href: '/finance-tax',
      tone: 'info',
      rows: [
        {
          ...financeOverviewMoneyValue(input.settlementSummary.companyOutputVat, currency),
          label: 'Company output VAT',
          detail: 'Company VAT payable from platform fee records.',
          href: `/finance-tax/platform-vat?period=${encodeURIComponent(input.monthlyClosingSummary.period)}`,
        },
        {
          ...financeOverviewMoneyValue(input.partnerWithholdingSummary.totalPartnerTaxWithheld, currency),
          label: 'Partner withholding',
          detail: `${adminCountLabel(input.partnerWithholdingSummary.partnerCountWithRevenue, 'Partner')} with revenue in ${input.partnerWithholdingSummary.period} · ${adminCountLabel(input.settlementSummary.openTaxCount, 'settlement tax row')} still open.`,
          href: `/finance-tax/partner-withholding-tax?period=${encodeURIComponent(input.monthlyClosingSummary.period)}`,
        },
        {
          label: 'Partner tax profile action',
          value: String(input.taxProfileSummary.actionRequiredCount),
          detail: `${input.taxProfileSummary.missingCount} missing · ${input.taxProfileSummary.pendingReviewCount} pending · ${input.taxProfileSummary.rejectedCount} rejected among settlement-active Partners.`,
          href: `/finance-tax/partner-withholding-tax?period=${encodeURIComponent(input.monthlyClosingSummary.period)}`,
        },
        {
          label: `Payment fee methods · ${paymentFeeSummary?.period ?? input.monthlyClosingSummary.period}`,
          value: `${paymentFeeSummary?.byPaymentMethod.length ?? 0} configured methods`,
          detail: paymentFeeSummary?.byPaymentMethod.length
            ? paymentFeeSummary.byPaymentMethod
                .map(
                  (row) =>
                    `${row.paymentMethod}: ${formatMoney(
                      row.paymentProcessingFeeTotal,
                      paymentFeeSummary.currency,
                    )}`,
                )
                .join(' / ')
            : `No method-level payment fee summary for ${paymentFeeSummary?.period ?? input.monthlyClosingSummary.period}.`,
          href: `/finance-tax/payment-fees?period=${encodeURIComponent(
            paymentFeeSummary?.period ?? input.monthlyClosingSummary.period,
          )}`,
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
          ...financeOverviewMoneyValue(
            input.generalLedgerSummary.blockedAmount,
            input.generalLedgerSummary.currency,
          ),
          label: 'Journal batch integrity',
          detail: `${input.generalLedgerSummary.blockedCount} blocked · ${input.generalLedgerSummary.unknownCount} evidence unknown · ${input.generalLedgerSummary.draftCount} draft among ${adminCountLabel(input.generalLedgerSummary.count, 'batch', 'batches')}.`,
          href: '/finance-tax/general-ledger?review=needs-action',
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
            ...financeOverviewMoneyValue(
              input.cashSummary?.totalDebtAmount,
              input.cashSummary?.currency ?? currency,
            ),
            label: 'Cash debt amount',
            value: input.cashSummary ? undefined : '—',
            detail: `${adminCountLabel(input.cashSummary?.rowCount ?? 0, 'row')}, ${adminCountLabel(input.cashSummary?.providerCount ?? 0, 'Partner')}.`,
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
            ...financeOverviewMoneyValue(
              input.amountSummary.refundPendingAmount,
              input.amountSummary.currency,
            ),
            label: 'Open refunds',
            detail: 'Refund rows still needing resolution.',
          },
          {
            label: 'Needs update',
            value: String(input.refundSummary?.needsUpdateCount ?? 0),
            detail: 'Refund rows whose payment or booking state needs an update.',
          },
          {
            ...financeOverviewMoneyValue(
              input.amountSummary.refundCompletedAmount,
              input.amountSummary.currency,
            ),
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
  const paymentFeeMethodLabel = sections
    .find((section) => section.title === 'Tax Overview')
    ?.rows.find((row) => row.label.startsWith('Payment fee methods ·'))?.label;
  const visibleRowsByTitle = new Map<string, ReadonlySet<string>>([
    [
      'Revenue & Platform Fee',
      new Set(['Company coupon cost', 'Payment processing fee']),
    ],
    [
      'Payment Method Status',
      new Set(['Authorized holds', 'Pending cash rows', 'Callback review']),
    ],
    [
      'Partner Settlement',
      new Set(['Available earning net', 'Open payout batches', 'Withdrawal payable']),
    ],
    [
      'Wallet Liability',
      new Set(['Customer wallet liability', 'Partner wallet liability', 'Partner wallet receivable']),
    ],
    [
      'Tax Overview',
      new Set([
        'Company output VAT',
        'Partner withholding',
        'Partner tax profile action',
        ...(paymentFeeMethodLabel ? [paymentFeeMethodLabel] : []),
      ]),
    ],
    [
      'Reconciliation',
      new Set([
        'Payment clearing open',
        'Bank unmatched',
        'Monthly formula delta',
        'Journal batch integrity',
      ]),
    ],
  ]);

  return sections.flatMap((section) => {
    const visibleRows = visibleRowsByTitle.get(section.title);
    if (!visibleRows) return [];
    return [{ ...section, rows: section.rows.filter((row) => visibleRows.has(row.label)) }];
  });
}

export function buildFinanceOverviewPageSections(
  input: FinanceOverviewSummaryInput,
): FinanceOverviewSection[] {
  return buildFinanceOverviewVisibleSections(
    buildFinanceOverviewSections(input, { includeHiddenSections: false }),
  );
}

export function buildFinanceOverviewVisibleActionItems(
  items: readonly FinanceOverviewActionItem[],
): FinanceOverviewActionItem[] {
  const actionable = items.filter((item) => item.tone === 'danger' || item.tone === 'warning');
  return buildFinanceOverviewPriorityItems(actionable);
}

export function buildFinanceOverviewPriorityItems(
  items: readonly FinanceOverviewActionItem[],
  limit?: number,
): FinanceOverviewActionItem[] {
  const sorted = items
    .slice()
    .sort((left, right) => {
      const slaDifference = Number(right.slaBreached) - Number(left.slaBreached);
      if (slaDifference !== 0) return slaDifference;
      const ageDifference = right.oldestAgeMinutes - left.oldestAgeMinutes;
      if (ageDifference !== 0) return ageDifference;
      const ownerDifference =
        financeOverviewOwnerPriority(left.ownerState) - financeOverviewOwnerPriority(right.ownerState);
      if (ownerDifference !== 0) return ownerDifference;
      const impactDifference = right.impactScore - left.impactScore;
      if (impactDifference !== 0) return impactDifference;
      const toneDifference = financeOverviewTonePriority(left.tone) - financeOverviewTonePriority(right.tone);
      return toneDifference !== 0 ? toneDifference : left.sourceIndex - right.sourceIndex;
    });

  return limit === undefined ? sorted : sorted.slice(0, Math.max(0, limit));
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
    Partial<
      Pick<
        FinanceOverviewSummaryInput,
        | 'amountSummary'
        | 'companyBankAccountApprovalSummary'
        | 'financeReviewSlaSummary'
        | 'generalLedgerSummary'
        | 'partnerDepositQueueSummary'
        | 'payoutSummary'
        | 'taxProfileSummary'
      >
    >,
): FinanceOverviewActionItem[] {
  const clearingFilters = financeAccountingFilters('all', 'open');
  const bankFilters = financeAccountingFilters('all', 'unmatched');
  const cashDebtAmount = input.cashSummary?.totalDebtAmount ?? input.monthlyClosingSummary.cashDebtTotal;
  const cashHighDebtCount = input.cashSummary?.highDebtProviderCount ?? 0;
  const cashDebtCountLabel =
    cashHighDebtCount > 0
      ? `${cashHighDebtCount} high debt`
      : cashDebtAmount > 0
        ? `${input.cashSummary?.rowCount ?? 0} open debt`
        : 'No open debt';
  const generalLedgerSummary = input.generalLedgerSummary ?? emptyFinanceOverviewGeneralLedgerSummary();
  const generalLedgerDelta = generalLedgerSummary.blockedAmount;
  const taxProfileSummary = input.taxProfileSummary ?? emptyFinanceOverviewTaxProfileSummary();
  const payoutOpenCount = input.payoutSummary?.open ?? 0;
  const payoutReviewCount = input.payoutSummary?.needsReview ?? 0;
  const payoutHoldCount = input.payoutSummary?.payoutHolds ?? 0;
  const payoutMissingTransferRefCount = input.payoutSummary?.missingTransferRefs ?? 0;
  const partnerDepositQueueSummary =
    input.partnerDepositQueueSummary ?? emptyFinanceOverviewPartnerDepositQueueSummary();
  const companyBankAccountApprovalSummary =
    input.companyBankAccountApprovalSummary ?? emptyCompanyBankAccountApprovalSummary();
  const financeReviewOwner = financeOverviewAssignedQueueOwner(
    input.financeReviewSlaSummary?.assignedCount ?? 0,
    input.financeReviewSlaSummary?.unassignedCount ?? 0,
    input.financeReviewSlaSummary?.assignments ?? [],
  );
  const partnerDepositOwner = financeOverviewAssignedQueueOwner(
    partnerDepositQueueSummary.assignedCount,
    partnerDepositQueueSummary.unassignedCount,
    partnerDepositQueueSummary.assignments,
  );
  const clearingOwner = financeOverviewAssignedQueueOwner(
    input.clearingSummary.assignedCount,
    input.clearingSummary.unassignedCount,
    [],
  );
  const bankOwner = financeOverviewAssignedQueueOwner(
    input.bankSummary.assignedCount,
    input.bankSummary.unassignedCount,
    [],
  );

  const items: FinanceOverviewActionItemDraft[] = [
    {
      countLabel:
        (input.financeReviewSlaSummary?.openOver72Count ?? 0) > 0
          ? `${input.financeReviewSlaSummary?.openOver72Count ?? 0} over 72h`
          : `${input.financeReviewSlaSummary?.open48To72Count ?? 0} at 48–72h`,
      detail: 'Current Finance reviews approaching or exceeding the 72-hour escalation threshold.',
      href: financeReviewSlaHref(
        (input.financeReviewSlaSummary?.unassignedCount ?? 0) > 0 ? 'unassigned' : undefined,
      ),
      label: 'Finance review SLA',
      oldestLabel: financeOverviewOldestLabel(
        input.financeReviewSlaSummary?.oldestOpenAt,
        input.financeReviewSlaSummary?.openOverdueCount ?? 0,
      ),
      ...financeReviewOwner,
      tone:
        (input.financeReviewSlaSummary?.openOver72Count ?? 0) > 0
          ? 'danger'
          : (input.financeReviewSlaSummary?.open48To72Count ?? 0) > 0
            ? 'warning'
            : 'success',
    },
    {
      amount: input.clearingSummary.amount,
      countLabel:
        input.clearingSummary.unassignedCount > 0
          ? `${input.clearingSummary.unassignedCount} unassigned`
          : `${input.clearingSummary.openCount} open`,
      currency: input.clearingSummary.currency,
      detail:
        'Customer payment, settlement posting, refund, payment fee, or coupon clearing rows still open.',
      href: financeOwnedQueueHref(
        paymentClearingHref(clearingFilters),
        input.clearingSummary.unassignedCount,
      ),
      label: 'Payment clearing open',
      oldestLabel: financeOverviewOldestLabel(
        input.clearingSummary.oldestUnassignedOpenAt ?? input.clearingSummary.oldestOpenAt,
        input.clearingSummary.unassignedCount || input.clearingSummary.openCount,
      ),
      ...clearingOwner,
      tone: input.clearingSummary.openCount > 0 ? 'warning' : 'success',
    },
    {
      amount: input.bankSummary.amount,
      countLabel:
        input.bankSummary.unassignedCount > 0
          ? `${input.bankSummary.unassignedCount} unassigned`
          : `${input.bankSummary.unmatchedCount} unmatched`,
      currency: input.bankSummary.currency,
      detail: 'Company bank transactions missing explicit reconciliation evidence.',
      href: financeOwnedQueueHref(bankReconciliationHref(bankFilters), input.bankSummary.unassignedCount),
      label: 'Bank reconciliation unmatched',
      oldestLabel: financeOverviewOldestLabel(
        input.bankSummary.oldestUnassignedAt ?? input.bankSummary.oldestUnmatchedAt,
        input.bankSummary.unassignedCount || input.bankSummary.unmatchedCount,
      ),
      ...bankOwner,
      tone: input.bankSummary.unmatchedCount > 0 ? 'danger' : 'success',
    },
    {
      amount: partnerDepositQueueSummary.openAmount,
      countLabel: `${partnerDepositQueueSummary.openCount} open`,
      currency: partnerDepositQueueSummary.currency,
      detail: 'Executed Partner deposits whose GL bank debit is not fully matched to imported bank evidence.',
      href: financePartnerBankDepositReconciliationHref(
        partnerDepositQueueSummary.openCount > 0 &&
          partnerDepositQueueSummary.unassignedCount === partnerDepositQueueSummary.openCount
          ? 'unassigned'
          : undefined,
      ),
      label: 'Partner deposit reconciliation',
      oldestLabel: financeOverviewOldestLabel(
        partnerDepositQueueSummary.oldestOpenAt,
        partnerDepositQueueSummary.openCount,
      ),
      ...partnerDepositOwner,
      tone: partnerDepositQueueSummary.openCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.monthlyClosingSummary.payoutBankOutflowReconciliationOpenAmount,
      countLabel: `${input.monthlyClosingSummary.payoutBankOutflowReconciliationOpenCount} open`,
      currency: input.monthlyClosingSummary.currency,
      detail:
        'Paid Partner payout batches whose posted bank credit is not fully matched to an OUTFLOW bank transaction.',
      href: `/payouts?${new URLSearchParams({
        period: input.monthlyClosingSummary.period,
        status: 'PAID',
        evidence: 'bank-match-incomplete',
        sort: 'oldest',
        returnTo: '/finance-overview?view=queues',
      }).toString()}`,
      label: 'Payout bank outflow reconciliation',
      ownerLabel: `${input.monthlyClosingSummary.period} closeout`,
      ownerState: 'shared',
      tone: input.monthlyClosingSummary.payoutBankOutflowReconciliationOpenCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.monthlyClosingSummary.payoutReturnInflowReconciliationOpenAmount,
      countLabel: `${input.monthlyClosingSummary.payoutReturnInflowReconciliationOpenCount} open`,
      currency: input.monthlyClosingSummary.currency,
      detail:
        'Partner payout reversals whose posted bank debit is not fully matched to an INFLOW return transaction.',
      href: '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched&type=INFLOW',
      label: 'Payout return inflow reconciliation',
      ownerLabel: `${input.monthlyClosingSummary.period} closeout`,
      ownerState: 'shared',
      tone: input.monthlyClosingSummary.payoutReturnInflowReconciliationOpenCount > 0 ? 'danger' : 'success',
    },
    {
      countLabel: `${input.bankWithdrawalCandidateSummary.unassignedCount} unassigned`,
      detail: 'Open withdrawal reconciliation reviews without an accountable owner.',
      href: financeBankWithdrawalCandidateHref('all', 'eligible', 'unassigned'),
      label: 'Unassigned withdrawal reviews',
      oldestLabel: financeOverviewOldestLabel(
        financeOverviewOldestTimestamp(
          input.bankWithdrawalCandidateSummary.oldestStrongOccurredAt,
          input.bankWithdrawalCandidateSummary.oldestReviewOccurredAt,
        ),
        input.bankWithdrawalCandidateSummary.unassignedCount,
      ),
      assigneeLabel: `${input.bankWithdrawalCandidateSummary.unassignedCount} unassigned`,
      ownerLabel: 'Finance operations',
      ownerState: input.bankWithdrawalCandidateSummary.unassignedCount > 0 ? 'unassigned' : 'assigned',
      tone: input.bankWithdrawalCandidateSummary.unassignedCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.bankWithdrawalCandidateSummary.strongAmount,
      countLabel: `${input.bankWithdrawalCandidateSummary.strongCount} strong`,
      currency: input.bankWithdrawalCandidateSummary.currency,
      detail: `Exact transfer evidence ready for reconciliation. ${input.bankWithdrawalCandidateSummary.strongOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.strongOver48hCount} over 48h.`,
      href: financeBankWithdrawalCandidateHref('all', 'strong'),
      label: 'Strong withdrawal candidates',
      oldestLabel: financeOverviewOldestLabel(
        input.bankWithdrawalCandidateSummary.oldestStrongOccurredAt,
        input.bankWithdrawalCandidateSummary.strongCount,
      ),
      ...financeOverviewAssignedQueueOwner(
        input.bankWithdrawalCandidateSummary.assignedCount,
        input.bankWithdrawalCandidateSummary.unassignedCount,
        input.bankWithdrawalCandidateSummary.assignments,
      ),
      tone: input.bankWithdrawalCandidateSummary.strongCount > 0 ? 'danger' : 'success',
    },
    {
      amount: input.bankWithdrawalCandidateSummary.reviewAmount,
      countLabel: `${input.bankWithdrawalCandidateSummary.reviewCount} review`,
      currency: input.bankWithdrawalCandidateSummary.currency,
      detail: `Approximate transfer evidence requiring operator review. ${input.bankWithdrawalCandidateSummary.reviewOver24hCount} over 24h / ${input.bankWithdrawalCandidateSummary.reviewOver48hCount} over 48h.`,
      href: financeBankWithdrawalCandidateHref('all', 'review'),
      label: 'Withdrawal candidates to review',
      oldestLabel: financeOverviewOldestLabel(
        input.bankWithdrawalCandidateSummary.oldestReviewOccurredAt,
        input.bankWithdrawalCandidateSummary.reviewCount,
      ),
      ...financeOverviewAssignedQueueOwner(
        input.bankWithdrawalCandidateSummary.assignedCount,
        input.bankWithdrawalCandidateSummary.unassignedCount,
        input.bankWithdrawalCandidateSummary.assignments,
      ),
      tone:
        input.bankWithdrawalCandidateSummary.reviewOver48hCount > 0
          ? 'danger'
          : input.bankWithdrawalCandidateSummary.reviewCount > 0
            ? 'warning'
            : 'success',
    },
    {
      amount: cashDebtAmount,
      countLabel: cashDebtCountLabel,
      currency: input.cashSummary?.currency ?? input.monthlyClosingSummary.currency,
      detail: 'Partner negative wallet / cash receivable that can block payout or matching.',
      href: '/cash-settlements?range=all&queue=high-debt',
      label: 'Cash debt recovery',
      oldestLabel: financeOverviewOldestLabel(
        input.cashSummary?.oldestOpenAt,
        input.cashSummary?.rowCount ?? 0,
      ),
      ownerLabel: 'Cash debt operations',
      ownerState: 'shared',
      tone: cashDebtAmount > 0 ? 'danger' : 'success',
    },
    {
      countLabel: `${input.refundSummary?.openCount ?? 0} open`,
      detail: 'All-open refund cases requiring booking, payment, or reversal review.',
      href: '/refunds?range=all&review=open',
      label: 'Refund queue',
      oldestLabel: financeOverviewOldestLabel(
        input.refundSummary?.oldestOpenAt,
        input.refundSummary?.openCount ?? 0,
      ),
      ownerLabel: 'Refund operations',
      ownerState: 'shared',
      tone: (input.refundSummary?.openCount ?? 0) > 0 ? 'warning' : 'success',
    },
    {
      amount: input.withdrawalSummary.pendingWithdrawalPayableAmount,
      countLabel: `${input.withdrawalSummary.requested} requested`,
      currency: input.withdrawalSummary.currency,
      detail: 'Withdrawal payable exposure waiting for review or manual bank transfer.',
      href: '/payouts?withdrawalStatus=REVIEW_REQUIRED',
      label: 'Withdrawal payable',
      oldestLabel: financeOverviewOldestLabel(
        input.withdrawalSummary.oldestOpenAt,
        input.withdrawalSummary.requested,
      ),
      ownerLabel: 'Payout operations',
      ownerState: 'shared',
      tone: input.withdrawalSummary.requested > 0 ? 'warning' : 'success',
    },
    {
      amountLabel: `${payoutReviewCount} review · ${payoutHoldCount} hold`,
      countLabel: `${payoutOpenCount} open`,
      detail: `${adminCountLabel(payoutMissingTransferRefCount, 'open payout batch', 'open payout batches')} ${payoutMissingTransferRefCount === 1 ? 'is' : 'are'} missing a transfer reference. Review, payout hold, and transfer evidence stay separate from withdrawal requests.`,
      href: '/payouts',
      label: 'Payout batch review',
      ownerLabel: 'Payout operations',
      ownerState: 'assigned',
      tone:
        payoutReviewCount > 0 || payoutHoldCount > 0
          ? 'danger'
          : payoutOpenCount > 0 || payoutMissingTransferRefCount > 0
            ? 'warning'
            : 'success',
    },
    {
      countLabel: `${companyBankAccountApprovalSummary.pendingCount} pending`,
      detail: 'Company bank account create or update requests waiting for independent Finance approval.',
      href: '/finance-tax/approval-queue?view=bank-accounts',
      label: 'Bank account approval',
      oldestLabel: financeOverviewOldestLabel(
        companyBankAccountApprovalSummary.oldestRequestedAt,
        companyBankAccountApprovalSummary.pendingCount,
      ),
      ownerLabel: 'Finance approvals',
      ownerState: 'shared',
      tone:
        companyBankAccountApprovalSummary.over48hCount > 0
          ? 'danger'
          : companyBankAccountApprovalSummary.pendingCount > 0
            ? 'warning'
            : 'success',
    },
    {
      countLabel: adminCountLabel(taxProfileSummary.actionRequiredCount, 'Partner'),
      detail: `${taxProfileSummary.missingCount} missing · ${taxProfileSummary.pendingReviewCount} pending · ${adminCountLabel(taxProfileSummary.rejectedCount, 'rejected tax profile')} among settlement-active Partners.`,
      href: '/finance-tax/partner-withholding-tax',
      label: 'Partner tax profile review',
      ownerLabel: 'Tax operations',
      ownerState: 'shared',
      tone: taxProfileSummary.actionRequiredCount > 0 ? 'warning' : 'success',
    },
    {
      amount: generalLedgerDelta,
      countLabel: `${generalLedgerSummary.blockedCount} blocked · ${generalLedgerSummary.unknownCount} evidence unknown · ${generalLedgerSummary.draftCount} draft`,
      currency: generalLedgerSummary.currency,
      detail: `Individual journal batches must balance before close. Debit ${formatMoney(generalLedgerSummary.totalDebit, generalLedgerSummary.currency)} · credit ${formatMoney(generalLedgerSummary.totalCredit, generalLedgerSummary.currency)}.`,
      href: generalLedgerHref(financeAccountingFilters('all', 'needs-action')),
      label: 'Journal batch integrity',
      ownerLabel: 'Accounting',
      ownerState: 'shared',
      tone:
        generalLedgerSummary.blockedCount > 0
          ? 'danger'
          : generalLedgerSummary.draftCount > 0
            ? 'warning'
            : 'success',
    },
  ];

  const oldestAtByLabel = new Map<string, string | null | undefined>([
    ['Finance review SLA', input.financeReviewSlaSummary?.oldestOpenAt],
    [
      'Payment clearing open',
      input.clearingSummary.oldestUnassignedOpenAt ?? input.clearingSummary.oldestOpenAt,
    ],
    [
      'Bank reconciliation unmatched',
      input.bankSummary.oldestUnassignedAt ?? input.bankSummary.oldestUnmatchedAt,
    ],
    ['Partner deposit reconciliation', partnerDepositQueueSummary.oldestOpenAt],
    [
      'Unassigned withdrawal reviews',
      financeOverviewOldestTimestamp(
        input.bankWithdrawalCandidateSummary.oldestStrongOccurredAt,
        input.bankWithdrawalCandidateSummary.oldestReviewOccurredAt,
      ),
    ],
    ['Strong withdrawal candidates', input.bankWithdrawalCandidateSummary.oldestStrongOccurredAt],
    ['Withdrawal candidates to review', input.bankWithdrawalCandidateSummary.oldestReviewOccurredAt],
    ['Cash debt recovery', input.cashSummary?.oldestOpenAt],
    ['Refund queue', input.refundSummary?.oldestOpenAt],
    ['Withdrawal payable', input.withdrawalSummary.oldestOpenAt],
    ['Bank account approval', companyBankAccountApprovalSummary.oldestRequestedAt],
  ]);
  const breachedLabels = new Set<string>([
    ...((input.financeReviewSlaSummary?.openOver72Count ?? 0) > 0 ? ['Finance review SLA'] : []),
    ...(input.bankWithdrawalCandidateSummary.strongOver48hCount > 0
      ? ['Strong withdrawal candidates']
      : []),
    ...(input.bankWithdrawalCandidateSummary.reviewOver48hCount > 0
      ? ['Withdrawal candidates to review']
      : []),
    ...(companyBankAccountApprovalSummary.over48hCount > 0 ? ['Bank account approval'] : []),
  ]);

  return items.map((item, sourceIndex) => ({
    ...item,
    impactScore: item.amount ?? 0,
    oldestAgeMinutes: financeOverviewAgeMinutes(oldestAtByLabel.get(item.label)),
    slaBreached: breachedLabels.has(item.label),
    sourceIndex,
  }));
}

function financeOverviewTonePriority(tone: FinanceOverviewTone) {
  return tone === 'danger' ? 0 : tone === 'warning' ? 1 : tone === 'primary' ? 2 : 3;
}

function financeOverviewOwnerPriority(ownerState: FinanceOverviewActionItem['ownerState']) {
  return ownerState === 'unassigned' ? 0 : ownerState === 'shared' ? 1 : 2;
}

export function buildFinanceOverviewRangeLabel(range: FinanceOverviewRange) {
  return dateRangeLabel(range);
}

function financeOverviewMoneyValue(amount: number | null | undefined, currency: string) {
  return amount === null || amount === undefined ? {} : { amount, currency };
}

function emptyFinanceOverviewPartnerDepositQueueSummary(): AdminFinanceOverviewPartnerDepositQueueSummary {
  return {
    assignedCount: 0,
    assignments: [],
    currency: 'VND',
    oldestOpenAt: null,
    openAmount: 0,
    openCount: 0,
    unassignedCount: 0,
  };
}

function emptyCompanyBankAccountApprovalSummary(): AdminCompanyBankAccountApprovalSummary {
  return {
    oldestRequestedAt: null,
    over48hCount: 0,
    pendingCount: 0,
  };
}

function emptyFinanceOverviewGeneralLedgerSummary(): AdminAccountingJournalBatchSummary {
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

function emptyFinanceOverviewTaxProfileSummary(): AdminFinanceOverviewTaxProfileSummary {
  return {
    actionRequiredCount: 0,
    approvedCount: 0,
    missingCount: 0,
    pendingReviewCount: 0,
    rejectedCount: 0,
    relevantPartnerCount: 0,
  };
}

function financeOverviewOldestLabel(value: string | null | undefined, openCount: number) {
  if (openCount <= 0) return 'No waiting item';
  return value ? `Oldest ${formatRelativeAge(value)}` : 'Oldest time unavailable';
}

function financeOverviewOldestTimestamp(...values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? null
  );
}

function financeOverviewAgeMinutes(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, Math.floor((nowMs - timestamp) / 60_000)) : 0;
}

function financeOverviewAssignedQueueOwner(
  assignedCount: number,
  unassignedCount: number,
  assignments: ReadonlyArray<{
    readonly assignee?: { readonly email?: string | null; readonly fullName?: string | null } | null;
    readonly count: number;
  }>,
): Pick<FinanceOverviewActionItem, 'assigneeLabel' | 'ownerLabel' | 'ownerState'> {
  if (unassignedCount > 0) {
    return {
      assigneeLabel: `${unassignedCount} unassigned`,
      ownerLabel: 'Finance operations',
      ownerState: 'unassigned',
    };
  }
  if (assignedCount <= 0) {
    return { ownerLabel: 'Finance operations', ownerState: 'assigned' };
  }
  if (assignments.length === 0) {
    return {
      assigneeLabel: `${assignedCount} assigned`,
      ownerLabel: 'Finance operations',
      ownerState: 'assigned',
    };
  }
  if (assignments.length === 1) {
    const owner = assignments[0]?.assignee;
    return {
      assigneeLabel: owner?.fullName?.trim() || owner?.email?.trim() || `${assignedCount} assigned`,
      ownerLabel: 'Finance operations',
      ownerState: 'assigned',
    };
  }
  return {
    assigneeLabel: `${assignedCount} assigned · ${assignments.length} operators`,
    ownerLabel: 'Finance operations',
    ownerState: 'assigned',
  };
}

function emptyFinanceOverviewComparisonSummary(): AdminFinanceOverviewComparisonSummary {
  const emptyMetric = (): AdminFinanceOverviewComparisonMetric => ({
    current: 0,
    delta: 0,
    deltaPercent: null,
    previous: 0,
  });

  return {
    previousRangeLabel: 'Previous period',
    settlementCount: emptyMetric(),
    customerPaymentAmount: emptyMetric(),
    partnerPayoutAmount: emptyMetric(),
    platformFeeNetRevenue: emptyMetric(),
  };
}

function financeOverviewComparisonCountDetail(
  metric: AdminFinanceOverviewComparisonMetric,
  previousRangeLabel: string,
) {
  return `${previousRangeLabel}: ${metric.previous} · ${financeOverviewComparisonDeltaLabel(metric)}`;
}

function financeOverviewComparisonMoneyDetail(
  metric: AdminFinanceOverviewComparisonMetric,
  previousRangeLabel: string,
  currency: string,
) {
  return `${previousRangeLabel}: ${formatMoney(metric.previous, currency)} · ${financeOverviewComparisonDeltaLabel(metric)}`;
}

function financeOverviewComparisonDeltaLabel(metric: AdminFinanceOverviewComparisonMetric) {
  if (metric.deltaPercent === null) {
    return metric.current === 0 ? 'No activity in either period' : 'No comparable prior data';
  }

  const sign = metric.deltaPercent > 0 ? '+' : '';
  return `${sign}${metric.deltaPercent}%`;
}

function financeOverviewGrowthTone(metric: AdminFinanceOverviewComparisonMetric): FinanceOverviewTone {
  if (metric.deltaPercent === null || metric.deltaPercent === 0) return 'info';
  return metric.deltaPercent > 0 ? 'success' : 'warning';
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

function financeSettlementFilters(range: AdminDateRange): BookingSettlementFilters {
  return {
    page: 1,
    range,
    review: 'all',
    take: TAX_SETTLEMENT_DEFAULT_TAKE,
  };
}

function financeAccountingFilters(
  range: AdminDateRange,
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
