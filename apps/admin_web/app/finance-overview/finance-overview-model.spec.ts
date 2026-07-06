import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewControlMetrics,
  buildFinanceOverviewKpis,
  buildFinanceOverviewPrimaryKpis,
  buildFinanceOverviewSections,
  emptyFinanceOverviewSummaries,
  financeOverviewHref,
  normalizeFinanceOverviewRange,
} from './finance-overview-model';
import {
  emptyBankReconciliationSummary,
  emptyBookingPaymentClearingSummary,
  emptyBookingSettlementSummary,
  emptyCouponFinanceSummary,
  emptyMonthlyTaxClosingSummary,
  emptyPartnerWithholdingTaxSummary,
  emptyProviderWalletWithdrawalRequestSummary,
} from '../finance-tax/tax-settlement-page-model';

describe('finance-overview-model', () => {
  it('normalizes supported finance overview ranges', () => {
    expect(normalizeFinanceOverviewRange(undefined)).toBe('today');
    expect(normalizeFinanceOverviewRange('7d')).toBe('7d');
    expect(normalizeFinanceOverviewRange('30d')).toBe('30d');
    expect(normalizeFinanceOverviewRange('90d')).toBe('90d');
    expect(normalizeFinanceOverviewRange('bad')).toBe('today');
  });

  it('builds summary API hrefs from one bounded range', () => {
    const hrefs = buildFinanceOverviewApiHrefs({ range: '7d', period: '2026-07' });

    expect(hrefs.overviewSummaryHref).toBe('/admin/finance-overview?range=7d&period=2026-07');
    expect(hrefs.settlementSummaryHref).toBe('/admin/booking-settlement-snapshots/summary?range=7d');
    expect(hrefs.couponSummaryHref).toBe('/admin/booking-settlement-snapshots/coupon-finance-summary?range=7d');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=7d');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=7d');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
    expect(hrefs.withdrawalSummaryHref).toBe('/admin/provider-wallet/withdrawal-requests/summary?range=7d');
    expect(hrefs.paymentFeeSummaryHref).toBe('/admin/payment-fees/summary?period=2026-07');
  });

  it('keeps gross customer payment separate from company revenue', () => {
    const settlementSummary = {
      ...emptyBookingSettlementSummary(),
      customerPaymentAmount: 100_000_000,
      partnerPayoutAmount: 76_000_000,
      platformFeeGross: 24_000_000,
      platformFeeNetRevenue: 22_000_000,
      paymentProcessingFee: 1_000_000,
    };
    const couponSummary = {
      ...emptyCouponFinanceSummary(),
      companyCouponExpense: 2_000_000,
    };

    const kpis = buildFinanceOverviewKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      bankSummary: emptyBankReconciliationSummary(),
      cashSummary: null,
      clearingSummary: emptyBookingPaymentClearingSummary(),
      couponSummary,
      earningsSummary: null,
      monthlyClosingSummary: emptyMonthlyTaxClosingSummary('2026-07'),
      partnerWithholdingSummary: emptyPartnerWithholdingTaxSummary('2026-07'),
      paymentSummary: null,
      payoutSummary: null,
      refundSummary: null,
      settlementSummary,
      withdrawalSummary: emptyProviderWalletWithdrawalRequestSummary(),
    });

    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')?.value).toContain('100.000.000');
    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')).toMatchObject({
      amount: 100_000_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Platform Fee')?.value).toContain('22.000.000');
    expect(kpis.find((kpi) => kpi.label === 'Net Platform Revenue Estimate')?.value).toContain(
      '19.000.000',
    );
    expect(kpis.find((kpi) => kpi.label === 'Reconciliation Issues')?.amount).toBeUndefined();
    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')?.detail).toContain(
      'not company revenue',
    );
  });

  it('uses exact wallet, refund, and failed payment amounts when the Finance Overview API provides them', () => {
    const kpis = buildFinanceOverviewKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedAmount: 75_000,
        refundCompletedAmount: 60_000,
        refundPendingAmount: 40_000,
      },
      walletSummary: {
        currency: 'VND',
        customerWalletAccountCount: 2,
        customerWalletLiabilityAmount: 130_000,
        negativePartnerWalletAmount: 70_000,
        partnerNegativeWalletAccountCount: 1,
        partnerPositiveWalletAccountCount: 1,
        partnerWalletLiabilityAmount: 200_000,
      },
    });

    expect(kpis.find((kpi) => kpi.label === 'Customer Wallet Liability')?.value).toContain('130.000');
    expect(kpis.find((kpi) => kpi.label === 'Partner Wallet Liability')?.value).toContain('200.000');
    expect(kpis.find((kpi) => kpi.label === 'Negative Partner Wallet')?.value).toContain('70.000');
    expect(kpis.find((kpi) => kpi.label === 'Refund Pending Amount')?.value).toContain('40.000');
    expect(kpis.find((kpi) => kpi.label === 'Refund Completed Amount')?.value).toContain('60.000');
    expect(kpis.find((kpi) => kpi.label === 'Payment Failed Amount')?.value).toContain('75.000');
  });

  it('keeps money metadata on finance section rows for shared MoneyText rendering', () => {
    const sections = buildFinanceOverviewSections({
      ...emptyFinanceOverviewSummaries('2026-07'),
      couponSummary: { ...emptyCouponFinanceSummary(), companyCouponExpense: 2_000_000 },
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        customerPaymentAmount: 100_000_000,
        platformFeeNetRevenue: 22_000_000,
      },
    });
    const revenueRows = sections.find((section) => section.title === 'Revenue & Platform Fee')?.rows ?? [];

    expect(revenueRows.find((row) => row.label === 'Gross booking amount')).toMatchObject({
      amount: 100_000_000,
      currency: 'VND',
    });
    expect(revenueRows.find((row) => row.label === 'Gross booking amount')?.value).toBeUndefined();
    expect(revenueRows.find((row) => row.label === 'Platform fee net revenue')?.value).toBeUndefined();
    expect(revenueRows.find((row) => row.label === 'Company coupon cost')?.value).toBeUndefined();
  });

  it('selects six top-level KPI cards for the overview wall', () => {
    const primaryKpis = buildFinanceOverviewPrimaryKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedAmount: 75_000,
        refundCompletedAmount: 60_000,
        refundPendingAmount: 40_000,
      },
      couponSummary: { ...emptyCouponFinanceSummary(), companyCouponExpense: 2_000_000 },
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        customerPaymentAmount: 100_000_000,
        partnerPayoutAmount: 76_000_000,
        platformFeeNetRevenue: 22_000_000,
        paymentProcessingFee: 1_000_000,
      },
    });

    expect(primaryKpis.map((kpi) => kpi.label)).toEqual([
      'Gross Booking Amount',
      'Platform Fee',
      'Net Platform Revenue Estimate',
      'Partner Payout Pending',
      'Payment Failed Amount',
      'Reconciliation Issues',
    ]);
    expect(primaryKpis).toHaveLength(6);
  });

  it('builds an operator-first finance control board from summary data', () => {
    const metrics = buildFinanceOverviewControlMetrics({
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedAmount: 75_000,
        refundCompletedAmount: 60_000,
        refundPendingAmount: 40_000,
      },
      bankSummary: { ...emptyBankReconciliationSummary(), unmatchedCount: 2, amount: 500_000 },
      clearingSummary: { ...emptyBookingPaymentClearingSummary(), openCount: 3, amount: 900_000 },
      couponSummary: { ...emptyCouponFinanceSummary(), couponReviewFlagCount: 1 },
      monthlyClosingSummary: {
        ...emptyMonthlyTaxClosingSummary('2026-07'),
        reconciliationDelta: 10_000,
        status: 'DRAFT',
      },
      refundSummary: {
        completedCount: 1,
        needsUpdateCount: 1,
        openCount: 2,
        outcomeLinkedCount: 1,
        refundedBookingCount: 0,
        requestedCount: 1,
        totalCount: 3,
      },
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        count: 10,
        customerPaymentAmount: 100_000_000,
        platformFeeNetRevenue: 22_000_000,
        openTaxCount: 1,
      },
      walletSummary: {
        currency: 'VND',
        customerWalletAccountCount: 2,
        customerWalletLiabilityAmount: 130_000,
        negativePartnerWalletAmount: 70_000,
        partnerNegativeWalletAccountCount: 1,
        partnerPositiveWalletAccountCount: 1,
        partnerWalletLiabilityAmount: 200_000,
      },
    });

    expect(metrics.map((metric) => metric.label)).toEqual([
      'Revenue separation',
      'Wallet exposure',
      'Open finance risks',
      'Monthly close readiness',
    ]);
    expect(metrics.find((metric) => metric.label === 'Revenue separation')?.value).toBe('22%');
    expect(metrics.find((metric) => metric.label === 'Wallet exposure')?.value).toContain('400.000');
    expect(metrics.find((metric) => metric.label === 'Open finance risks')?.value).toBe('10');
    expect(metrics.find((metric) => metric.label === 'Open finance risks')?.detail).toContain('coupon');
    expect(metrics.find((metric) => metric.label === 'Monthly close readiness')?.value).toBe('DRAFT');
  });

  it('prioritizes finance action queues from summary counts', () => {
    const actions = buildFinanceOverviewActionItems({
      bankSummary: { ...emptyBankReconciliationSummary(), unmatchedCount: 3, amount: 700_000 },
      cashSummary: {
        generatedAt: '',
        currency: 'VND',
        rowCount: 2,
        providerCount: 1,
        totalCompanyCouponOffset: 0,
        totalDebtAmount: 500_000,
        totalPlatformFee: 0,
        totalTaxAmount: 0,
        oldestOpenAt: null,
        oldestOpenAgeMinutes: 0,
        staleDebtRowCount: 1,
        highDebtProviderCount: 1,
        missingPaymentEvidenceCount: 1,
        cashPaymentRowCount: 2,
        topProviderGroups: [],
      },
      clearingSummary: { ...emptyBookingPaymentClearingSummary(), openCount: 4, amount: 900_000 },
      monthlyClosingSummary: { ...emptyMonthlyTaxClosingSummary('2026-07'), reconciliationDelta: 1 },
      refundSummary: { totalCount: 4, requestedCount: 2, refundedBookingCount: 0, needsUpdateCount: 1, completedCount: 1, openCount: 3, outcomeLinkedCount: 1 },
      settlementSummary: { ...emptyBookingSettlementSummary(), openTaxCount: 2 },
      withdrawalSummary: { ...emptyProviderWalletWithdrawalRequestSummary(), requested: 2 },
    });

    expect(actions.map((action) => action.href)).toEqual(
      expect.arrayContaining([
        '/finance-tax/payment-clearing?range=today&review=open',
        '/finance-tax/bank-reconciliation?range=today&review=unmatched',
        '/cash-settlements?queue=high-debt',
        '/refunds?review=open',
      ]),
    );
    expect(actions.find((action) => action.label === 'Payment clearing open')).toMatchObject({
      amount: 900_000,
      currency: 'VND',
    });
    expect(actions.find((action) => action.label === 'General ledger audit')?.amount).toBeUndefined();
  });

  it('keeps finance action money as amount metadata instead of preformatted labels', () => {
    const actions = buildFinanceOverviewActionItems({
      ...emptyFinanceOverviewSummaries('2026-07'),
      bankSummary: { ...emptyBankReconciliationSummary(), amount: 700_000, unmatchedCount: 3 },
      clearingSummary: { ...emptyBookingPaymentClearingSummary(), amount: 900_000, openCount: 4 },
      withdrawalSummary: {
        ...emptyProviderWalletWithdrawalRequestSummary(),
        currency: 'VND',
        pendingWithdrawalPayableAmount: 300_000,
        requested: 2,
      },
    });

    expect(actions.find((action) => action.label === 'Payment clearing open')).toMatchObject({
      amount: 900_000,
      currency: 'VND',
    });
    expect(actions.find((action) => action.label === 'Payment clearing open')?.amountLabel).toBeUndefined();
    expect(actions.find((action) => action.label === 'Bank reconciliation unmatched')?.amountLabel).toBeUndefined();
    expect(actions.find((action) => action.label === 'Withdrawal payable')?.amountLabel).toBeUndefined();
    expect(actions.find((action) => action.label === 'Tax and closeout review')?.amountLabel).toContain(
      'formula issue',
    );
    expect(actions.find((action) => action.label === 'General ledger audit')?.amountLabel).toBe(
      'Debit / credit equality',
    );
  });

  it('preserves range in UI hrefs', () => {
    expect(financeOverviewHref('90d')).toBe('/finance-overview?range=90d');
  });
});
