import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewControlMetrics,
  buildFinanceOverviewFilters,
  buildFinanceOverviewKpis,
  buildFinanceOverviewPrimaryKpis,
  buildFinanceOverviewReviewSlaMetrics,
  buildFinanceOverviewVisibleActionItems,
  buildFinanceOverviewVisibleSections,
  buildFinanceOverviewSections,
  emptyFinanceOverviewSummaries,
  financeOverviewHref,
  normalizeFinanceOverviewRange,
  normalizeFinanceOverviewWorkspace,
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
    const hrefs = buildFinanceOverviewApiHrefs({
      range: '7d',
      period: '2026-07',
      workspace: 'command',
    });

    expect(hrefs.overviewSummaryHref).toBe('/admin/finance-overview?range=7d&period=2026-07');
    expect(hrefs.settlementSummaryHref).toBe('/admin/booking-settlement-snapshots/summary?range=7d');
    expect(hrefs.couponSummaryHref).toBe('/admin/booking-settlement-snapshots/coupon-finance-summary?range=7d');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=7d');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=7d');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
    expect(hrefs.withdrawalSummaryHref).toBe('/admin/provider-wallet/withdrawal-requests/summary?range=7d');
    expect(hrefs.paymentFeeSummaryHref).toBe('/admin/payment-fees/summary?period=2026-07');
  });

  it('separates current overdue Finance reviews from resolved period history', () => {
    const metrics = buildFinanceOverviewReviewSlaMetrics(
      {
        financeReviewSlaSummary: {
          open48To72Count: 1,
          openOverdueCount: 3,
          openOver72Count: 2,
          resolvedInRangeCount: 8,
        },
      },
      '7d',
    );

    expect(metrics).toEqual([
      expect.objectContaining({
        href: '/notifications?range=all&review=finance-overdue',
        label: 'Open 48–72h',
        tone: 'warning',
        value: '1',
      }),
      expect.objectContaining({
        href: '/notifications?range=all&review=finance-overdue',
        label: 'Open 72h+',
        tone: 'danger',
        value: '2',
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=finance-overdue-history',
        label: 'Resolved reviews',
        tone: 'info',
        value: '8',
      }),
    ]);
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

    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')).toMatchObject({
      amount: 100_000_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')?.value).toBeUndefined();
    expect(kpis.find((kpi) => kpi.label === 'Platform Fee')?.value).toBeUndefined();
    expect(kpis.find((kpi) => kpi.label === 'Net Platform Revenue Estimate')?.value).toBeUndefined();
    expect(kpis.find((kpi) => kpi.label === 'Platform Fee')).toMatchObject({
      amount: 22_000_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Net Platform Revenue Estimate')).toMatchObject({
      amount: 19_000_000,
      currency: 'VND',
    });
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

    expect(kpis.find((kpi) => kpi.label === 'Customer Wallet Liability')).toMatchObject({
      amount: 130_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Partner Wallet Liability')).toMatchObject({
      amount: 200_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Negative Partner Wallet')).toMatchObject({
      amount: 70_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Refund Pending Amount')).toMatchObject({
      amount: 40_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Refund Completed Amount')).toMatchObject({
      amount: 60_000,
      currency: 'VND',
    });
    expect(kpis.find((kpi) => kpi.label === 'Payment Failed Amount')).toMatchObject({
      amount: 75_000,
      currency: 'VND',
    });
  });

  it('keeps money metadata on finance section rows for shared MoneyText rendering', () => {
    const sections = buildFinanceOverviewSections({
      ...emptyFinanceOverviewSummaries('2026-07'),
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
      couponSummary: { ...emptyCouponFinanceSummary(), companyCouponExpense: 2_000_000 },
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        count: 4,
        customerPaymentAmount: 100_000_000,
        platformFeeNetRevenue: 22_000_000,
      },
    });
    const revenueRows = sections.find((section) => section.title === 'Revenue & Platform Fee')?.rows ?? [];
    const cashRows = sections.find((section) => section.title === 'Cash Payment / Receivable')?.rows ?? [];

    expect(revenueRows.find((row) => row.label === 'Gross booking amount')).toMatchObject({
      amount: 100_000_000,
      currency: 'VND',
    });
    expect(revenueRows.find((row) => row.label === 'Gross booking amount')?.value).toBeUndefined();
    expect(revenueRows.find((row) => row.label === 'Platform fee net revenue')?.value).toBeUndefined();
    expect(revenueRows.find((row) => row.label === 'Company coupon cost')?.value).toBeUndefined();
    expect(revenueRows.find((row) => row.label === 'Average platform fee')).toMatchObject({
      amount: 5_500_000,
      currency: 'VND',
    });
    expect(revenueRows.find((row) => row.label === 'Average platform fee')?.value).toBeUndefined();
    expect(cashRows.find((row) => row.label === 'Cash debt amount')).toMatchObject({
      amount: 500_000,
      currency: 'VND',
    });
    expect(cashRows.find((row) => row.label === 'Cash debt amount')?.value).toBeUndefined();
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
      bankWithdrawalCandidateSummary: {
        assignedCount: 1,
        assignments: [],
        currency: 'VND',
        eligibleCount: 4,
        noneAmount: 100_000,
        noneCount: 1,
        oldestReviewOccurredAt: '2026-07-14T02:00:00.000Z',
        oldestStrongOccurredAt: '2026-07-12T02:00:00.000Z',
        reviewAmount: 300_000,
        reviewCount: 1,
        reviewOver24hCount: 1,
        reviewOver48hCount: 0,
        strongAmount: 800_000,
        strongCount: 2,
        strongOver24hCount: 2,
        strongOver48hCount: 1,
        unassignedCount: 3,
      },
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
    }, '7d');

    expect(metrics.map((metric) => metric.label)).toEqual([
      'Revenue separation',
      'Wallet exposure',
      'Open finance risks',
      'Withdrawal matching',
      'Monthly close status',
    ]);
    expect(metrics.find((metric) => metric.label === 'Revenue separation')?.value).toBe('22%');
    expect(metrics.find((metric) => metric.label === 'Wallet exposure')).toMatchObject({
      amount: 400_000,
      currency: 'VND',
    });
    expect(metrics.find((metric) => metric.label === 'Wallet exposure')?.value).toBeUndefined();
    expect(metrics.find((metric) => metric.label === 'Open finance risks')?.value).toBe('10');
    expect(metrics.find((metric) => metric.label === 'Open finance risks')?.detail).toContain('coupon');
    expect(metrics.find((metric) => metric.label === 'Withdrawal matching')).toMatchObject({
      href: '/finance-tax/bank-reconciliation?range=7d&review=outflow&candidate=strong',
      tone: 'danger',
      value: '3',
    });
    expect(metrics.find((metric) => metric.label === 'Monthly close status')?.value).toBe('DRAFT');
  });

  it('keeps Finance Overview copy focused on operator decisions instead of internal diagnostics', () => {
    const summaries = emptyFinanceOverviewSummaries('2026-07');
    const metrics = buildFinanceOverviewControlMetrics(summaries);
    const kpis = buildFinanceOverviewKpis(summaries);
    const sections = buildFinanceOverviewSections(summaries);
    const visibleCopy = [
      ...metrics.flatMap((metric) => [metric.label, metric.detail]),
      ...kpis.flatMap((kpi) => [kpi.label, kpi.detail]),
      ...sections.flatMap((section) => [
        section.title,
        section.description,
        ...section.rows.flatMap((row) => [row.label, row.detail]),
      ]),
    ]
      .filter(Boolean)
      .join(' ');

    expect(visibleCopy).not.toMatch(/\b(readiness|snapshot|snapshots|health|source evidence)\b/i);
  });

  it('prioritizes finance action queues from summary counts', () => {
    const actions = buildFinanceOverviewActionItems({
      bankSummary: { ...emptyBankReconciliationSummary(), unmatchedCount: 3, amount: 700_000 },
      bankWithdrawalCandidateSummary: {
        assignedCount: 1,
        assignments: [],
        currency: 'VND',
        eligibleCount: 4,
        noneAmount: 100_000,
        noneCount: 1,
        oldestReviewOccurredAt: '2026-07-14T02:00:00.000Z',
        oldestStrongOccurredAt: '2026-07-12T02:00:00.000Z',
        reviewAmount: 300_000,
        reviewCount: 1,
        reviewOver24hCount: 1,
        reviewOver48hCount: 0,
        strongAmount: 800_000,
        strongCount: 2,
        strongOver24hCount: 2,
        strongOver48hCount: 1,
        unassignedCount: 3,
      },
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
      financeReviewSlaSummary: {
        open48To72Count: 1,
        openOverdueCount: 3,
        openOver72Count: 2,
        resolvedInRangeCount: 8,
      },
      monthlyClosingSummary: {
        ...emptyMonthlyTaxClosingSummary('2026-07'),
        partnerDepositReconciliationOpenAmount: 160_000,
        partnerDepositReconciliationOpenCount: 2,
        reconciliationDelta: 1,
      },
      refundSummary: { totalCount: 4, requestedCount: 2, refundedBookingCount: 0, needsUpdateCount: 1, completedCount: 1, openCount: 3, outcomeLinkedCount: 1 },
      settlementSummary: { ...emptyBookingSettlementSummary(), openTaxCount: 2 },
      withdrawalSummary: { ...emptyProviderWalletWithdrawalRequestSummary(), requested: 2 },
    });

    expect(actions.map((action) => action.href)).toEqual(
      expect.arrayContaining([
        '/finance-tax/payment-clearing?range=today&review=open',
        '/finance-tax/bank-reconciliation?range=today&review=unmatched',
        '/finance-tax/bank-reconciliation?range=today&review=outflow&candidate=eligible&owner=unassigned',
        '/finance-tax/partner-bank-deposits?status=EXECUTED&review=needs-reconciliation&period=2026-07',
        '/cash-settlements?queue=high-debt',
        '/refunds?review=open',
      ]),
    );
    expect(actions.find((action) => action.label === 'Payment clearing open')).toMatchObject({
      amount: 900_000,
      currency: 'VND',
    });
    expect(actions[0]).toMatchObject({
      countLabel: '2 over 72h',
      href: '/notifications?range=all&review=finance-overdue',
      label: 'Finance reviews over 72h',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Unassigned withdrawal reviews')).toMatchObject({
      countLabel: '3 unassigned',
      href: '/finance-tax/bank-reconciliation?range=today&review=outflow&candidate=eligible&owner=unassigned',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Strong withdrawal candidates')).toMatchObject({
      amount: 800_000,
      countLabel: '2 strong',
      href: '/finance-tax/bank-reconciliation?range=today&review=outflow&candidate=strong',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Partner deposit reconciliation')).toMatchObject({
      amount: 160_000,
      countLabel: '2 open',
      currency: 'VND',
      href: '/finance-tax/partner-bank-deposits?status=EXECUTED&review=needs-reconciliation&period=2026-07',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Withdrawal candidates to review')).toMatchObject({
      amount: 300_000,
      countLabel: '1 review',
      href: '/finance-tax/bank-reconciliation?range=today&review=outflow&candidate=review',
      tone: 'warning',
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

  it('keeps the rendered overview payload bounded for the operator-first page', () => {
    const summaries = emptyFinanceOverviewSummaries('2026-07');
    const sections = buildFinanceOverviewVisibleSections(buildFinanceOverviewSections(summaries));
    const actions = buildFinanceOverviewVisibleActionItems(buildFinanceOverviewActionItems(summaries));

    expect(sections).toHaveLength(6);
    expect(sections.every((section) => section.rows.length <= 3)).toBe(true);
    expect(actions).toHaveLength(4);
    expect(sections.map((section) => section.title)).toContain('Revenue & Platform Fee');
    expect(sections.map((section) => section.title)).toContain('Reconciliation');
  });

  it('preserves range in UI hrefs', () => {
    expect(financeOverviewHref('90d')).toBe('/finance-overview?range=90d');
    expect(financeOverviewHref('30d', { period: '2026-07', workspace: 'flow' })).toBe(
      '/finance-overview?range=30d&period=2026-07&view=flow',
    );
    expect(buildFinanceOverviewFilters({}).workspace).toBe('command');
    expect(buildFinanceOverviewFilters({ view: 'queues' }).workspace).toBe('queues');
    expect(normalizeFinanceOverviewWorkspace('unknown')).toBe('command');
  });
});
