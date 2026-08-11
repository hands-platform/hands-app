import {
  buildFinanceOverviewActionItems,
  buildFinanceOverviewApiHrefs,
  buildFinanceOverviewComparisonKpis,
  buildFinanceOverviewControlMetrics,
  buildFinanceOverviewCurrentPositionKpis,
  buildFinanceOverviewFilters,
  buildFinanceOverviewKpis,
  buildFinanceOverviewMonthlyCloseKpis,
  buildFinanceOverviewPrimaryKpis,
  buildFinanceOverviewPriorityItems,
  buildFinanceOverviewRecordsSection,
  buildFinanceOverviewReviewSlaMetrics,
  buildFinanceOverviewTodayMovementKpis,
  buildFinanceOverviewVisibleActionItems,
  buildFinanceOverviewVisibleSections,
  buildFinanceOverviewSections,
  emptyFinanceOverviewSummaries,
  financeOverviewHref,
  isFinanceOverviewCanonicalRequest,
  isFinanceOverviewRangeMovementClear,
  isFinanceTodayMovementClear,
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
  emptyPaymentFeeSummary,
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

  it('keeps period summaries bounded while current queues stay unbounded', () => {
    const hrefs = buildFinanceOverviewApiHrefs({
      range: '7d',
      period: '2026-07',
      workspace: 'command',
    });

    expect(hrefs.overviewSummaryHref).toBe('/admin/finance-overview?range=7d&period=2026-07');
    expect(hrefs.settlementSummaryHref).toBe('/admin/booking-settlement-snapshots/summary?range=7d&review=all');
    expect(hrefs.couponSummaryHref).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance-summary?range=7d',
    );
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=7d');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=7d');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=all');
    expect(hrefs.clearingSummaryHref).toBe('/admin/booking-payment-clearing/summary?range=all&review=open');
    expect(hrefs.bankSummaryHref).toBe('/admin/bank-reconciliation/summary?range=all&review=unmatched');
    expect(hrefs.refundSummaryHref).toBe('/admin/refunds/summary?range=all');
    expect(hrefs.withdrawalSummaryHref).toBe('/admin/provider-wallet/withdrawal-requests/summary?range=all');
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
    expect(kpis.find((kpi) => kpi.label === 'Gross Booking Amount')?.detail).toContain('not company revenue');
  });

  it('uses exact wallet, refund, and failed payment amounts when the Finance Overview API provides them', () => {
    const kpis = buildFinanceOverviewKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedCount: 3,
        paymentFailedAmount: 75_000,
        refundCompletedCount: 1,
        refundCompletedAmount: 60_000,
        refundPendingCount: 2,
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
    expect(kpis.find((kpi) => kpi.label === 'Partner Receivable')).toMatchObject({
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

  it('separates selected-period performance from current balance exposure', () => {
    const primaryKpis = buildFinanceOverviewPrimaryKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedCount: 3,
        paymentFailedAmount: 75_000,
        refundCompletedCount: 1,
        refundCompletedAmount: 60_000,
        refundPendingCount: 2,
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
      'Partner Payout Generated',
    ]);
    expect(primaryKpis).toHaveLength(4);

    const currentPositionKpis = buildFinanceOverviewCurrentPositionKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      walletSummary: {
        currency: 'VND',
        customerWalletAccountCount: 2,
        customerWalletLiabilityAmount: 130_000,
        negativePartnerWalletAmount: 70_000,
        partnerNegativeWalletAccountCount: 1,
        partnerPositiveWalletAccountCount: 1,
        partnerWalletLiabilityAmount: 200_000,
      },
      withdrawalSummary: {
        ...emptyProviderWalletWithdrawalRequestSummary(),
        pendingWithdrawalPayableAmount: 300_000,
      },
    });

    expect(currentPositionKpis.map((kpi) => kpi.label)).toEqual([
      'Customer Wallet Liability',
      'Partner Wallet Liability',
      'Partner Receivable',
      'Withdrawal Payable',
    ]);
  });

  it('builds today movement without mixing in all-date backlog', () => {
    const input = {
      ...emptyFinanceOverviewSummaries('2026-07'),
      amountSummary: {
        currency: 'VND',
        paymentFailedCount: 3,
        paymentFailedAmount: 75_000,
        refundCompletedCount: 1,
        refundCompletedAmount: 60_000,
        refundPendingCount: 2,
        refundPendingAmount: 40_000,
      },
      bankSummary: {
        ...emptyBankReconciliationSummary(),
        amount: 500_000,
        unmatchedCount: 2,
      },
      paymentSummary: {
        activeCashCollection: 0,
        authorized: 0,
        callbackReview: 1,
        callbackVerified: 0,
        captureReady: 0,
        captured: 0,
        cashDebt: 0,
        evidenceConflicts: 0,
        linkedRefunds: 0,
        needsAction: 1,
        pendingCash: 0,
        releaseRecommended: 0,
        refunded: 0,
        staleMismatch: 0,
        totalCount: 1,
      },
      payoutSummary: {
        currency: 'VND',
        generatedAt: '',
        inProgress: 0,
        missingTransferRefs: 0,
        needsReview: 2,
        open: 2,
        payoutHolds: 1,
        settled: 0,
        total: 2,
        totalNetAmount: 200_000,
        withholdingAmount: 0,
      },
      refundSummary: {
        completedCount: 0,
        needsUpdateCount: 0,
        openCount: 3,
        outcomeLinkedCount: 0,
        refundedBookingCount: 0,
        requestedCount: 3,
        totalCount: 3,
      },
      withdrawalSummary: {
        ...emptyProviderWalletWithdrawalRequestSummary(),
        pendingWithdrawalPayableAmount: 300_000,
        requested: 4,
      },
    };

    const movement = buildFinanceOverviewTodayMovementKpis(input);

    expect(movement.map((metric) => metric.label)).toEqual([
      'Customer Payments Today',
      'Failed Payments Today',
      'Pending Refunds Created Today',
      'Partner Payout Generated Today',
    ]);
    expect(movement.find((metric) => metric.label === 'Failed Payments Today')).toMatchObject({
      amount: 75_000,
      detail: '3 failed payments created today.',
      tone: 'danger',
    });
    expect(movement.find((metric) => metric.label === 'Pending Refunds Created Today')).toMatchObject({
      amount: 40_000,
      detail: '2 pending refund requests created today.',
      tone: 'warning',
    });
    expect(movement.map((metric) => metric.label)).not.toContain('Unmatched Bank');
    expect(movement.map((metric) => metric.label)).not.toContain('Payout / Withdrawal Risk');
  });

  it('builds this-month close controls and persistent record links', () => {
    const input = {
      ...emptyFinanceOverviewSummaries('2026-07'),
      couponSummary: {
        ...emptyCouponFinanceSummary(),
        couponReviewFlagCount: 1,
        couponSettlementCount: 5,
      },
      generalLedgerSummary: {
        balancedCount: 8,
        blockedAmount: 0,
        blockedCount: 0,
        clearCount: 8,
        count: 10,
        currency: 'VND',
        draftCount: 1,
        entryMismatchCount: 0,
        formulaDeltaCount: 0,
        generatedAt: '2026-08-09T00:00:00.000Z',
        headerEntryMismatchCount: 0,
        headerMismatchCount: 0,
        needsActionCount: 1,
        postedCount: 9,
        postedWithoutEntryCount: 0,
        reversedCount: 0,
        totalCredit: 500_000,
        totalDebit: 500_000,
        unbalancedAmount: 0,
        unbalancedCount: 0,
        unknownCount: 0,
      },
      monthlyClosingSummary: {
        ...emptyMonthlyTaxClosingSummary('2026-07'),
        companyOutputVatTotal: 100_000,
        partnerWithholdingTotal: 250_000,
        reconciliationDelta: 0,
        status: 'DRAFT' as const,
      },
      paymentFeeSummary: {
        ...emptyPaymentFeeSummary('2026-07'),
        byPaymentMethod: [
          paymentFeeMethod('CARD'),
          paymentFeeMethod('MOMO'),
          paymentFeeMethod('VNPAY'),
        ],
      },
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        count: 6,
        needsActionCount: 1,
        resolvedCount: 5,
        reversedCount: 2,
      },
    };

    const closeKpis = buildFinanceOverviewMonthlyCloseKpis(input);
    expect(closeKpis.map((kpi) => kpi.label)).toEqual([
      'Platform VAT',
      'Partner Withholding',
      'Reconciliation Delta',
      'Close Status',
    ]);
    expect(closeKpis.map((kpi) => kpi.href)).toEqual([
      '/finance-tax/platform-vat?period=2026-07',
      '/finance-tax/partner-withholding-tax?period=2026-07',
      '/finance-tax/monthly-tax-closing?period=2026-07',
      '/finance-tax/monthly-tax-closing?period=2026-07',
    ]);

    const taxRows = buildFinanceOverviewSections(input)
      .find((section) => section.title === 'Tax Overview')
      ?.rows ?? [];
    expect(taxRows.find((row) => row.label === 'Company output VAT')?.href).toBe(
      '/finance-tax/platform-vat?period=2026-07',
    );
    expect(taxRows.find((row) => row.label === 'Partner withholding')?.href).toBe(
      '/finance-tax/partner-withholding-tax?period=2026-07',
    );
    expect(taxRows.find((row) => row.label === 'Payment fee methods · 2026-07')).toMatchObject({
      href: '/finance-tax/payment-fees?period=2026-07',
      value: '3 configured methods',
    });

    const records = buildFinanceOverviewRecordsSection(input, 'today');
    expect(records.title).toBe('Records');
    expect(records.rows.map((row) => row.label)).toEqual([
      'Journal Batches',
      'Booking Settlement Records',
      'Settlement Reversals',
      'Coupon Finance',
    ]);
    expect(records.rows[0]?.href).toContain('/finance-tax/general-ledger');
    expect(records.rows[1]?.href).toContain('/finance-tax/booking-settlement-audit');
  });

  it('collapses Today Movement only when every today count and amount is zero', () => {
    const clear = emptyFinanceOverviewSummaries('2026-07');

    expect(isFinanceTodayMovementClear(clear)).toBe(true);
    expect(
      isFinanceTodayMovementClear({
        ...clear,
        settlementSummary: { ...clear.settlementSummary, count: 1 },
      }),
    ).toBe(false);
    expect(
      isFinanceTodayMovementClear({
        ...clear,
        amountSummary: { ...clear.amountSummary, refundPendingAmount: 1 },
      }),
    ).toBe(false);
  });

  it('collapses range movement only when all selected-period money movement is zero', () => {
    const clear = emptyFinanceOverviewSummaries('2026-07');

    expect(isFinanceOverviewRangeMovementClear(clear)).toBe(true);
    expect(
      isFinanceOverviewRangeMovementClear({
        ...clear,
        couponSummary: { ...clear.couponSummary, companyCouponExpense: 1 },
      }),
    ).toBe(false);
    expect(
      isFinanceOverviewRangeMovementClear({
        ...clear,
        settlementSummary: { ...clear.settlementSummary, partnerPayoutAmount: 1 },
      }),
    ).toBe(false);
  });

  it('preserves the selected range in Finance KPI drill-through links', () => {
    const primaryKpis = buildFinanceOverviewPrimaryKpis(emptyFinanceOverviewSummaries('2026-07'), '7d');

    expect(primaryKpis.find((kpi) => kpi.label === 'Gross Booking Amount')?.href).toBe(
      '/finance-tax/booking-settlement-audit?range=7d&review=all',
    );
  });

  it('builds an operator-first finance control board from summary data', () => {
    const metrics = buildFinanceOverviewControlMetrics(
      {
        ...emptyFinanceOverviewSummaries('2026-07'),
        amountSummary: {
          currency: 'VND',
          paymentFailedCount: 1,
          paymentFailedAmount: 75_000,
          refundCompletedCount: 0,
          refundCompletedAmount: 60_000,
          refundPendingCount: 3,
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
      },
      '7d',
    );

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
      bankSummary: {
        ...emptyBankReconciliationSummary(),
        amount: 700_000,
        oldestUnassignedAt: '2026-07-13T02:00:00.000Z',
        unassignedCount: 3,
        unmatchedCount: 3,
      },
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
      clearingSummary: {
        ...emptyBookingPaymentClearingSummary(),
        amount: 900_000,
        oldestUnassignedOpenAt: '2026-07-12T02:00:00.000Z',
        openCount: 4,
        unassignedCount: 4,
      },
      companyBankAccountApprovalSummary: {
        oldestRequestedAt: '2026-07-09T02:00:00.000Z',
        over48hCount: 1,
        pendingCount: 2,
      },
      financeReviewSlaSummary: {
        assignedCount: 1,
        assignments: [],
        oldestOpenAt: '2026-07-11T02:00:00.000Z',
        open48To72Count: 1,
        openOverdueCount: 3,
        openOver72Count: 2,
        resolvedInRangeCount: 8,
        unassignedCount: 2,
      },
      monthlyClosingSummary: {
        ...emptyMonthlyTaxClosingSummary('2026-07'),
        payoutBankOutflowReconciliationOpenAmount: 430_000,
        payoutBankOutflowReconciliationOpenCount: 1,
        payoutReturnInflowReconciliationOpenAmount: 215_000,
        payoutReturnInflowReconciliationOpenCount: 2,
        reconciliationDelta: 1,
      },
      partnerDepositQueueSummary: {
        assignedCount: 1,
        assignments: [
          {
            assignee: { id: 'admin-1', email: 'finance@hands.test', fullName: 'Finance Operator' },
            assigneeAdminId: 'admin-1',
            count: 1,
          },
        ],
        currency: 'VND',
        oldestOpenAt: '2026-07-10T02:00:00.000Z',
        openAmount: 160_000,
        openCount: 2,
        unassignedCount: 1,
      },
      refundSummary: {
        totalCount: 4,
        requestedCount: 2,
        refundedBookingCount: 0,
        needsUpdateCount: 1,
        completedCount: 1,
        openCount: 3,
        outcomeLinkedCount: 1,
      },
      settlementSummary: { ...emptyBookingSettlementSummary(), openTaxCount: 2 },
      withdrawalSummary: { ...emptyProviderWalletWithdrawalRequestSummary(), requested: 2 },
    });

    expect(actions.map((action) => action.href)).toEqual(
      expect.arrayContaining([
        '/finance-tax/approval-queue?view=bank-accounts',
        '/finance-tax/payment-clearing?range=all&review=open&owner=unassigned',
        '/finance-tax/bank-reconciliation?range=all&review=unmatched&owner=unassigned',
        '/finance-tax/bank-reconciliation?range=all&review=outflow&candidate=eligible&owner=unassigned',
        '/finance-tax/partner-bank-deposits?review=needs-reconciliation&sort=oldest&scope=all-open&returnTo=%2Ffinance-overview%3Fview%3Dqueues',
        '/cash-settlements?range=all&queue=high-debt',
        '/refunds?range=all&review=open',
      ]),
    );
    expect(actions.find((action) => action.label === 'Payment clearing open')).toMatchObject({
      amount: 900_000,
      assigneeLabel: '4 unassigned',
      currency: 'VND',
      ownerLabel: 'Finance operations',
      ownerState: 'unassigned',
    });
    expect(actions[0]).toMatchObject({
      countLabel: '2 over 72h',
      href: '/notifications?range=all&review=finance-overdue&financeOwner=unassigned',
      label: 'Finance review SLA',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Unassigned withdrawal reviews')).toMatchObject({
      countLabel: '3 unassigned',
      href: '/finance-tax/bank-reconciliation?range=all&review=outflow&candidate=eligible&owner=unassigned',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Strong withdrawal candidates')).toMatchObject({
      amount: 800_000,
      countLabel: '2 strong',
      href: '/finance-tax/bank-reconciliation?range=all&review=outflow&candidate=strong',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Partner deposit reconciliation')).toMatchObject({
      amount: 160_000,
      assigneeLabel: '1 unassigned',
      countLabel: '2 open',
      currency: 'VND',
      href: '/finance-tax/partner-bank-deposits?review=needs-reconciliation&sort=oldest&scope=all-open&returnTo=%2Ffinance-overview%3Fview%3Dqueues',
      ownerLabel: 'Finance operations',
      ownerState: 'unassigned',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Bank account approval')).toMatchObject({
      countLabel: '2 pending',
      href: '/finance-tax/approval-queue?view=bank-accounts',
      ownerLabel: 'Finance approvals',
      ownerState: 'shared',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Payout bank outflow reconciliation')).toMatchObject({
      amount: 430_000,
      countLabel: '1 open',
      currency: 'VND',
      href: '/payouts?period=2026-07&status=PAID&evidence=bank-match-incomplete&sort=oldest&returnTo=%2Ffinance-overview%3Fview%3Dqueues',
      ownerLabel: '2026-07 closeout',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Payout return inflow reconciliation')).toMatchObject({
      amount: 215_000,
      countLabel: '2 open',
      currency: 'VND',
      href: '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched&type=INFLOW',
      ownerLabel: '2026-07 closeout',
      tone: 'danger',
    });
    expect(actions.find((action) => action.label === 'Withdrawal candidates to review')).toMatchObject({
      amount: 300_000,
      countLabel: '1 review',
      href: '/finance-tax/bank-reconciliation?range=all&review=outflow&candidate=review',
      tone: 'warning',
    });
    expect(actions.find((action) => action.label === 'Journal batch integrity')).toMatchObject({
      amount: 0,
      currency: 'VND',
      ownerLabel: 'Accounting',
      tone: 'success',
    });
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
    expect(
      actions.find((action) => action.label === 'Bank reconciliation unmatched')?.amountLabel,
    ).toBeUndefined();
    expect(actions.find((action) => action.label === 'Withdrawal payable')?.amountLabel).toBeUndefined();
    expect(actions.find((action) => action.label === 'Tax and closeout review')).toBeUndefined();
    expect(
      actions.find((action) => action.label === 'Journal batch integrity')?.amountLabel,
    ).toBeUndefined();
  });

  it('keeps the rendered overview payload bounded for the operator-first page', () => {
    const summaries = emptyFinanceOverviewSummaries('2026-07');
    const sections = buildFinanceOverviewVisibleSections(buildFinanceOverviewSections(summaries));
    const actions = buildFinanceOverviewVisibleActionItems(buildFinanceOverviewActionItems(summaries));

    expect(sections).toHaveLength(6);
    expect(sections.every((section) => section.rows.length <= 4)).toBe(true);
    expect(actions).toHaveLength(0);
    expect(sections.map((section) => section.title)).toContain('Revenue & Platform Fee');
    expect(sections.map((section) => section.title)).toContain('Reconciliation');
    expect(
      sections.find((section) => section.title === 'Partner Settlement')?.rows.map((row) => row.label),
    ).toEqual([
      'Available earning net',
      'Open payout batches',
      'Withdrawal payable',
    ]);
    expect(
      sections.find((section) => section.title === 'Reconciliation')?.rows.map((row) => row.label),
    ).toEqual([
      'Payment clearing open',
      'Bank unmatched',
      'Monthly formula delta',
      'Journal batch integrity',
    ]);
    expect(
      sections.find((section) => section.title === 'Tax Overview')?.rows.map((row) => row.label),
    ).toContain('Partner tax profile action');
  });

  it('does not create a composite tax closeout queue without one exact destination', () => {
    const summaries = emptyFinanceOverviewSummaries('2026-07');
    const visible = buildFinanceOverviewVisibleActionItems(
      buildFinanceOverviewActionItems({
        ...summaries,
        monthlyClosingSummary: {
          ...summaries.monthlyClosingSummary,
          couponReviewFlagCount: 1,
        },
      }),
    );

    expect(visible).toHaveLength(0);
  });

  it('shows every unresolved Finance queue and orders danger before warning', () => {
    const items = buildFinanceOverviewActionItems({
      ...emptyFinanceOverviewSummaries('2026-07'),
      bankSummary: {
        ...emptyBankReconciliationSummary(),
        unmatchedCount: 2,
        unassignedCount: 2,
      },
      cashSummary: {
        generatedAt: '',
        currency: 'VND',
        rowCount: 1,
        providerCount: 1,
        totalCompanyCouponOffset: 0,
        totalDebtAmount: 200_000,
        totalPlatformFee: 0,
        totalTaxAmount: 0,
        oldestOpenAt: '2026-07-10T00:00:00.000Z',
        oldestOpenAgeMinutes: 120,
        staleDebtRowCount: 1,
        highDebtProviderCount: 1,
        missingPaymentEvidenceCount: 0,
        cashPaymentRowCount: 1,
        topProviderGroups: [],
      },
      clearingSummary: {
        ...emptyBookingPaymentClearingSummary(),
        openCount: 1,
        unassignedCount: 1,
      },
      payoutSummary: {
        generatedAt: '2026-07-20T00:00:00.000Z',
        total: 2,
        needsReview: 1,
        inProgress: 0,
        payoutHolds: 1,
        missingTransferRefs: 1,
        settled: 0,
        open: 2,
        totalNetAmount: 300_000,
        withholdingAmount: 20_000,
        currency: 'VND',
      },
      taxProfileSummary: {
        actionRequiredCount: 2,
        approvedCount: 4,
        missingCount: 1,
        pendingReviewCount: 1,
        rejectedCount: 0,
        relevantPartnerCount: 6,
      },
    });
    const visible = buildFinanceOverviewVisibleActionItems(items);

    expect(visible.length).toBeGreaterThan(4);
    expect(visible.every((item) => item.tone === 'danger' || item.tone === 'warning')).toBe(true);
    expect(visible.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Bank reconciliation unmatched',
        'Cash debt recovery',
        'Payment clearing open',
        'Payout batch review',
        'Partner tax profile review',
      ]),
    );
    expect(
      buildFinanceOverviewPriorityItems(visible, 4).every((item, index, rows) => {
        if (index === 0) return true;
        return rows[index - 1]?.tone === 'danger' || item.tone !== 'danger';
      }),
    ).toBe(true);
  });

  it('orders all-open backlog by breached SLA, oldest wait, owner, and impact', () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1_000).toISOString();
    const items = buildFinanceOverviewVisibleActionItems(
      buildFinanceOverviewActionItems({
        ...emptyFinanceOverviewSummaries('2026-07'),
        bankSummary: {
          ...emptyBankReconciliationSummary(),
          amount: 300_000,
          oldestUnmatchedAt: daysAgo(37),
          unmatchedCount: 1,
        },
        clearingSummary: {
          ...emptyBookingPaymentClearingSummary(),
          amount: 200_000,
          oldestOpenAt: daysAgo(59),
          openCount: 1,
        },
        refundSummary: {
          completedCount: 0,
          needsUpdateCount: 1,
          oldestOpenAt: daysAgo(82),
          openCount: 1,
          outcomeLinkedCount: 0,
          refundedBookingCount: 0,
          requestedCount: 1,
          totalCount: 1,
        },
      }),
    );

    expect(items.slice(0, 3).map((item) => item.label)).toEqual([
      'Refund queue',
      'Payment clearing open',
      'Bank reconciliation unmatched',
    ]);
    expect(items[0]?.oldestAgeMinutes).toBeGreaterThan(items[1]?.oldestAgeMinutes ?? 0);
  });

  it('keeps closeout signals in their exact queues and all-open refunds free of selected-period amounts', () => {
    const summaries = emptyFinanceOverviewSummaries('2026-07');
    const actions = buildFinanceOverviewActionItems({
      ...summaries,
      amountSummary: { ...summaries.amountSummary, refundPendingAmount: 999_999 },
      monthlyClosingSummary: {
        ...summaries.monthlyClosingSummary,
        couponReviewFlagCount: 2,
        payoutBankOutflowReconciliationOpenCount: 3,
        payoutReturnInflowReconciliationOpenCount: 4,
        reconciliationDelta: 1,
      },
      refundSummary: {
        completedCount: 0,
        needsUpdateCount: 1,
        openCount: 1,
        outcomeLinkedCount: 0,
        refundedBookingCount: 0,
        requestedCount: 1,
        totalCount: 1,
      },
      settlementSummary: { ...summaries.settlementSummary, openTaxCount: 5 },
    });

    expect(actions.find((item) => item.label === 'Tax and closeout review')).toBeUndefined();
    expect(actions.find((item) => item.label === 'Payout bank outflow reconciliation')).toMatchObject({
      countLabel: '3 open',
    });
    expect(actions.find((item) => item.label === 'Refund queue')?.detail).toBe(
      'All-open refund cases requiring booking, payment, or reversal review.',
    );
  });

  it('raises a journal batch integrity risk from blocked journals', () => {
    const actions = buildFinanceOverviewActionItems({
      ...emptyFinanceOverviewSummaries('2026-07'),
      generalLedgerSummary: {
        balancedCount: 2,
        blockedAmount: 100_000,
        blockedCount: 1,
        clearCount: 2,
        count: 3,
        currency: 'VND',
        draftCount: 0,
        entryMismatchCount: 0,
        formulaDeltaCount: 0,
        generatedAt: '2026-08-09T00:00:00.000Z',
        headerEntryMismatchCount: 1,
        headerMismatchCount: 0,
        needsActionCount: 1,
        postedCount: 3,
        postedWithoutEntryCount: 0,
        reversedCount: 0,
        totalCredit: 900_000,
        totalDebit: 1_000_000,
        unbalancedAmount: 100_000,
        unbalancedCount: 1,
        unknownCount: 0,
      },
    });

    expect(actions.find((action) => action.label === 'Journal batch integrity')).toMatchObject({
      amount: 100_000,
      countLabel: '1 blocked · 0 evidence unknown · 0 draft',
      ownerLabel: 'Accounting',
      tone: 'danger',
    });
  });

  it('uses canonical workspace URLs without irrelevant parameters', () => {
    expect(financeOverviewHref('90d')).toBe('/finance-overview');
    expect(financeOverviewHref('90d', { workspace: 'queues' })).toBe('/finance-overview?view=queues');
    expect(financeOverviewHref('30d', { period: '2026-07', workspace: 'flow' })).toBe(
      '/finance-overview?view=flow&range=30d&period=2026-07',
    );
    const flowFilters = buildFinanceOverviewFilters({ view: 'flow', range: '30d', period: '2026-07' });
    expect(
      isFinanceOverviewCanonicalRequest(
        { view: 'flow', range: '30d', period: '2026-07' },
        flowFilters,
      ),
    ).toBe(true);
    expect(
      isFinanceOverviewCanonicalRequest(
        { view: 'flow', range: '30d', period: '2026-07', review: 'open' },
        flowFilters,
      ),
    ).toBe(false);
    expect(buildFinanceOverviewFilters({}).workspace).toBe('command');
    expect(buildFinanceOverviewFilters({ view: 'queues' }).workspace).toBe('queues');
    expect(normalizeFinanceOverviewWorkspace('unknown')).toBe('command');
  });

  it('uses exact settlement-active Partner tax profile counts instead of open settlement tax rows', () => {
    const kpis = buildFinanceOverviewKpis({
      ...emptyFinanceOverviewSummaries('2026-07'),
      settlementSummary: {
        ...emptyBookingSettlementSummary(),
        openTaxCount: 99,
      },
      taxProfileSummary: {
        actionRequiredCount: 3,
        approvedCount: 4,
        missingCount: 1,
        pendingReviewCount: 1,
        rejectedCount: 1,
        relevantPartnerCount: 7,
      },
    });
    const taxKpi = kpis.find((kpi) => kpi.label === 'Tax Info Missing Partners');

    expect(taxKpi).toMatchObject({
      tone: 'warning',
      value: '3',
    });
    expect(taxKpi?.detail).toContain('1 missing · 1 pending · 1 rejected');
    expect(taxKpi?.detail).toContain('7 settlement-active Partners');
  });

  it('builds equal-window Finance comparison cards with a safe zero baseline', () => {
    const kpis = buildFinanceOverviewComparisonKpis(
      {
        ...emptyFinanceOverviewSummaries('2026-07'),
        comparisonSummary: {
          previousRangeLabel: 'Previous 7 days',
          settlementCount: { current: 8, previous: 4, delta: 4, deltaPercent: 100 },
          customerPaymentAmount: { current: 1_000_000, previous: 800_000, delta: 200_000, deltaPercent: 25 },
          partnerPayoutAmount: { current: 760_000, previous: 0, delta: 760_000, deltaPercent: null },
          platformFeeNetRevenue: { current: 220_000, previous: 200_000, delta: 20_000, deltaPercent: 10 },
        },
      },
      '7d',
    );

    expect(kpis.map((kpi) => kpi.label)).toEqual([
      'Settlement records',
      'Gross customer payments',
      'Platform fee net revenue',
      'Partner payout generated',
    ]);
    expect(kpis.find((kpi) => kpi.label === 'Gross customer payments')).toMatchObject({
      amount: 1_000_000,
      currency: 'VND',
      tone: 'success',
    });
    expect(kpis.find((kpi) => kpi.label === 'Gross customer payments')?.detail).toContain('+25%');
    expect(kpis.find((kpi) => kpi.label === 'Partner payout generated')?.detail).toContain(
      'No comparable prior data',
    );
    expect(kpis.map((kpi) => kpi.href)).toEqual([
      '/finance-tax/booking-settlement-audit?range=7d',
      '/finance-tax/booking-settlement-audit?range=7d',
      '/finance-tax/booking-settlement-audit?range=7d',
      '/earnings?range=7d',
    ]);
  });
});

function paymentFeeMethod(paymentMethod: 'CARD' | 'MOMO' | 'VNPAY') {
  return {
    customerPaymentAmountTotal: 0,
    evidenceCustomerPaymentAmountTotal: 0,
    evidenceRecordedFeeTotal: 0,
    evidenceReviewCount: 0,
    paymentMethod,
    paymentProcessingFeeTotal: 0,
    remediationDelta: null,
    remediationExpectedFeeTotal: null,
    reversalCount: 0,
    settlementCount: 0,
  };
}
