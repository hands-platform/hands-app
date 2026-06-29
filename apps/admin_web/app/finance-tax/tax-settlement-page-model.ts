import type {
  AdminBookingSettlementSnapshotSummary,
  AdminPaymentFeeSummary,
  AdminPlatformVatSummary,
  AdminMonthlyTaxClosing,
  AdminMonthlyTaxClosingSummary,
  AdminPartnerWithholdingTaxSummary,
} from '../../lib/admin-api';
import type { AdminDateRange } from '../../lib/date-range';
import { buildCsvDataHref } from '../../lib/csv-export';
import { formatMoney } from '../../lib/admin-format';
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

export type BookingSettlementFilters = {
  readonly range: AdminDateRange;
  readonly review: BookingSettlementReview;
  readonly take: number;
};

export type PartnerWithholdingTaxFilters = {
  readonly period: string;
  readonly take: number;
};

export type MonthlyTaxClosingFilters = {
  readonly period: string;
  readonly take: number;
};

export const TAX_SETTLEMENT_DEFAULT_TAKE = 25;
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

export function readBookingSettlementFilters(
  params: Record<string, string | string[] | undefined>,
): BookingSettlementFilters {
  return {
    range: normalizeDateRange(readSearchParam(params.range)),
    review: normalizeBookingSettlementReview(readSearchParam(params.review)),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function readPartnerWithholdingTaxFilters(
  params: Record<string, string | string[] | undefined>,
): PartnerWithholdingTaxFilters {
  return {
    period: normalizeTaxPeriod(readSearchParam(params.period)),
    take: boundedTake(readSearchParam(params.take)),
  };
}

export function readMonthlyTaxClosingFilters(
  params: Record<string, string | string[] | undefined>,
): MonthlyTaxClosingFilters {
  return {
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
  return `/admin/booking-settlement-snapshots?${params.toString()}`;
}

export function buildBookingSettlementSnapshotSummaryApiHref(filters: BookingSettlementFilters) {
  const params = new URLSearchParams({ range: filters.range });
  if (filters.review !== 'all') {
    params.set('review', filters.review);
  }
  return `/admin/booking-settlement-snapshots/summary?${params.toString()}`;
}

export function buildPartnerWithholdingTaxApiHref(filters: PartnerWithholdingTaxFilters) {
  return `/admin/partner-withholding-tax?${new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  }).toString()}`;
}

export function buildPartnerWithholdingTaxSummaryApiHref(filters: PartnerWithholdingTaxFilters) {
  return `/admin/partner-withholding-tax/summary?${new URLSearchParams({
    period: filters.period,
  }).toString()}`;
}

export function buildMonthlyTaxClosingApiHref(filters: MonthlyTaxClosingFilters) {
  return `/admin/monthly-tax-closings?${new URLSearchParams({
    period: filters.period,
    take: String(filters.take),
  }).toString()}`;
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
  return `/finance-tax/booking-settlement-audit?${params.toString()}`;
}

export function partnerWithholdingTaxHref(filters: PartnerWithholdingTaxFilters) {
  return `/finance-tax/partner-withholding-tax?${new URLSearchParams({ period: filters.period }).toString()}`;
}

export function monthlyTaxClosingHref(filters: MonthlyTaxClosingFilters) {
  return `/finance-tax/monthly-tax-closing?${new URLSearchParams({ period: filters.period }).toString()}`;
}

export function platformVatHref(filters: MonthlyTaxClosingFilters) {
  return `/finance-tax/platform-vat?${new URLSearchParams({ period: filters.period }).toString()}`;
}

export function paymentFeeHref(filters: MonthlyTaxClosingFilters) {
  return `/finance-tax/payment-fees?${new URLSearchParams({ period: filters.period }).toString()}`;
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
      helper: 'Immutable booking settlement snapshots matching the active queue.',
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
      helper: 'Customer payment amount captured by settlement snapshots.',
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
      href: partnerWithholdingTaxHref({ period: withholdingSummary.period, take: TAX_SETTLEMENT_DEFAULT_TAKE }),
    },
    {
      label: 'Company VAT',
      value: formatMoney(settlementSummary.companyOutputVat, currency),
      helper: 'Output VAT component from HANDS platform fee snapshots.',
    },
    {
      label: 'Payment fees',
      value: formatMoney(settlementSummary.paymentProcessingFee, currency),
      helper: 'Payment processing fee cost recorded on settlement snapshots.',
    },
    {
      label: 'Partners with revenue',
      value: withholdingSummary.partnerCountWithRevenue,
      helper: 'Partners with taxable settlement rows in the selected period.',
      href: partnerWithholdingTaxHref({ period: withholdingSummary.period, take: TAX_SETTLEMENT_DEFAULT_TAKE }),
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

export function emptyPartnerWithholdingTaxSummary(period = normalizeTaxPeriod('')): AdminPartnerWithholdingTaxSummary {
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

export function emptyMonthlyTaxClosingSummary(period = normalizeTaxPeriod('')): AdminMonthlyTaxClosingSummary {
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
      helper: 'Settlement snapshots included in this monthly tax period.',
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

export function buildPlatformVatMetrics(summary: AdminPlatformVatSummary) {
  return [
    {
      label: 'Settlements',
      value: summary.settlementCount,
      helper: 'Settlement snapshots included in this platform VAT period.',
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
      helper: 'Settlement snapshots included in this payment fee period.',
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

export function buildMonthlyTaxClosingRowsCsvHref(rows: AdminMonthlyTaxClosing[]) {
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

function normalizeBookingSettlementReview(value: string): BookingSettlementReview {
  return BOOKING_SETTLEMENT_REVIEW_VALUES.includes(value as BookingSettlementReview)
    ? (value as BookingSettlementReview)
    : 'open';
}

function normalizeTaxPeriod(value: string) {
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
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
