import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxRowsCsvHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  buildProviderWalletWithdrawalRequestSummaryApiHref,
  buildPaymentFeeMetrics,
  buildPaymentFeeSummaryCsvHref,
  buildPaymentFeeSummaryApiHref,
  buildPlatformVatMetrics,
  buildPlatformVatSummaryCsvHref,
  buildPlatformVatSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildFinancePayoutPriorityLinks,
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingAccountingJournalCsvHref,
  buildMonthlyTaxClosingRowsCsvHref,
  buildMonthlyTaxClosingSummaryCsvHref,
  buildMonthlyTaxClosingSummaryApiHref,
  monthlyTaxClosingNextStatusOptions,
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

  it('builds platform VAT and payment fee summary API hrefs from the same monthly period filter', () => {
    const filters = readMonthlyTaxClosingFilters({ period: '2026-06' });

    expect(buildPlatformVatSummaryApiHref(filters)).toBe('/admin/platform-vat/summary?period=2026-06');
    expect(buildPaymentFeeSummaryApiHref(filters)).toBe('/admin/payment-fees/summary?period=2026-06');
  });

  it('builds provider wallet withdrawal summary API hrefs from the booking range filter', () => {
    const filters = readBookingSettlementFilters({ range: '7d', review: 'open' });

    expect(buildProviderWalletWithdrawalRequestSummaryApiHref(filters)).toBe(
      '/admin/provider-wallet/withdrawal-requests/summary?range=7d',
    );
  });

  it('builds tax finance workflow links while preserving active filters and excluding the current page', () => {
    const settlementFilters = readBookingSettlementFilters({ range: '7d', review: 'paid', take: '50' });
    const monthlyFilters = readMonthlyTaxClosingFilters({ period: '2026-06', take: '75' });
    const withholdingFilters = readPartnerWithholdingTaxFilters({ period: '2026-06', take: '75' });

    const links = buildTaxFinanceWorkflowLinks({
      current: 'platform-vat',
      monthlyFilters,
      settlementFilters,
      withholdingFilters,
    });

    expect(links.map((link) => [link.label, link.href])).toEqual([
      ['Tax overview', '/finance-tax'],
      ['Booking settlement audit', '/finance-tax/booking-settlement-audit?range=7d&review=paid'],
      ['Monthly tax closing', '/finance-tax/monthly-tax-closing?period=2026-06'],
      ['Payment fees', '/finance-tax/payment-fees?period=2026-06'],
      ['Partner withholding tax', '/finance-tax/partner-withholding-tax?period=2026-06'],
    ]);
  });

  it('builds payout priority shortcuts without adding list payload to tax overview', () => {
    const settlementFilters = readBookingSettlementFilters({ range: '7d', review: 'open' });

    expect(buildFinancePayoutPriorityLinks(settlementFilters).map((link) => [link.label, link.href])).toEqual([
      ['Withdrawal requested', '/payouts?range=7d&withdrawalStatus=REQUESTED'],
      ['Review required', '/payouts?range=7d&withdrawalStatus=REVIEW_REQUIRED'],
      ['Bank transfer pending', '/payouts?range=7d&withdrawalStatus=BANK_TRANSFER_PENDING'],
      ['Cash debt gate', '/cash-settlements?range=7d'],
    ]);
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

  it('limits monthly tax closing status actions to the next safe status', () => {
    expect(monthlyTaxClosingNextStatusOptions('DRAFT').map((option) => option.value)).toEqual(['REVIEWED']);
    expect(monthlyTaxClosingNextStatusOptions('REVIEWED').map((option) => option.value)).toEqual(['DECLARED']);
    expect(monthlyTaxClosingNextStatusOptions('DECLARED').map((option) => option.value)).toEqual(['PAID']);
    expect(monthlyTaxClosingNextStatusOptions('PAID').map((option) => option.value)).toEqual(['CLOSED']);
    expect(monthlyTaxClosingNextStatusOptions('CLOSED')).toEqual([]);
    expect(monthlyTaxClosingNextStatusOptions('REVERSED')).toEqual([]);
  });

  it('exports monthly tax closing summary and stored rows with visible totals', () => {
    const summaryCsv = decodeURIComponent(
      buildMonthlyTaxClosingSummaryCsvHref({
        id: null,
        period: '2026-06',
        currency: 'VND',
        status: 'DRAFT',
        settlementCount: 2,
        customerPaymentAmountTotal: 1200000,
        partnerPayoutTotal: 860000,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        partnerVatWithheldTotal: 60000,
        partnerPitWithheldTotal: 24000,
        partnerWithholdingTotal: 84000,
        paymentProcessingFeeTotal: 0,
        cashDebtTotal: 170000,
        nonCashPartnerPayoutTotal: 430000,
        partnerCountWithRevenue: 1,
        openTaxCount: 1,
        paidTaxCount: 1,
        reconciliationDelta: 0,
        netRevenueDelta: 0,
      }),
    );
    const rowsCsv = decodeURIComponent(
      buildMonthlyTaxClosingRowsCsvHref([
        {
          id: 'closing-1',
          period: '2026-06',
          currency: 'VND',
          status: 'DECLARED',
          settlementCount: 2,
          platformFeeGrossTotal: 256000,
          platformFeeNetRevenueTotal: 237038,
          companyOutputVatTotal: 18962,
          partnerVatWithheldTotal: 60000,
          partnerPitWithheldTotal: 24000,
          partnerWithholdingTotal: 84000,
          paymentProcessingFeeTotal: 0,
          cashDebtTotal: 170000,
          nonCashPartnerPayoutTotal: 430000,
          createdAt: '2026-06-30T00:00:00.000Z',
          updatedAt: '2026-06-30T00:00:00.000Z',
        },
      ]),
    );

    expect(summaryCsv).toContain('"customer_payment_amount_total"');
    expect(summaryCsv).toContain('"1200000"');
    expect(summaryCsv).toContain('"partner_withholding_total"');
    expect(summaryCsv).toContain('"84000"');
    expect(rowsCsv).toContain('"closing-1"');
    expect(rowsCsv).toContain('"company_output_vat_total"');
    expect(rowsCsv).toContain('"18962"');
  });

  it('exports partner monthly withholding tax rows as CSV', () => {
    const rowsCsv = decodeURIComponent(
      buildPartnerWithholdingTaxRowsCsvHref([
        {
          providerProfileId: 'provider-1',
          partnerName: 'Smoke Partner',
          partnerPhone: '+84900000001',
          period: '2026-06',
          currency: 'VND',
          completedBookingCount: 3,
          grossServiceRevenue: 1_800_000,
          partnerPayoutTotal: 1_290_000,
          partnerVatWithheldTotal: 90_000,
          partnerPitWithheldTotal: 36_000,
          totalPartnerTaxWithheld: 126_000,
        },
      ]),
    );

    expect(rowsCsv).toContain('"provider_profile_id","period","currency"');
    expect(rowsCsv).toContain('"provider-1","2026-06","VND","Smoke Partner"');
    expect(rowsCsv).toContain("\"'+84900000001\"");
    expect(rowsCsv).toContain('"1800000"');
    expect(rowsCsv).toContain('"126000"');
  });

  it('exports booking settlement snapshot rows as CSV', () => {
    const rowsCsv = decodeURIComponent(
      buildBookingSettlementSnapshotRowsCsvHref([
        {
          id: 'snapshot-1',
          bookingId: 'booking-1',
          customerProfileId: 'customer-1',
          providerProfileId: 'provider-1',
          paymentId: 'payment-1',
          providerEarningId: 'earning-1',
          paymentMethod: 'MOMO',
          currency: 'VND',
          customerPaymentAmount: 600_000,
          partnerPayoutAmount: 430_000,
          partnerTaxableRevenue: 600_000,
          partnerVatAmount: 30_000,
          partnerPitAmount: 12_000,
          partnerWithholdingTotal: 42_000,
          platformFeeGross: 128_000,
          platformFeeNetRevenue: 118_519,
          companyOutputVat: 9_481,
          paymentProcessingFee: 0,
          settlementStatus: 'POSTED',
          taxStatus: 'OPEN',
          monthlyPeriod: '2026-06',
          postedAt: '2026-06-13T03:02:00.000Z',
          closedAt: null,
          booking: {
            id: 'booking-1',
            createdAt: '2026-06-13T02:40:00.000Z',
            status: 'COMPLETED',
            closedAt: '2026-06-13T03:02:00.000Z',
          },
          customerProfile: {
            id: 'customer-1',
            user: { id: 'user-customer', fullName: 'Demo Customer', phone: '+84900000001' },
          },
          providerProfile: {
            id: 'provider-1',
            displayName: 'Smoke Partner',
            user: { id: 'user-provider', fullName: 'Smoke Partner Legal', phone: '+84900000002' },
          },
        },
      ]),
    );

    expect(rowsCsv).toContain('"snapshot_id","booking_id","monthly_period"');
    expect(rowsCsv).toContain('"snapshot-1","booking-1","2026-06"');
    expect(rowsCsv).toContain('"Demo Customer"');
    expect(rowsCsv).toContain("\"'+84900000001\"");
    expect(rowsCsv).toContain('"Smoke Partner"');
    expect(rowsCsv).toContain("\"'+84900000002\"");
    expect(rowsCsv).toContain('"600000"');
    expect(rowsCsv).toContain('"128000"');
    expect(rowsCsv).toContain('"118519"');
    expect(rowsCsv).toContain('"9481"');
  });

  it('exports a monthly accounting journal CSV from visible closing totals', () => {
    const journalCsv = decodeURIComponent(
      buildMonthlyTaxClosingAccountingJournalCsvHref({
        id: null,
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
        paymentProcessingFeeTotal: 10_000,
        cashDebtTotal: 170_000,
        nonCashPartnerPayoutTotal: 430_000,
        partnerCountWithRevenue: 1,
        openTaxCount: 1,
        paidTaxCount: 1,
        reconciliationDelta: 0,
        netRevenueDelta: 0,
      }),
    );

    expect(journalCsv).toContain('"entry","period","currency","direction","account","amount","memo"');
    expect(journalCsv).toContain('"customer_payment_clearing","2026-06","VND","DEBIT"');
    expect(journalCsv).toContain('"partner_wallet_liability","2026-06","VND","CREDIT"');
    expect(journalCsv).toContain('"partner_vat_pit_payable","2026-06","VND","CREDIT"');
    expect(journalCsv).toContain('"platform_fee_net_revenue","2026-06","VND","CREDIT"');
    expect(journalCsv).toContain('"company_output_vat_payable","2026-06","VND","CREDIT"');
    expect(journalCsv).toContain('"payment_processing_fee_clearing","2026-06","VND","CREDIT"');
    expect(journalCsv).toContain('"partner_receivable_cash_debt","2026-06","VND","DEBIT"');
    expect(journalCsv).toContain('"237038"');
    expect(journalCsv).toContain('Closed periods require reversal entries, not direct edits.');
  });

  it('builds platform VAT and payment fee metrics from summary-only APIs', () => {
    expect(
      buildPlatformVatMetrics({
        period: '2026-06',
        currency: 'VND',
        settlementCount: 2,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        netRevenueDelta: 0,
        rateBreakdown: [],
      }).map((metric) => [metric.label, metric.value]),
    ).toEqual([
      ['Settlements', 2],
      ['Platform fee gross', '256.000 VND'],
      ['Company output VAT', '18.962 VND'],
      ['Net revenue', '237.038 VND'],
      ['Formula delta', '0 VND'],
    ]);
    expect(
      buildPaymentFeeMetrics({
        period: '2026-06',
        currency: 'VND',
        settlementCount: 2,
        customerPaymentAmountTotal: 1200000,
        paymentProcessingFeeTotal: 10000,
        byPaymentMethod: [],
        byPayer: [],
        byTreatment: [],
      }).map((metric) => [metric.label, metric.value]),
    ).toEqual([
      ['Settlements', 2],
      ['Customer paid', '1.200.000 VND'],
      ['Payment fees', '10.000 VND'],
    ]);
  });

  it('exports platform VAT and payment fee summary breakdowns as CSV', () => {
    const platformVatCsv = decodeURIComponent(
      buildPlatformVatSummaryCsvHref({
        period: '2026-06',
        currency: 'VND',
        settlementCount: 2,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        netRevenueDelta: 0,
        rateBreakdown: [
          {
            category: 'REDUCED_8',
            platformVatRateBps: 800,
            settlementCount: 2,
            platformFeeGrossTotal: 256000,
            platformFeeNetRevenueTotal: 237038,
            companyOutputVatTotal: 18962,
          },
        ],
      }),
    );
    const paymentFeeCsv = decodeURIComponent(
      buildPaymentFeeSummaryCsvHref({
        period: '2026-06',
        currency: 'VND',
        settlementCount: 2,
        customerPaymentAmountTotal: 1200000,
        paymentProcessingFeeTotal: 10000,
        byPaymentMethod: [
          {
            paymentMethod: 'MOMO',
            settlementCount: 1,
            customerPaymentAmountTotal: 600000,
            paymentProcessingFeeTotal: 10000,
          },
        ],
        byPayer: [
          {
            paymentFeePayer: 'HANDS',
            settlementCount: 2,
            customerPaymentAmountTotal: 1200000,
            paymentProcessingFeeTotal: 10000,
          },
        ],
        byTreatment: [
          {
            paymentFeeTreatment: 'OPERATING_EXPENSE',
            settlementCount: 2,
            customerPaymentAmountTotal: 1200000,
            paymentProcessingFeeTotal: 10000,
          },
        ],
      }),
    );

    expect(platformVatCsv).toContain('"section","period","currency"');
    expect(platformVatCsv).toContain('"summary","2026-06","VND"');
    expect(platformVatCsv).toContain('"rate_breakdown","2026-06","VND","REDUCED_8"');
    expect(platformVatCsv).toContain('"18962"');
    expect(paymentFeeCsv).toContain('"method_breakdown","2026-06","VND","MOMO"');
    expect(paymentFeeCsv).toContain('"payer_breakdown","2026-06","VND","HANDS"');
    expect(paymentFeeCsv).toContain('"treatment_breakdown","2026-06","VND","OPERATING_EXPENSE"');
    expect(paymentFeeCsv).toContain('"10000"');
  });
});
