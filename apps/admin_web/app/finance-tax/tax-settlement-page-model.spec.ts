import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildTaxFinanceMetrics,
  readBookingSettlementFilters,
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
});
