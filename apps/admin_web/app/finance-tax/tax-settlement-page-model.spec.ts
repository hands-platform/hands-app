import {
  buildBookingSettlementSnapshotApiHref,
  buildBookingSettlementSnapshotDetailApiHref,
  buildBookingSettlementReversalApiHref,
  buildBookingSettlementReversalDetailApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalSummaryApiHref,
  buildBookingSettlementReversalTraceLinks,
  buildFinanceSettlementTraceLinks,
  buildCouponFinanceApiHref,
  buildCouponFinanceSummaryApiHref,
  buildBookingSettlementSnapshotRowsCsvHref,
  buildBookingSettlementSnapshotSummaryApiHref,
  buildPartnerWithholdingTaxApiHref,
  buildPartnerWithholdingTaxRowsCsvHref,
  buildPartnerWithholdingTaxSummaryApiHref,
  partnerWithholdingTaxHref,
  buildProviderWalletWithdrawalRequestSummaryApiHref,
  buildPaymentFeeMetrics,
  buildPaymentFeeSummaryCsvHref,
  buildPaymentFeeSummaryApiHref,
  buildPlatformVatMetrics,
  buildPlatformVatSummaryCsvHref,
  buildPlatformVatSummaryApiHref,
  buildTaxFinanceWorkflowLinks,
  buildFinanceOperationsPriorityLinks,
  buildFinancePayoutPriorityLinks,
  buildMonthlyTaxClosingApiHref,
  buildMonthlyTaxClosingAccountingJournalCsvHref,
  buildMonthlyTaxClosingRowsCsvHref,
  buildMonthlyTaxClosingSummaryCsvHref,
  buildMonthlyTaxClosingSummaryApiHref,
  monthlyTaxClosingHref,
  monthlyTaxClosingNextStatusOptions,
  bookingSettlementAuditHref,
  bookingSettlementAuditDetailHref,
  bookingSettlementReversalDetailHref,
  bookingSettlementReversalHref,
  buildTaxSettlementServerPagination,
  couponFinanceHref,
  buildTaxFinanceMetrics,
  buildFinanceOperationsSummaryFilters,
  buildMonthlyTaxClosingMetrics,
  buildMonthlyTaxClosingRemittanceEvidenceState,
  buildMonthlyTaxClosingRiskLinks,
  emptyMonthlyTaxClosingSummary,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from './tax-settlement-page-model';

describe('tax settlement page model', () => {
  it('defaults booking settlement audit to a bounded today needs-action queue', () => {
    const filters = readBookingSettlementFilters({});

    expect(filters).toEqual({
      page: 1,
      range: 'today',
      review: 'open',
      take: 10,
    });
    expect(buildBookingSettlementSnapshotApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots?range=today&review=open&take=10',
    );
    expect(buildBookingSettlementSnapshotDetailApiHref('settlement 1')).toBe(
      '/admin/booking-settlement-snapshots/settlement%201',
    );
    expect(buildBookingSettlementSnapshotSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/summary?range=today&review=open',
    );
    expect(buildBookingSettlementReversalSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-reversals/summary?range=today',
    );
    expect(buildBookingSettlementReversalApiHref(filters)).toBe(
      '/admin/booking-settlement-reversals?range=today&take=10',
    );
    expect(buildBookingSettlementReversalDetailApiHref('reversal 1')).toBe(
      '/admin/booking-settlement-reversals/reversal%201',
    );
    expect(buildCouponFinanceSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance-summary?range=today&review=open',
    );
    expect(buildCouponFinanceApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance?range=today&review=open&take=10',
    );
    expect(bookingSettlementAuditDetailHref('settlement 1')).toBe(
      '/finance-tax/booking-settlement-audit/settlement%201',
    );
    expect(bookingSettlementReversalDetailHref('reversal 1')).toBe(
      '/finance-tax/settlement-reversals/reversal%201',
    );
  });

  it('keeps booking settlement audit and coupon finance lists server-paginated', () => {
    const filters = readBookingSettlementFilters({ page: '3', range: '7d', review: 'posted', take: '25' });

    expect(filters).toEqual({
      page: 3,
      range: '7d',
      review: 'posted',
      take: 25,
    });
    expect(buildBookingSettlementSnapshotApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots?range=7d&review=posted&take=25&skip=50',
    );
    expect(buildCouponFinanceApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance?range=7d&review=posted&take=25&skip=50',
    );
    expect(bookingSettlementAuditHref(filters)).toBe(
      '/finance-tax/booking-settlement-audit?range=7d&review=posted&take=25&page=3',
    );
    expect(couponFinanceHref(filters)).toBe('/finance-tax/coupon-finance?range=7d&review=posted&take=25&page=3');
    expect(buildTaxSettlementServerPagination(['row-a', 'row-b'], filters, 57)).toEqual({
      from: 51,
      page: 3,
      pageSize: 25,
      rows: ['row-a', 'row-b'],
      to: 52,
      totalPages: 3,
      totalRows: 57,
    });
  });

  it('keeps partner withholding tax grouped by explicit monthly period', () => {
    const filters = readPartnerWithholdingTaxFilters({ period: '2026-06', take: '75' });

    expect(filters).toEqual({
      page: 1,
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

  it('keeps partner withholding tax rows server-paginated by monthly period', () => {
    const filters = readPartnerWithholdingTaxFilters({ page: '3', period: '2026-06', take: '25' });

    expect(filters).toEqual({
      page: 3,
      period: '2026-06',
      take: 25,
    });
    expect(buildPartnerWithholdingTaxApiHref(filters)).toBe(
      '/admin/partner-withholding-tax?period=2026-06&take=25&skip=50',
    );
    expect(partnerWithholdingTaxHref(filters)).toBe(
      '/finance-tax/partner-withholding-tax?period=2026-06&take=25&page=3',
    );
    expect(buildTaxSettlementServerPagination(['partner-a'], filters, 51)).toEqual({
      from: 51,
      page: 3,
      pageSize: 25,
      rows: ['partner-a'],
      to: 51,
      totalPages: 3,
      totalRows: 51,
    });
  });

  it('loads monthly tax closing with a bounded monthly period list', () => {
    const filters = readMonthlyTaxClosingFilters({ period: '2026-06', take: '50' });

    expect(filters).toEqual({
      page: 1,
      period: '2026-06',
      take: 50,
    });
    expect(buildMonthlyTaxClosingApiHref(filters)).toBe('/admin/monthly-tax-closings?period=2026-06&take=50');
    expect(buildMonthlyTaxClosingSummaryApiHref(filters)).toBe(
      '/admin/monthly-tax-closings/summary?period=2026-06',
    );
  });

  it('keeps stored monthly tax closing rows server-paginated by period', () => {
    const filters = readMonthlyTaxClosingFilters({ page: '2', period: '2026-06', take: '25' });

    expect(filters).toEqual({
      page: 2,
      period: '2026-06',
      take: 25,
    });
    expect(buildMonthlyTaxClosingApiHref(filters)).toBe(
      '/admin/monthly-tax-closings?period=2026-06&take=25&skip=25',
    );
    expect(monthlyTaxClosingHref(filters)).toBe('/finance-tax/monthly-tax-closing?period=2026-06&take=25&page=2');
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
      ['Booking settlement audit', '/finance-tax/booking-settlement-audit?range=7d&review=paid&take=50'],
      ['Settlement reversals', '/finance-tax/settlement-reversals?range=7d&take=50'],
      ['General ledger', '/finance-tax/general-ledger?range=7d&take=50'],
      ['Finance approvers', '/finance-tax/finance-approvers'],
      ['Payment clearing', '/finance-tax/payment-clearing?range=7d&take=50'],
      ['Bank reconciliation', '/finance-tax/bank-reconciliation?range=7d&take=50'],
      ['Coupon finance', '/finance-tax/coupon-finance?range=7d&review=paid&take=50'],
      ['Monthly tax closing', '/finance-tax/monthly-tax-closing?period=2026-06&take=75'],
      ['Payment fees', '/finance-tax/payment-fees?period=2026-06'],
      ['Partner withholding tax', '/finance-tax/partner-withholding-tax?period=2026-06&take=75'],
    ]);
  });

  it('builds settlement reversal hrefs with booking settlement pagination filters', () => {
    const filters = readBookingSettlementFilters({ page: '2', range: '30d', review: 'non-cash', take: '50' });

    expect(bookingSettlementReversalHref(filters)).toBe(
      '/finance-tax/settlement-reversals?range=30d&review=non-cash&take=50&page=2',
    );
    expect(buildBookingSettlementReversalApiHref(filters)).toBe(
      '/admin/booking-settlement-reversals?range=30d&review=non-cash&take=50&skip=50',
    );
    expect(buildBookingSettlementReversalSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-reversals/summary?range=30d&review=non-cash',
    );
  });

  it('builds settlement reversal trace links to journal and clearing evidence', () => {
    const links = buildBookingSettlementReversalTraceLinks({
      accountingJournalBatches: [
        {
          id: 'journal-batch-1',
          sourceKey: 'accounting-journal:booking-settlement-reversal:settlement-1',
          status: 'POSTED',
        },
      ],
      monthlyPeriod: '2026-07',
      originalMonthlyClosingId: 'closing-1',
      originalMonthlyPeriod: '2026-06',
      originalSettlementSnapshotId: 'settlement-1',
      paymentClearingEntries: [
        {
          id: 'clearing-1',
          bankReconciliationMatches: [
            {
              bankTransactionId: 'bank-transaction-1',
              bankTransaction: { transferRef: 'REFUND-001' },
              status: 'PARTIALLY_MATCHED',
            },
          ],
          sourceKey: 'booking-payment-clearing:booking-1:refund-reversal',
          status: 'REVERSED',
        },
      ],
    } as never);

    expect(links).toEqual([
      {
        href: '/finance-tax/booking-settlement-audit/settlement-1',
        label: 'Original settlement',
        value: 'settleme',
      },
      {
        href: '/finance-tax/monthly-tax-closing?period=2026-06',
        label: 'Original monthly close',
        value: '2026-06',
      },
      {
        href: '/finance-tax/monthly-tax-closing?period=2026-07',
        label: 'Reversal monthly close',
        value: '2026-07',
      },
      {
        href: '/finance-tax/general-ledger/journal-batch-1',
        label: 'Reversal journal',
        value: 'journal-',
      },
      {
        href: '/finance-tax/payment-clearing/clearing-1',
        label: 'Payment clearing',
        value: 'clearing',
      },
      {
        href: '/finance-tax/bank-reconciliation/bank-transaction-1',
        label: 'Bank match',
        value: 'REFUND-001',
      },
    ]);
  });

  it('summarizes settlement reversal evidence readiness for operations', () => {
    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [
          {
            id: 'journal-1',
            sourceKey: 'journal:1',
            status: 'POSTED',
            totalCredit: 100000,
            totalDebit: 100000,
            postedAt: '2026-07-01',
          },
        ],
        paymentClearingEntries: [
          {
            amount: 100000,
            currency: 'VND',
            id: 'clearing-1',
            occurredAt: '2026-07-01',
            sourceKey: 'clearing:1',
            status: 'CLEARED',
            type: 'REFUND_REVERSAL',
          },
        ],
      }),
    ).toEqual({
      detail: 'Journal POSTED · Clearing CLEARED',
      label: 'Evidence complete',
      tone: 'success',
    });

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [
          {
            id: 'journal-1',
            sourceKey: 'journal:1',
            status: 'POSTED',
            totalCredit: 100000,
            totalDebit: 100000,
            postedAt: '2026-07-01',
          },
        ],
        paymentClearingEntries: [
          {
            amount: 100000,
            currency: 'VND',
            id: 'clearing-1',
            occurredAt: '2026-07-01',
            sourceKey: 'clearing:1',
            status: 'OPEN',
            type: 'REFUND_REVERSAL',
          },
        ],
      }),
    ).toEqual({
      detail: 'Journal POSTED · Clearing OPEN',
      label: 'Clearing open',
      tone: 'warning',
    });

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [],
        paymentClearingEntries: [],
      }),
    ).toEqual({
      detail: 'Journal missing · Clearing missing',
      label: 'Evidence missing',
      tone: 'danger',
    });
  });

  it('builds finance detail trace links back to settlement and reversal queues', () => {
    const links = buildFinanceSettlementTraceLinks({
      settlementSnapshotId: 'settlement-1',
      settlementReversalEntryId: 'reversal-1',
    });

    expect(links).toEqual([
      {
        href: '/finance-tax/booking-settlement-audit/settlement-1',
        label: 'Settlement record',
        value: 'settleme',
      },
      {
        href: '/finance-tax/settlement-reversals?range=all&review=reversed',
        label: 'Settlement reversal',
        value: 'reversal',
      },
    ]);
  });

  it('builds payout priority shortcuts without adding list payload to tax overview', () => {
    const settlementFilters = readBookingSettlementFilters({ range: '7d', review: 'open' });

    const links = buildFinancePayoutPriorityLinks(settlementFilters, {
      bankTransferPending: 3,
      bankTransferPendingAmount: 900_000,
      currency: 'VND',
      lockReleased: 1,
      paidAmount: 500_000,
      pendingWithdrawalPayableAmount: 1_600_000,
      requested: 2,
      requestedAmount: 700_000,
      returnedAmount: 300_000,
      reviewRequired: 1,
      total: 6,
      totalAmount: 2_400_000,
    });

    expect(links.map((link) => [link.label, link.href, link.amount, link.currency, link.amountSuffix])).toEqual([
      ['Withdrawal requested', '/payouts?range=7d&withdrawalStatus=REQUESTED', 700_000, 'VND', null],
      ['Review required', '/payouts?range=7d&withdrawalStatus=REVIEW_REQUIRED', 1_600_000, 'VND', 'locked'],
      ['Bank transfer pending', '/payouts?range=7d&withdrawalStatus=BANK_TRANSFER_PENDING', 900_000, 'VND', null],
      ['Cash debt gate', '/cash-settlements?range=7d', null, null, null],
    ]);
  });

  it('builds finance operations priority links from summary APIs only', () => {
    const settlementFilters = readBookingSettlementFilters({ range: 'today', review: 'open' });
    const accountingFilters = readFinanceAccountingFilters({ range: 'today', review: 'all' });
    const monthlyFilters = readMonthlyTaxClosingFilters({ period: '2026-06' });

    const links = buildFinanceOperationsPriorityLinks({
      accountingFilters,
      bankSummary: {
        amount: 800_000,
        count: 5,
        currency: 'VND',
        matchedCount: 2,
        unmatchedCount: 3,
      },
      clearingSummary: {
        amount: 1_200_000,
        clearedCount: 4,
        count: 6,
        currency: 'VND',
        openCount: 2,
      },
      monthlyClosingFilters: monthlyFilters,
      monthlyClosingSummary: {
        ...emptyMonthlyTaxClosingSummary('2026-06'),
        cashDebtTotal: 170_000,
        couponReviewFlagCount: 1,
        openTaxCount: 2,
        reconciliationDelta: 50_000,
      },
      settlementFilters,
      settlementSummary: {
        count: 9,
        currency: 'VND',
        customerPaymentAmount: 2_000_000,
        partnerPayoutAmount: 1_300_000,
        partnerWithholdingTotal: 120_000,
        platformFeeGross: 420_000,
        platformFeeNetRevenue: 381_818,
        companyOutputVat: 38_182,
        paymentProcessingFee: 20_000,
        openTaxCount: 4,
        paidTaxCount: 1,
      },
    });

    expect(links.map((link) => [link.label, link.href, link.count, link.amount, link.currency, link.amountSuffix, link.signal])).toEqual([
      ['Today needs action', '/finance-tax/booking-settlement-audit?range=today&review=open', 4, null, null, null, 'Needs action'],
      ['Payment clearing open', '/finance-tax/payment-clearing?range=today&review=open', 2, 1_200_000, 'VND', null, 'Unsettled'],
      ['Bank unmatched', '/finance-tax/bank-reconciliation?range=today&review=unmatched', 3, 800_000, 'VND', null, 'Unmatched'],
      ['Monthly close risk', '/finance-tax/monthly-tax-closing?period=2026-06', 3, 170_000, 'VND', 'cash debt', 'Closeout risk'],
    ]);
  });

  it('uses needs-action accounting filters for finance overview summaries', () => {
    const accountingFilters = readFinanceAccountingFilters({ range: 'today', review: 'all', take: '50' });

    const filters = buildFinanceOperationsSummaryFilters(accountingFilters);

    expect(filters).toEqual({
      clearingFilters: {
        page: 1,
        range: 'today',
        review: 'open',
        take: 50,
      },
      bankFilters: {
        page: 1,
        range: 'today',
        review: 'unmatched',
        take: 50,
      },
    });
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
      couponSettlementCount: 1,
      couponDiscountAmountTotal: 60_000,
      companyCouponExpenseTotal: 60_000,
      partnerFundedCouponAmountTotal: 0,
      platformFeeDiscountAmountTotal: 0,
      couponReviewFlagCount: 1,
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
      ['Coupon expense', '60.000 VND'],
      ['Formula delta', '0 VND'],
      ['Net revenue delta', '0 VND'],
    ]);
  });

  it('summarizes monthly tax remittance evidence readiness', () => {
    expect(
      buildMonthlyTaxClosingRemittanceEvidenceState({
        paidAt: '2026-07-02T10:00:00.000Z',
        remittanceMetadata: {
          channel: 'VCB manual transfer',
          evidenceUrl: 'https://evidence.example/tax-receipt.pdf',
          paidAt: '2026-07-02T10:00:00.000Z',
          transferRef: 'TAX-PAID-001',
        },
        status: 'PAID',
      }),
    ).toEqual({
      detail: 'TAX-PAID-001 · VCB manual transfer',
      evidenceHref: 'https://evidence.example/tax-receipt.pdf',
      label: 'Evidence retained',
      tone: 'success',
    });

    expect(
      buildMonthlyTaxClosingRemittanceEvidenceState({
        paidAt: '2026-07-02T10:00:00.000Z',
        remittanceMetadata: { transferRef: 'TAX-PAID-002' },
        status: 'PAID',
      }),
    ).toEqual({
      detail: 'Missing evidence URL',
      evidenceHref: null,
      label: 'Evidence incomplete',
      tone: 'warning',
    });

    expect(
      buildMonthlyTaxClosingRemittanceEvidenceState({
        paidAt: null,
        remittanceMetadata: null,
        status: 'DECLARED',
      }),
    ).toEqual({
      detail: 'Tax declaration is not paid yet.',
      evidenceHref: null,
      label: 'Pending remittance',
      tone: 'neutral',
    });
  });

  it('builds monthly closing risk links from the summary without loading row lists', () => {
    const settlementFilters = readBookingSettlementFilters({ range: '30d', review: 'open' });
    const closingFilters = readMonthlyTaxClosingFilters({ period: '2026-06' });
    const summary = {
      ...emptyMonthlyTaxClosingSummary('2026-06'),
      cashDebtTotal: 170_000,
      couponReviewFlagCount: 2,
      openTaxCount: 3,
      reconciliationDelta: 50_000,
      netRevenueDelta: 10_000,
    };

    const links = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, closingFilters);

    expect(links.map((link) => [link.label, link.href, link.count, link.amount, link.currency, link.amountSuffix, link.signal])).toEqual([
      ['Open tax rows', '/finance-tax/booking-settlement-audit?range=30d&review=open', 3, null, null, null, 'Tax review'],
      ['Coupon review flags', '/finance-tax/coupon-finance?range=30d&review=open', 2, null, null, null, 'Coupon review'],
      ['Cash debt gate', '/cash-settlements?range=30d', null, 170_000, 'VND', null, 'Cash debt'],
      ['Reconciliation deltas', '/finance-tax/monthly-tax-closing?period=2026-06', 2, 60_000, 'VND', null, 'Formula check'],
    ]);
  });

  it('limits monthly tax closing status actions to the next safe status', () => {
    expect(monthlyTaxClosingNextStatusOptions('DRAFT').map((option) => option.value)).toEqual(['REVIEWED']);
    expect(monthlyTaxClosingNextStatusOptions('REVIEWED').map((option) => option.value)).toEqual([
      'DECLARED',
    ]);
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
        couponSettlementCount: 1,
        couponDiscountAmountTotal: 60000,
        companyCouponExpenseTotal: 60000,
        partnerFundedCouponAmountTotal: 0,
        platformFeeDiscountAmountTotal: 0,
        couponReviewFlagCount: 1,
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
    expect(rowsCsv).toContain('"\'+84900000001"');
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
    expect(rowsCsv).toContain('"\'+84900000001"');
    expect(rowsCsv).toContain('"Smoke Partner"');
    expect(rowsCsv).toContain('"\'+84900000002"');
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
        couponSettlementCount: 1,
        couponDiscountAmountTotal: 60_000,
        companyCouponExpenseTotal: 60_000,
        partnerFundedCouponAmountTotal: 0,
        platformFeeDiscountAmountTotal: 0,
        couponReviewFlagCount: 1,
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
    expect(journalCsv).toContain('"customer_coupon_marketing_expense","2026-06","VND","DEBIT"');
    expect(journalCsv).toContain('"coupon_discount_clearing","2026-06","VND","CREDIT"');
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
