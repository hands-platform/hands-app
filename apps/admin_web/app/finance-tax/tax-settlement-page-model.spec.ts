import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingSummaryApiHref,
  buildTaxFinanceMetrics,
  buildMonthlyTaxClosingMetrics,
  readBookingSettlementFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from './tax-settlement-page-model';

describe('tax settlement page model', () => {
  it('defaults booking settlement audit to a bounded today needs-action queue', () => {
    const filters = readBookingSettlementFilters({});

    expect(filters).toEqual({
      range: 'today',
      review: 'open',
      take: 25,
    });
    expect(buildBookingSettlementSnapshotApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots?range=today&review=open&take=25',
    );
    expect(buildBookingSettlementSnapshotSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/summary?range=today&review=open',
    );
  });

  it('keeps partner withholding tax grouped by explicit monthly period', () => {
    const filters = readPartnerWithholdingTaxFilters({ period: '2026-06', take: '75' });

    expect(filters).toEqual({
      period: '2026-06',
      take: 75,
    });
    expect(buildPartnerWithholdingTaxApiHref(filters)).toBe(
      '/admin/partner-withholding-tax?period=2026-06&take=75',
    );
    expect(buildPartnerWithholdingTaxSummaryApiHref(filters)).toBe(
      '/admin/partner-withholding-tax/summary?period=2026-06',
    );
  });

  it('loads monthly tax closing with a bounded monthly period list', () => {
    const filters = readMonthlyTaxClosingFilters({ period: '2026-06', take: '50' });

    expect(filters).toEqual({
      period: '2026-06',
      take: 50,
    });
    expect(buildMonthlyTaxClosingApiHref(filters)).toBe(
      '/admin/monthly-tax-closings?period=2026-06&take=50',
    );
    expect(buildMonthlyTaxClosingSummaryApiHref(filters)).toBe(
      '/admin/monthly-tax-closings/summary?period=2026-06',
    );
  });

  it('builds overview metrics from summary APIs without list data', () => {
    const metrics = buildTaxFinanceMetrics(
      {
        count: 4,
        currency: 'VND',
        customerPaymentAmount: 2_000_000,
        partnerPayoutAmount: 1_420_000,
        partnerWithholdingTotal: 120_000,
        platformFeeGross: 420_000,
        platformFeeNetRevenue: 381_818,
        companyOutputVat: 38_182,
        paymentProcessingFee: 20_000,
        openTaxCount: 3,
        paidTaxCount: 1,
      },
      {
        period: '2026-06',
        currency: 'VND',
        partnerCountWithRevenue: 2,
        taxableBookingCount: 4,
        grossServiceRevenue: 2_000_000,
        partnerPayoutTotal: 1_420_000,
        partnerVatWithheldTotal: 80_000,
        partnerPitWithheldTotal: 40_000,
        totalPartnerTaxWithheld: 120_000,
      },
    );

    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Snapshot rows', 4],
      ['Open tax rows', 3],
      ['Customer paid', '2.000.000 VND'],
      ['Partner payout', '1.420.000 VND'],
      ['Partner tax withheld', '120.000 VND'],
      ['Company VAT', '38.182 VND'],
      ['Payment fees', '20.000 VND'],
      ['Partners with revenue', 2],
    ]);
  });

  it('builds monthly closing metrics with reconciliation signals', () => {
    const metrics = buildMonthlyTaxClosingMetrics({
      id: 'closing-1',
      period: '2026-06',
      currency: 'VND',
      status: 'DRAFT',
      settlementCount: 2,
      customerPaymentAmountTotal: 1_200_000,
      partnerPayoutTotal: 860_000,
      platformFeeGrossTotal: 256_000,
      platformFeeNetRevenueTotal: 237_038,
      companyOutputVatTotal: 18_962,
      partnerVatWithheldTotal: 60_000,
      partnerPitWithheldTotal: 24_000,
      partnerWithholdingTotal: 84_000,
      paymentProcessingFeeTotal: 0,
      cashDebtTotal: 170_000,
      nonCashPartnerPayoutTotal: 430_000,
      partnerCountWithRevenue: 1,
      openTaxCount: 1,
      paidTaxCount: 1,
      reconciliationDelta: 0,
      netRevenueDelta: 0,
      declaredAt: null,
      paidAt: null,
      closedAt: null,
      notes: null,
    });

    expect(metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Period status', 'DRAFT'],
      ['Settlements', 2],
      ['Customer paid', '1.200.000 VND'],
      ['Partner withholding', '84.000 VND'],
      ['Company output VAT', '18.962 VND'],
      ['Payment fees', '0 VND'],
      ['Formula delta', '0 VND'],
      ['Net revenue delta', '0 VND'],
    ]);
  });
});
