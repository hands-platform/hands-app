import {
  buildAccountingJournalBatchApiHref,
  buildAccountingJournalBatchSummaryApiHref,
  buildBookingSettlementSnapshotApiHref,
  buildBankReconciliationApiHref,
  buildBankReconciliationEvidenceSourceSummaryApiHref,
  buildBankReconciliationReviewOwnerSummaryApiHref,
  buildBankReconciliationSummaryApiHref,
  buildBookingPaymentClearingApiHref,
  buildBookingPaymentClearingReviewOwnerSummaryApiHref,
  buildBookingPaymentClearingSummaryApiHref,
  buildBookingSettlementSnapshotDetailApiHref,
  buildBookingSettlementReversalApiHref,
  buildBookingSettlementReversalDetailApiHref,
  buildBookingSettlementReversalEvidenceState,
  buildBookingSettlementReversalSummaryApiHref,
  buildBookingSettlementReversalTraceLinks,
  buildFinanceSettlementTraceLinks,
  buildGeneralLedgerExportHref,
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
  buildMonthlyTaxClosingHistoryApiHref,
  buildMonthlyTaxClosingRowsCsvHref,
  buildMonthlyTaxClosingSummaryCsvHref,
  buildMonthlyTaxClosingSummaryApiHref,
  monthlyTaxClosingHref,
  bankReconciliationHref,
  paymentClearingHref,
  paymentClearingDetailHref,
  monthlyTaxClosingNextStatusOptions,
  bookingSettlementAuditHref,
  bookingSettlementAuditDetailHref,
  bookingSettlementReversalDetailHref,
  bookingSettlementReversalHref,
  buildTaxSettlementServerPagination,
  couponFinanceHref,
  generalLedgerDetailHref,
  generalLedgerHref,
  buildTaxFinanceMetrics,
  buildFinanceOperationsSummaryFilters,
  buildMonthlyTaxClosingMetrics,
  buildMonthlyTaxCloseoutCommandState,
  buildMonthlyTaxClosingRemittanceEvidenceState,
  buildMonthlyTaxClosingPreflightLinks,
  buildMonthlyTaxClosingRiskLinks,
  emptyBookingSettlementSummary,
  emptyMonthlyTaxClosingSummary,
  GENERAL_LEDGER_REVIEW_LINKS,
  readBookingSettlementFilters,
  readBookingSettlementAuditFilters,
  readCouponFinanceFilters,
  readFinanceAccountingFilters,
  readPaymentClearingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
  resolveMonthlyTaxClosingPreflight,
  safeBankReconciliationReturnTo,
  safePaymentClearingDetailReturnTo,
  safeBookingSettlementAuditReturnTo,
  safeBookingSettlementReversalReturnTo,
  safeGeneralLedgerReturnTo,
} from './tax-settlement-page-model';

describe('tax settlement page model', () => {
  it('keeps only local Bank Reconciliation return context', () => {
    expect(
      safeBankReconciliationReturnTo(
        '/finance-tax/bank-reconciliation?workspace=imports&importRange=all#bank-reconciliation-imports',
      ),
    ).toBe('/finance-tax/bank-reconciliation?workspace=imports&importRange=all#bank-reconciliation-imports');
    expect(safeBankReconciliationReturnTo('https://example.com/finance-tax/bank-reconciliation')).toBe(
      '/finance-tax/bank-reconciliation?range=all&review=unmatched',
    );
    expect(safeBankReconciliationReturnTo('/finance-tax/bank-reconciliation-evil')).toBe(
      '/finance-tax/bank-reconciliation?range=all&review=unmatched',
    );
    expect(
      safeBankReconciliationReturnTo(
        '/finance-tax/payment-clearing/clearing-1?returnTo=%2Ffinance-tax%2Fpayment-clearing',
      ),
    ).toContain('/finance-tax/payment-clearing/clearing-1');
  });

  it('keeps payment clearing list context local and rejects external return URLs', () => {
    const listHref =
      '/finance-tax/payment-clearing?range=all&review=open&owner=unassigned&age=48h&page=4&take=25&q=booking-1&sort=oldest';

    expect(safePaymentClearingDetailReturnTo(listHref)).toBe(listHref);
    expect(paymentClearingDetailHref('clearing-1', listHref)).toContain(
      `returnTo=${encodeURIComponent(listHref)}`,
    );
    expect(safePaymentClearingDetailReturnTo('https://example.com/finance-tax/payment-clearing')).toBe(
      '/finance-tax/payment-clearing?range=all&review=unresolved&page=1&take=25',
    );
    expect(safePaymentClearingDetailReturnTo('/finance-tax/payment-clearing-evil')).toBe(
      '/finance-tax/payment-clearing?range=all&review=unresolved&page=1&take=25',
    );
  });

  it('preserves payment clearing assignment filters in list and summary API links', () => {
    const filters = readFinanceAccountingFilters({
      assigneeAdminId: 'admin-1',
      assignment: 'assigned',
      range: 'all',
      review: 'open',
      take: '25',
    });

    expect(buildBookingPaymentClearingApiHref(filters)).toBe(
      '/admin/booking-payment-clearing?range=all&take=25&review=open&assignment=assigned&assigneeAdminId=admin-1',
    );
    expect(buildBookingPaymentClearingSummaryApiHref(filters)).toBe(
      '/admin/booking-payment-clearing/summary?range=all&review=open&assignment=assigned&assigneeAdminId=admin-1',
    );
    expect(buildBookingPaymentClearingReviewOwnerSummaryApiHref(filters)).toBe(
      '/admin/booking-payment-clearing/review-owner-summary?range=all&review=open',
    );
  });

  it('defaults Payment Clearing to the complete unresolved queue', () => {
    expect(readPaymentClearingFilters({})).toEqual({
      page: 1,
      range: 'all',
      review: 'unresolved',
      sort: 'oldest',
      take: 10,
    });
  });

  it('keeps cleared and reversed payment evidence in one terminal history filter', () => {
    const filters = readPaymentClearingFilters({ range: 'all', review: 'terminal' });

    expect(filters).toEqual({
      page: 1,
      range: 'all',
      review: 'terminal',
      sort: 'recent',
      take: 10,
    });
    expect(buildBookingPaymentClearingApiHref(filters)).toBe(
      '/admin/booking-payment-clearing?range=all&take=10&review=terminal&sort=recent',
    );
  });

  it('keeps the 48h payment clearing SLA filter across list, summary, owner, and page links', () => {
    const filters = readPaymentClearingFilters({
      age: '48h',
      owner: 'unassigned',
      page: '2',
      range: 'all',
      review: 'open',
      take: '25',
    });

    expect(filters).toEqual({
      page: 2,
      paymentClearingAge: '48h',
      range: 'all',
      review: 'open',
      sort: 'oldest',
      take: 25,
    });
    expect(buildBookingPaymentClearingApiHref(filters)).toBe(
      '/admin/booking-payment-clearing?range=all&take=25&review=open&sort=oldest&skip=25&age=48h',
    );
    expect(buildBookingPaymentClearingSummaryApiHref(filters)).toBe(
      '/admin/booking-payment-clearing/summary?range=all&review=open&age=48h',
    );
    expect(buildBookingPaymentClearingReviewOwnerSummaryApiHref(filters)).toBe(
      '/admin/booking-payment-clearing/review-owner-summary?range=all&review=open&age=48h',
    );
    expect(paymentClearingHref(filters)).toBe(
      '/finance-tax/payment-clearing?range=all&review=open&sort=oldest&take=25&page=2&age=48h',
    );
  });

  it('keeps the 48h SLA filter for the combined unresolved queue', () => {
    const filters = readPaymentClearingFilters({ age: '48h', range: 'all', review: 'unresolved' });

    expect(buildBookingPaymentClearingApiHref(filters)).toBe(
      '/admin/booking-payment-clearing?range=all&take=10&review=unresolved&sort=oldest&age=48h',
    );
    expect(paymentClearingHref(filters)).toBe(
      '/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest&age=48h',
    );
  });

  it('drops the payment clearing age filter from historical records', () => {
    expect(readPaymentClearingFilters({ age: '48h', range: 'all', review: 'cleared' })).toEqual({
      page: 1,
      range: 'all',
      review: 'cleared',
      sort: 'recent',
      take: 10,
    });
  });

  it('keeps bank transaction direction independent from reconciliation status', () => {
    const filters = readFinanceAccountingFilters(
      {
        age: '48h',
        page: '2',
        range: '30d',
        review: 'unmatched',
        source: 'partner-deposit',
        take: '25',
        type: 'outflow',
      },
      'unmatched',
    );

    expect(filters).toEqual({
      bankReconciliationAge: '48h',
      bankReconciliationSource: 'PARTNER_DEPOSIT',
      bankTransactionType: 'OUTFLOW',
      page: 2,
      range: '30d',
      review: 'unmatched',
      take: 25,
    });
    expect(buildBankReconciliationApiHref(filters)).toBe(
      '/admin/bank-reconciliation?range=30d&take=25&review=unmatched&skip=25&type=OUTFLOW&source=PARTNER_DEPOSIT&age=48h',
    );
    expect(buildBankReconciliationSummaryApiHref(filters)).toBe(
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&type=OUTFLOW&source=PARTNER_DEPOSIT&age=48h',
    );
    expect(buildBankReconciliationReviewOwnerSummaryApiHref(filters)).toBe(
      '/admin/bank-reconciliation/review-owner-summary?range=30d&review=unmatched&type=OUTFLOW&source=PARTNER_DEPOSIT&age=48h',
    );
    expect(buildBankReconciliationEvidenceSourceSummaryApiHref(filters)).toBe(
      '/admin/bank-reconciliation/evidence-source-summary?range=30d&review=unmatched&type=OUTFLOW&age=48h',
    );
    expect(bankReconciliationHref(filters)).toBe(
      '/finance-tax/bank-reconciliation?range=30d&review=unmatched&take=25&page=2&type=OUTFLOW&source=PARTNER_DEPOSIT&age=48h',
    );
  });

  it('keeps the bank reconciliation age filter only on unresolved queues', () => {
    expect(
      readFinanceAccountingFilters({ age: '48h', range: '30d', review: 'partial' }, 'unmatched'),
    ).toEqual({
      bankReconciliationAge: '48h',
      page: 1,
      range: '30d',
      review: 'partial',
      take: 10,
    });
    expect(
      readFinanceAccountingFilters({ age: '48h', range: '30d', review: 'matched' }, 'unmatched'),
    ).toEqual({
      page: 1,
      range: '30d',
      review: 'matched',
      take: 10,
    });
  });

  it('ignores unsupported bank reconciliation evidence sources in page URLs', () => {
    expect(
      readFinanceAccountingFilters(
        { range: '30d', review: 'unmatched', source: 'free-text-description' },
        'unmatched',
      ),
    ).toEqual({
      page: 1,
      range: '30d',
      review: 'unmatched',
      take: 10,
    });
  });

  it('translates legacy bank direction review links without breaking the default queue', () => {
    expect(readFinanceAccountingFilters({ range: 'all', review: 'inflow' }, 'unmatched')).toEqual({
      bankTransactionType: 'INFLOW',
      page: 1,
      range: 'all',
      review: 'unmatched',
      take: 10,
    });
  });

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

  it('uses an all-date oldest-first backlog only for the settlement audit workspace', () => {
    const filters = readBookingSettlementAuditFilters({});

    expect(filters).toEqual({
      page: 1,
      range: 'all',
      review: 'integrity-exceptions',
      sort: 'oldest',
      take: 25,
    });
    expect(bookingSettlementAuditHref(filters)).toBe(
      '/finance-tax/booking-settlement-audit?range=all&review=integrity-exceptions&sort=oldest&take=25',
    );
  });

  it('maps legacy settlement evidence links into primary queues and explicit reasons', () => {
    expect(readBookingSettlementAuditFilters({ review: 'clearing-evidence' })).toMatchObject({
      reason: 'clearing',
      review: 'payment-evidence',
    });
    expect(readBookingSettlementAuditFilters({ review: 'journal-evidence' })).toMatchObject({
      reason: 'journal',
      review: 'integrity-exceptions',
    });
    expect(readBookingSettlementAuditFilters({ review: 'tax-open' })).toMatchObject({
      review: 'tax-workflow',
      status: 'open',
    });
  });

  it('preserves settlement owner, reason, status, and cursor in bounded API links', () => {
    const filters = {
      ...readBookingSettlementAuditFilters({
        owner: 'accounting',
        reason: 'allocation',
        review: 'integrity-exceptions',
        status: 'open',
      }),
      cursor: 'cursor-token',
      page: 4,
    };

    expect(buildBookingSettlementSnapshotApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots?range=all&review=integrity-exceptions&sort=oldest&owner=accounting&reason=allocation&status=open&take=25&cursor=cursor-token',
    );
    expect(buildBookingSettlementSnapshotSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/summary?range=all&review=integrity-exceptions&sort=oldest&owner=accounting&reason=allocation&status=open',
    );
  });

  it('keeps settlement audit detail return context on the exact local audit route', () => {
    const returnTo =
      '/finance-tax/booking-settlement-audit?range=all&review=journal-evidence&q=Demo+Customer';

    expect(safeBookingSettlementAuditReturnTo(returnTo)).toBe(returnTo);
    expect(
      safeBookingSettlementAuditReturnTo('https://example.com/finance-tax/booking-settlement-audit'),
    ).toBe('/finance-tax/booking-settlement-audit?range=all&review=integrity-exceptions&sort=oldest&take=25');
    expect(safeBookingSettlementAuditReturnTo('//example.com/finance-tax/booking-settlement-audit')).toBe(
      '/finance-tax/booking-settlement-audit?range=all&review=integrity-exceptions&sort=oldest&take=25',
    );
    expect(safeBookingSettlementAuditReturnTo('/finance-tax/booking-settlement-audit/other')).toBe(
      '/finance-tax/booking-settlement-audit?range=all&review=integrity-exceptions&sort=oldest&take=25',
    );
  });

  it('keeps settlement reversal list context and rejects unsafe return targets', () => {
    const returnTo = '/finance-tax/settlement-reversals?range=all&review=non-cash&take=50&page=2';

    expect(bookingSettlementReversalDetailHref('reversal 1', returnTo)).toBe(
      '/finance-tax/settlement-reversals/reversal%201?returnTo=%2Ffinance-tax%2Fsettlement-reversals%3Frange%3Dall%26review%3Dnon-cash%26take%3D50%26page%3D2',
    );
    expect(safeBookingSettlementReversalReturnTo(returnTo)).toBe(returnTo);
    expect(
      safeBookingSettlementReversalReturnTo('https://example.com/finance-tax/settlement-reversals'),
    ).toBe('/finance-tax/settlement-reversals?range=30d&take=25');
    expect(safeBookingSettlementReversalReturnTo('//example.com/finance-tax/settlement-reversals')).toBe(
      '/finance-tax/settlement-reversals?range=30d&take=25',
    );
    expect(safeBookingSettlementReversalReturnTo('/finance-tax/general-ledger')).toBe(
      '/finance-tax/settlement-reversals?range=30d&take=25',
    );
    expect(safeBookingSettlementReversalReturnTo('/finance-tax/settlement-reversals\\evil')).toBe(
      '/finance-tax/settlement-reversals?range=30d&take=25',
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
    expect(couponFinanceHref(filters)).toBe(
      '/finance-tax/coupon-finance?range=7d&review=posted&take=25&page=3',
    );
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

  it('preserves the coupon-specific review queue through UI and API links', () => {
    const filters = readCouponFinanceFilters({
      page: '2',
      range: '30d',
      review: 'coupon-review',
      take: '25',
    });

    expect(filters.review).toBe('coupon-review');
    expect(buildCouponFinanceSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance-summary?range=30d&review=coupon-review',
    );
    expect(buildCouponFinanceApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/coupon-finance?range=30d&review=coupon-review&take=25&skip=25',
    );
    expect(couponFinanceHref(filters)).toBe(
      '/finance-tax/coupon-finance?range=30d&review=coupon-review&take=25&page=2',
    );
  });

  it('keeps coupon all-records explicit through URL round trips and pagination changes', () => {
    const filters = readCouponFinanceFilters({
      page: '3',
      range: 'all',
      review: 'all',
      take: '50',
    });
    const href = couponFinanceHref(filters);

    expect(href).toBe('/finance-tax/coupon-finance?range=all&review=all&take=50&page=3');
    expect(
      readCouponFinanceFilters(
        Object.fromEntries(new URL(href, 'http://hands.local').searchParams.entries()),
      ),
    ).toEqual(filters);
    expect(couponFinanceHref({ ...filters, page: 1, range: '30d', take: 100 })).toBe(
      '/finance-tax/coupon-finance?range=30d&review=all&take=100',
    );
  });

  it('builds a monthly payment fee evidence queue without loading all settlement rows', () => {
    const filters = readBookingSettlementFilters({
      period: '2026-07',
      paymentMethod: 'momo',
      range: 'all',
      review: 'payment-fee-evidence',
      take: '25',
    });

    expect(filters).toEqual({
      page: 1,
      paymentMethod: 'MOMO',
      period: '2026-07',
      range: 'all',
      review: 'payment-fee-evidence',
      take: 25,
    });
    expect(buildBookingSettlementSnapshotApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots?range=all&review=payment-fee-evidence&period=2026-07&paymentMethod=MOMO&take=25',
    );
    expect(buildBookingSettlementSnapshotSummaryApiHref(filters)).toBe(
      '/admin/booking-settlement-snapshots/summary?range=all&review=payment-fee-evidence&period=2026-07&paymentMethod=MOMO',
    );
    expect(bookingSettlementAuditHref(filters)).toBe(
      '/finance-tax/booking-settlement-audit?range=all&review=payment-fee-evidence&period=2026-07&paymentMethod=MOMO&take=25',
    );
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
    expect(buildMonthlyTaxClosingHistoryApiHref(filters)).toBe('/admin/monthly-tax-closings?take=50');
    expect(buildMonthlyTaxClosingSummaryApiHref(filters)).toBe(
      '/admin/monthly-tax-closings/summary?period=2026-06',
    );
  });

  it('keeps monthly closing history server-paginated independently from the selected period', () => {
    const filters = readMonthlyTaxClosingFilters({ page: '2', period: '2026-06', take: '25' });

    expect(filters).toEqual({
      page: 2,
      period: '2026-06',
      take: 25,
    });
    expect(buildMonthlyTaxClosingApiHref(filters)).toBe(
      '/admin/monthly-tax-closings?period=2026-06&take=25&skip=25',
    );
    expect(buildMonthlyTaxClosingHistoryApiHref(filters)).toBe('/admin/monthly-tax-closings?take=25&skip=25');
    expect(monthlyTaxClosingHref(filters)).toBe(
      '/finance-tax/monthly-tax-closing?period=2026-06&take=25&page=2',
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
      ['Finance approval queue', '/finance-tax/approval-queue'],
      ['Booking settlement audit', '/finance-tax/booking-settlement-audit?range=7d&review=paid&take=50'],
      ['Closed-period reversals', '/finance-tax/settlement-reversals?range=7d&take=50'],
      ['Journal batches', '/finance-tax/general-ledger?range=7d&take=50&review=all'],
      ['Finance approvers', '/finance-tax/finance-approvers'],
      ['Payment clearing', '/finance-tax/payment-clearing?range=7d&take=50'],
      ['Bank reconciliation', '/finance-tax/bank-reconciliation?range=7d&take=50'],
      ['Coupon finance', '/finance-tax/coupon-finance?range=7d&review=paid&take=50'],
      ['Monthly tax closing', '/finance-tax/monthly-tax-closing?period=2026-06&take=75'],
      ['Payment fees', '/finance-tax/payment-fees?period=2026-06'],
      ['Partner withholding tax', '/finance-tax/partner-withholding-tax?period=2026-06&take=75'],
    ]);
  });

  it('keeps journal batch scope explicit across list, detail return, and audited export URLs', () => {
    const filters = readFinanceAccountingFilters({
      page: '2',
      period: '2026-07',
      q: 'booking 42',
      range: '30d',
      review: 'all',
      sort: 'largest-discrepancy',
      source: 'BOOKING_SETTLEMENT',
      take: '25',
    });
    const listHref = generalLedgerHref(filters);

    expect(listHref).toBe(
      '/finance-tax/general-ledger?range=30d&period=2026-07&q=booking+42&sort=largest-discrepancy&take=25&page=2&review=all&source=BOOKING_SETTLEMENT',
    );
    expect(buildAccountingJournalBatchApiHref(filters)).toBe(
      '/admin/accounting-journal-batches?range=30d&take=25&period=2026-07&q=booking+42&sort=largest-discrepancy&skip=25&review=all&source=BOOKING_SETTLEMENT',
    );
    expect(buildAccountingJournalBatchSummaryApiHref(filters)).toBe(
      '/admin/accounting-journal-batches/summary?range=30d&period=2026-07&q=booking+42&review=all&source=BOOKING_SETTLEMENT',
    );
    expect(generalLedgerDetailHref('journal-42', listHref)).toBe(
      `/finance-tax/general-ledger/journal-42?returnTo=${encodeURIComponent(listHref)}`,
    );
    expect(buildGeneralLedgerExportHref(filters)).toBe(
      '/api/admin/finance-tax/general-ledger/export?range=30d&period=2026-07&q=booking+42&sort=largest-discrepancy&review=all&source=BOOKING_SETTLEMENT',
    );
    expect(safeGeneralLedgerReturnTo(listHref)).toBe(listHref);
    expect(safeGeneralLedgerReturnTo('https://example.com/finance-tax/general-ledger')).toBe(
      '/finance-tax/general-ledger?range=all&review=needs-action&page=1&take=25',
    );
    expect(safeGeneralLedgerReturnTo('//example.com/finance-tax/general-ledger')).toBe(
      '/finance-tax/general-ledger?range=all&review=needs-action&page=1&take=25',
    );
  });

  it('preserves the unassigned-period journal queue across page, API, summary, and export URLs', () => {
    const filters = readFinanceAccountingFilters(
      { range: 'all', review: 'unassigned-period', take: '25' },
      'needs-action',
    );

    expect(filters.review).toBe('unassigned-period');
    expect(generalLedgerHref(filters)).toBe(
      '/finance-tax/general-ledger?range=all&review=unassigned-period&take=25',
    );
    expect(buildAccountingJournalBatchApiHref(filters)).toBe(
      '/admin/accounting-journal-batches?range=all&take=25&review=unassigned-period',
    );
    expect(buildAccountingJournalBatchSummaryApiHref(filters)).toBe(
      '/admin/accounting-journal-batches/summary?range=all&review=unassigned-period',
    );
    expect(buildGeneralLedgerExportHref(filters)).toBe(
      '/api/admin/finance-tax/general-ledger/export?range=all&review=unassigned-period',
    );
  });

  it('preserves the evidence-unknown journal queue across page, API, summary, and export URLs', () => {
    const filters = readFinanceAccountingFilters(
      { range: 'all', review: 'unknown', take: '25' },
      'needs-action',
    );

    expect(filters.review).toBe('unknown');
    expect(GENERAL_LEDGER_REVIEW_LINKS).toContainEqual({
      label: 'Evidence unknown',
      review: 'unknown',
    });
    expect(generalLedgerHref(filters)).toBe('/finance-tax/general-ledger?range=all&review=unknown&take=25');
    expect(buildAccountingJournalBatchApiHref(filters)).toBe(
      '/admin/accounting-journal-batches?range=all&take=25&review=unknown',
    );
    expect(buildAccountingJournalBatchSummaryApiHref(filters)).toBe(
      '/admin/accounting-journal-batches/summary?range=all&review=unknown',
    );
    expect(buildGeneralLedgerExportHref(filters)).toBe(
      '/api/admin/finance-tax/general-ledger/export?range=all&review=unknown',
    );
  });

  it('labels reversed batch lifecycle status separately from settlement reversal source records', () => {
    expect(GENERAL_LEDGER_REVIEW_LINKS).toContainEqual({
      label: 'Reversed batch status',
      review: 'reversed',
    });

    const settlementReversals = readFinanceAccountingFilters({
      range: 'all',
      review: 'all',
      source: 'BOOKING_SETTLEMENT_REVERSAL',
    });
    expect(generalLedgerHref(settlementReversals)).toBe(
      '/finance-tax/general-ledger?range=all&review=all&source=BOOKING_SETTLEMENT_REVERSAL',
    );
    expect(buildAccountingJournalBatchApiHref(settlementReversals)).toBe(
      '/admin/accounting-journal-batches?range=all&take=10&review=all&source=BOOKING_SETTLEMENT_REVERSAL',
    );
    expect(buildGeneralLedgerExportHref(settlementReversals)).toBe(
      '/api/admin/finance-tax/general-ledger/export?range=all&review=all&source=BOOKING_SETTLEMENT_REVERSAL',
    );
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
    const clearIntegrity = {
      blockerCodes: [],
      checkedAt: '2026-08-26T00:00:00.000Z',
      checks: {
        entriesBalanced: 'PASS' as const,
        formula: 'PASS' as const,
        headerBalanced: 'PASS' as const,
        headerMatchesEntries: 'PASS' as const,
        monthlyPeriod: 'PASS' as const,
        postedEntries: 'PASS' as const,
      },
      discrepancyAmount: 0,
      entryCount: 2,
      entryCredit: 100000,
      entryDebit: 100000,
      formulaDelta: 0,
      state: 'CLEAR' as const,
    };

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [
          {
            id: 'journal-1',
            integrity: clearIntegrity,
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
        reversalEvidence: {
          bankMatchState: 'PASS',
          blockerCodes: [],
          clearingState: 'PASS',
          journalState: 'PASS',
          ledgerState: 'NOT_APPLICABLE',
          matchedAmount: 100000,
          policy: { externalClearingRequired: true, ledgerType: 'EXTERNAL_CLEARING' },
          state: 'PASS',
          unmatchedAmount: 0,
        },
      }),
    ).toEqual({
      detail: 'Journal POSTED · Integrity CLEAR · Ledger NOT_APPLICABLE · Clearing PASS · Bank PASS',
      label: 'Evidence complete',
      tone: 'success',
    });

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [
          {
            id: 'journal-1',
            integrity: clearIntegrity,
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
        reversalEvidence: {
          bankMatchState: 'FAIL',
          blockerCodes: ['REVERSAL_STATUS_MISMATCH', 'BANK_MATCH_INCOMPLETE'],
          clearingState: 'FAIL',
          journalState: 'PASS',
          ledgerState: 'NOT_APPLICABLE',
          matchedAmount: 0,
          policy: { externalClearingRequired: true, ledgerType: 'EXTERNAL_CLEARING' },
          state: 'FAIL',
          unmatchedAmount: 100000,
        },
      }),
    ).toEqual({
      detail: 'Journal POSTED · Integrity CLEAR · Ledger NOT_APPLICABLE · Clearing FAIL · Bank FAIL',
      label: 'Clearing mismatch',
      tone: 'danger',
    });

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [],
        paymentClearingEntries: [],
      }),
    ).toEqual({
      detail:
        'Journal missing · Integrity UNAVAILABLE · Ledger UNAVAILABLE · Clearing missing · Bank UNAVAILABLE',
      label: 'Evidence missing',
      tone: 'danger',
    });

    expect(
      buildBookingSettlementReversalEvidenceState({
        accountingJournalBatches: [
          {
            id: 'seed-finance-smoke-reversal-journal-batch',
            integrity: {
              ...clearIntegrity,
              blockerCodes: ['HEADER_ENTRY_MISMATCH', 'FORMULA_DELTA'],
              discrepancyAmount: 110000,
              entryCredit: 390000,
              entryDebit: 390000,
              formulaDelta: 12000,
              state: 'BLOCKED',
            },
            postedAt: '2026-07-01',
            sourceKey: 'journal:reversal:seed',
            status: 'POSTED',
            totalCredit: 500000,
            totalDebit: 500000,
          },
        ],
        paymentClearingEntries: [],
        reversalEvidence: {
          bankMatchState: 'FAIL',
          blockerCodes: ['REVERSAL_CLEARING_MISSING'],
          clearingState: 'FAIL',
          journalState: 'FAIL',
          ledgerState: 'NOT_APPLICABLE',
          matchedAmount: 0,
          policy: { externalClearingRequired: true, ledgerType: 'EXTERNAL_CLEARING' },
          state: 'FAIL',
          unmatchedAmount: 500000,
        },
      }),
    ).toEqual({
      detail: 'Journal POSTED · Integrity BLOCKED · Ledger NOT_APPLICABLE · Clearing FAIL · Bank FAIL',
      label: 'Journal blocked',
      tone: 'danger',
    });

    for (const ledgerType of ['CASH_RECEIVABLE_JOURNAL', 'CUSTOMER_WALLET_REFUND'] as const) {
      expect(
        buildBookingSettlementReversalEvidenceState({
          accountingJournalBatches: [
            {
              id: `journal-${ledgerType}`,
              integrity: clearIntegrity,
              postedAt: '2026-07-01',
              sourceKey: `journal:${ledgerType}`,
              status: 'POSTED',
              totalCredit: 100000,
              totalDebit: 100000,
            },
          ],
          paymentClearingEntries: [],
          reversalEvidence: {
            bankMatchState: 'NOT_APPLICABLE',
            blockerCodes: [],
            clearingState: 'NOT_APPLICABLE',
            journalState: 'PASS',
            ledgerState: 'PASS',
            matchedAmount: 0,
            policy: { externalClearingRequired: false, ledgerType },
            state: 'PASS',
            unmatchedAmount: 0,
          },
        }),
      ).toEqual({
        detail:
          'Journal POSTED · Integrity CLEAR · Ledger PASS · Clearing NOT_APPLICABLE · Bank NOT_APPLICABLE',
        label: 'Evidence complete',
        tone: 'success',
      });
    }
  });

  it('builds finance detail trace links to the exact settlement and reversal records', () => {
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
        href: '/finance-tax/settlement-reversals/reversal-1',
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

    expect(
      links.map((link) => [link.label, link.href, link.amount, link.currency, link.amountSuffix]),
    ).toEqual([
      ['Withdrawal requested', '/payouts?range=7d&withdrawalStatus=REQUESTED', 700_000, 'VND', null],
      ['Review required', '/payouts?range=7d&withdrawalStatus=REVIEW_REQUIRED', 1_600_000, 'VND', 'locked'],
      [
        'Bank transfer pending',
        '/payouts?range=7d&withdrawalStatus=BANK_TRANSFER_PENDING',
        900_000,
        'VND',
        null,
      ],
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
        assignedCount: 0,
        count: 5,
        currency: 'VND',
        ignoredCount: 0,
        matchedAmount: 400_000,
        matchedCount: 2,
        openExposureAmount: 800_000,
        partiallyMatchedAmount: 0,
        partiallyMatchedCount: 0,
        reversedCount: 0,
        unassignedCount: 3,
        unassignedOver48hAmount: 500_000,
        unassignedOver48hCount: 2,
        unmatchedAmount: 800_000,
        unmatchedCount: 3,
      },
      clearingSummary: {
        amount: 1_200_000,
        assignedCount: 0,
        clearedCount: 4,
        count: 6,
        currency: 'VND',
        openAmount: 1_200_000,
        openCount: 2,
        over48hAmount: 0,
        over48hCount: 0,
        partiallyClearedAmount: 0,
        partiallyClearedCount: 0,
        reversedCount: 0,
        unassignedCount: 2,
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
        ...emptyBookingSettlementSummary(),
        count: 9,
        currency: 'VND',
        customerPaymentAmount: 2_000_000,
        partnerPayoutAmount: 1_300_000,
        partnerWithholdingTotal: 120_000,
        platformFeeGross: 420_000,
        platformFeeNetRevenue: 381_818,
        companyOutputVat: 38_182,
        paymentProcessingFee: 20_000,
        needsActionCount: 4,
        openTaxCount: 4,
        paidTaxCount: 1,
      },
    });

    expect(
      links.map((link) => [
        link.label,
        link.href,
        link.count,
        link.amount,
        link.currency,
        link.amountSuffix,
        link.signal,
      ]),
    ).toEqual([
      [
        'Today needs action',
        '/finance-tax/booking-settlement-audit?range=today&review=open',
        4,
        null,
        null,
        null,
        'Needs action',
      ],
      [
        'Payment clearing open',
        '/finance-tax/payment-clearing?range=today&review=open',
        2,
        1_200_000,
        'VND',
        null,
        'Unsettled',
      ],
      [
        'Bank unmatched',
        '/finance-tax/bank-reconciliation?range=today&review=unmatched',
        3,
        800_000,
        'VND',
        null,
        'Unmatched',
      ],
      [
        'Monthly close risk',
        '/finance-tax/monthly-tax-closing?period=2026-06',
        3,
        170_000,
        'VND',
        'cash debt',
        'Closeout risk',
      ],
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
        ...emptyBookingSettlementSummary(),
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
        evidenceBreakdown: [],
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
      journalReconciliationIssueCount: 0,
      monthlyClosingHistoryCount: 1,
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
      paymentFeeReviewFlagCount: 0,
      platformVatReviewFlagCount: 0,
      partnerDepositReconciliationOpenCount: 0,
      partnerDepositReconciliationOpenAmount: 0,
      payoutBankOutflowReconciliationOpenCount: 0,
      payoutBankOutflowReconciliationOpenAmount: 0,
      payoutReturnInflowReconciliationOpenCount: 0,
      payoutReturnInflowReconciliationOpenAmount: 0,
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
      paymentFeeReviewFlagCount: 4,
      platformVatReviewFlagCount: 3,
      partnerDepositReconciliationOpenCount: 2,
      partnerDepositReconciliationOpenAmount: 250_000,
      payoutBankOutflowReconciliationOpenCount: 3,
      payoutBankOutflowReconciliationOpenAmount: 360_000,
      payoutReturnInflowReconciliationOpenCount: 1,
      payoutReturnInflowReconciliationOpenAmount: 120_000,
      openTaxCount: 3,
      reconciliationDelta: 50_000,
      netRevenueDelta: 10_000,
    };

    const links = buildMonthlyTaxClosingRiskLinks(summary, settlementFilters, closingFilters);

    expect(
      links.map((link) => [
        link.label,
        link.href,
        link.count,
        link.amount,
        link.currency,
        link.amountSuffix,
        link.signal,
      ]),
    ).toEqual([
      [
        'Journal reconciliation',
        '/finance-tax/general-ledger?q=2026-06&range=all&review=unbalanced',
        0,
        null,
        null,
        null,
        'Journal blocker',
      ],
      [
        'Open tax rows',
        '/finance-tax/booking-settlement-audit?range=all&review=tax-open&period=2026-06&sort=oldest&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06',
        3,
        null,
        null,
        null,
        'Tax review',
      ],
      [
        'Coupon review flags',
        '/finance-tax/coupon-finance?range=30d&review=coupon-review&period=2026-06&sort=oldest&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06',
        2,
        null,
        null,
        null,
        'Coupon review',
      ],
      [
        'Payment fee evidence',
        '/finance-tax/booking-settlement-audit?range=all&review=payment-fee-evidence&period=2026-06&sort=oldest&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06',
        4,
        null,
        null,
        null,
        'Fee policy review',
      ],
      [
        'Platform VAT evidence',
        '/finance-tax/booking-settlement-audit?range=all&review=platform-vat-evidence&period=2026-06&sort=oldest&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06',
        3,
        null,
        null,
        null,
        'VAT evidence review',
      ],
      [
        'Partner deposit reconciliation',
        '/finance-tax/partner-bank-deposits?period=2026-06&review=needs-reconciliation&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06&sort=oldest',
        2,
        250_000,
        'VND',
        null,
        'Bank evidence',
      ],
      [
        'Payout bank outflow reconciliation',
        '/finance-tax/bank-reconciliation?range=all&review=unmatched&period=2026-06&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06&sort=oldest&workspace=operations&type=OUTFLOW&source=PAYOUT',
        3,
        360_000,
        'VND',
        null,
        'Payout evidence',
      ],
      [
        'Payout return inflow reconciliation',
        '/finance-tax/bank-reconciliation?range=all&review=unmatched&period=2026-06&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06&sort=oldest&workspace=operations&type=INFLOW&source=PAYOUT',
        1,
        120_000,
        'VND',
        null,
        'Return evidence',
      ],
      [
        'Cash debt gate',
        '/cash-settlements?period=2026-06&returnTo=%2Ffinance-tax%3Fperiod%3D2026-06',
        null,
        170_000,
        'VND',
        null,
        'Cash debt',
      ],
      [
        'Reconciliation deltas',
        '/finance-tax/monthly-tax-closing?period=2026-06',
        2,
        60_000,
        'VND',
        null,
        'Formula check',
      ],
    ]);
  });

  it('maps authoritative monthly close preflight blockers to existing operation queues', () => {
    const settlementFilters = readBookingSettlementFilters({ range: '30d' });
    const closingFilters = readMonthlyTaxClosingFilters({ period: '2026-06' });
    const summary = {
      ...emptyMonthlyTaxClosingSummary('2026-06'),
      partnerWithholdingTotal: 84_000,
      preflight: {
        blockers: [
          {
            code: 'REMITTANCE_EVIDENCE' as const,
            message: 'Retained remittance evidence is incomplete.',
          },
          {
            code: 'REMITTANCE_AMOUNT_MISMATCH' as const,
            message: 'The posted remittance journal amount is stale after reversals.',
          },
        ],
        nextStatus: 'CLOSED' as const,
        ready: false,
      },
      status: 'PAID' as const,
    };

    expect(resolveMonthlyTaxClosingPreflight(summary)).toEqual(summary.preflight);
    expect(
      buildMonthlyTaxClosingPreflightLinks(summary, settlementFilters, closingFilters).map((link) => [
        link.key,
        link.label,
        link.helper,
        link.href,
      ]),
    ).toEqual([
      [
        'remittance-evidence',
        'Remittance evidence',
        'Retained remittance evidence is incomplete.',
        '/finance-tax/monthly-tax-closing?period=2026-06',
      ],
      [
        'remittance-journal',
        'Withholding remittance journal',
        'The posted remittance journal amount is stale after reversals.',
        '/finance-tax/general-ledger?q=withholding-remittance%3A2026-06&range=all',
      ],
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

  it.each([
    ['future', { hasActivity: false, periodState: 'FUTURE_PERIOD' }, ['Future period', 'Monitoring not started', 'neutral']],
    ['past no activity', { hasActivity: false, periodState: 'NOT_STARTED' }, ['No activity', 'No close record', 'neutral']],
    ['active not started', { hasActivity: true, periodState: 'NOT_STARTED' }, ['Review totals', 'Needs review', 'warning']],
    ['reviewed', { hasActivity: true, periodState: 'REVIEWED', status: 'REVIEWED' }, ['Declare', 'Needs action', 'warning']],
    ['declared', { hasActivity: true, periodState: 'DECLARED', status: 'DECLARED' }, ['Record payment', 'Needs action', 'warning']],
    ['paid', { hasActivity: true, periodState: 'PAID', status: 'PAID' }, ['Close period', 'Needs action', 'warning']],
    ['closed', { hasActivity: true, periodState: 'CLOSED', status: 'CLOSED' }, ['Closed', 'Records', 'success']],
  ])('keeps %s monthly closeout command semantics distinct', (_label, overrides, expected) => {
    const state = buildMonthlyTaxCloseoutCommandState({
      ...emptyMonthlyTaxClosingSummary('2026-06'),
      ...overrides,
    } as never);

    expect([state.value, state.scope, state.tone]).toEqual(expected);
  });

  it('exports monthly tax closing summary and stored rows with visible totals', () => {
    const summaryCsv = decodeURIComponent(
      buildMonthlyTaxClosingSummaryCsvHref({
        id: null,
        journalReconciliationIssueCount: 0,
        monthlyClosingHistoryCount: 0,
        period: '2026-06',
        currency: 'VND',
        status: 'DRAFT',
        settlementCount: 2,
        reversalCount: 1,
        customerPaymentAmountTotal: 1200000,
        partnerPayoutTotal: 860000,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        partnerVatWithheldTotal: 60000,
        partnerPitWithheldTotal: 24000,
        partnerWithholdingTotal: 84000,
        paymentProcessingFeeTotal: 0,
        paymentFeeReviewFlagCount: 1,
        platformVatReviewFlagCount: 0,
        partnerDepositReconciliationOpenCount: 0,
        partnerDepositReconciliationOpenAmount: 0,
        payoutBankOutflowReconciliationOpenCount: 0,
        payoutBankOutflowReconciliationOpenAmount: 0,
        payoutReturnInflowReconciliationOpenCount: 0,
        payoutReturnInflowReconciliationOpenAmount: 0,
        couponSettlementCount: 1,
        couponReversalCount: 1,
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
    expect(summaryCsv).toContain('"settlement_count","reversal_count"');
    expect(summaryCsv).toContain('"coupon_settlement_count","coupon_reversal_count"');
    expect(summaryCsv).toContain('"partner_withholding_total"');
    expect(summaryCsv).toContain('"84000"');
    expect(summaryCsv).toContain('"partner_deposit_reconciliation_open_count"');
    expect(summaryCsv).toContain('"partner_deposit_reconciliation_open_amount"');
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
          postedSettlementCount: 4,
          reversalCount: 1,
          grossServiceRevenue: 1_800_000,
          partnerPayoutTotal: 1_290_000,
          partnerVatWithheldTotal: 90_000,
          partnerPitWithheldTotal: 36_000,
          totalPartnerTaxWithheld: 126_000,
          completeEvidenceCount: 3,
          explicitZeroEvidenceCount: 0,
          missingEvidenceCount: 0,
          withholdingEvidenceStatus: 'COMPLETE',
        },
      ]),
    );

    expect(rowsCsv).toContain('"provider_profile_id","period","currency"');
    expect(rowsCsv).toContain('"provider-1","2026-06","VND","Smoke Partner"');
    expect(rowsCsv).toContain('"\'+84900000001"');
    expect(rowsCsv).toContain('"posted_settlement_count","reversal_count"');
    expect(rowsCsv).toContain('"4","1"');
    expect(rowsCsv).toContain('"1800000"');
    expect(rowsCsv).toContain('"126000"');
    expect(rowsCsv).toContain('"COMPLETE"');
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
          paymentFeePolicyVersionId: null,
          paymentFeeRuleSnapshot: { reason: 'No active payment fee policy matched MOMO.' },
          settlementAuditHealth: {
            allocation: {
              companyCouponExpense: 0,
              customerPaymentAmount: 600_000,
              delta: 0,
              partnerPayoutAmount: 430_000,
              partnerWithholdingTotal: 42_000,
              platformFeeGross: 128_000,
            },
            blockers: [
              {
                code: 'PAYMENT_FEE_POLICY_MISSING',
                nextAction: 'Review fee policy.',
                ownerTeam: 'Finance operations',
                severity: 'BLOCKER',
              },
            ],
            checkedAt: '2026-06-13T03:05:00.000Z',
            checks: {
              allocation: 'PASS',
              bankMatch: 'FAIL',
              canonicalClearing: 'FAIL',
              canonicalJournal: 'PASS',
              couponPolicy: 'NOT_APPLICABLE',
              paymentFeePolicy: 'FAIL',
              reversal: 'NOT_APPLICABLE',
              taxPeriod: 'FAIL',
            },
            evidence: {
              canonicalClearing: {
                count: 1,
                ids: ['clearing-1'],
                matchedAmount: 0,
                required: true,
                state: 'FAIL',
                unmatchedAmount: 600_000,
              },
              canonicalJournal: { count: 1, ids: ['journal-1'], state: 'PASS' },
              reversal: {
                clearingCount: 0,
                count: 0,
                ids: [],
                journalCount: 0,
                lifecycle: 'NONE',
                reason: null,
                reversedAt: null,
                reversalPeriod: null,
                state: 'NOT_APPLICABLE',
              },
            },
            formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
            state: 'ACTION_REQUIRED',
          },
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

    expect(rowsCsv).toContain(
      '"generated_at","timezone","generated_by","active_filters","sort","total_rows"',
    );
    expect(rowsCsv).toContain('"snapshot_id","booking_id","payment_id","monthly_period"');
    expect(rowsCsv).toContain('"snapshot-1","booking-1","payment-1","2026-06"');
    expect(rowsCsv).toContain('"Demo Customer"');
    expect(rowsCsv).not.toContain('+84900000001');
    expect(rowsCsv).toContain('"Smoke Partner"');
    expect(rowsCsv).not.toContain('+84900000002');
    expect(rowsCsv).toContain('"600000"');
    expect(rowsCsv).toContain('"128000"');
    expect(rowsCsv).toContain('"CUSTOMER_PLUS_COMPANY_COUPON_V1"');
    expect(rowsCsv).toContain('"PAYMENT_FEE_POLICY_MISSING"');
    expect(rowsCsv).toContain('"118519"');
    expect(rowsCsv).toContain('"9481"');
    expect(rowsCsv).toContain('"payment_fee_policy_version_id","payment_fee_evidence_state"');
    expect(rowsCsv).toContain('"ACTION_REQUIRED","PAYMENT_FEE_POLICY_MISSING"');
  });

  it('exports a monthly accounting journal CSV from visible closing totals', () => {
    const journalCsv = decodeURIComponent(
      buildMonthlyTaxClosingAccountingJournalCsvHref({
        id: null,
        journalReconciliationIssueCount: 0,
        monthlyClosingHistoryCount: 0,
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
        paymentFeeReviewFlagCount: 1,
        platformVatReviewFlagCount: 0,
        partnerDepositReconciliationOpenCount: 0,
        partnerDepositReconciliationOpenAmount: 0,
        payoutBankOutflowReconciliationOpenCount: 0,
        payoutBankOutflowReconciliationOpenAmount: 0,
        payoutReturnInflowReconciliationOpenCount: 0,
        payoutReturnInflowReconciliationOpenAmount: 0,
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
        reversalCount: 1,
        manualReviewCount: 0,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        netRevenueDelta: 0,
        evidenceBreakdown: [],
        rateBreakdown: [],
      }).map((metric) => [metric.label, metric.value]),
    ).toEqual([
      ['Settlements', 2],
      ['Reversals', 1],
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
        reversalCount: 1,
        customerPaymentAmountTotal: 1200000,
        paymentProcessingFeeTotal: 10000,
        byPaymentMethod: [],
        byPayer: [],
        byTreatment: [],
        policyReadiness: {
          activePolicy: null,
          configuredMethods: [],
          missingMethods: ['MOMO', 'VNPAY', 'CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'],
          status: 'MISSING_ACTIVE_POLICY',
        },
        remediationPreview: {
          status: 'BLOCKED',
          policyVersionId: null,
          blockers: [],
          evidenceReviewCount: 0,
          evidenceCustomerPaymentAmountTotal: 0,
          recordedFeeTotal: 0,
          expectedFeeTotal: null,
          delta: null,
        },
      }).map((metric) => [metric.label, metric.value]),
    ).toEqual([
      ['Settlements', 2],
      ['Reversals', 1],
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
        reversalCount: 1,
        manualReviewCount: 0,
        platformFeeGrossTotal: 256000,
        platformFeeNetRevenueTotal: 237038,
        companyOutputVatTotal: 18962,
        netRevenueDelta: 0,
        evidenceBreakdown: [],
        rateBreakdown: [
          {
            category: 'REDUCED_8',
            platformVatRateBps: 800,
            settlementCount: 2,
            reversalCount: 1,
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
        reversalCount: 1,
        customerPaymentAmountTotal: 1200000,
        paymentProcessingFeeTotal: 10000,
        byPaymentMethod: [
          {
            paymentMethod: 'MOMO',
            settlementCount: 1,
            reversalCount: 1,
            evidenceReviewCount: 1,
            customerPaymentAmountTotal: 600000,
            evidenceCustomerPaymentAmountTotal: 600000,
            paymentProcessingFeeTotal: 10000,
            evidenceRecordedFeeTotal: 10000,
            remediationExpectedFeeTotal: null,
            remediationDelta: null,
          },
        ],
        byPayer: [
          {
            paymentFeePayer: 'HANDS',
            settlementCount: 2,
            reversalCount: 1,
            customerPaymentAmountTotal: 1200000,
            paymentProcessingFeeTotal: 10000,
          },
        ],
        byTreatment: [
          {
            paymentFeeTreatment: 'OPERATING_EXPENSE',
            settlementCount: 2,
            reversalCount: 1,
            customerPaymentAmountTotal: 1200000,
            paymentProcessingFeeTotal: 10000,
          },
        ],
        policyReadiness: {
          activePolicy: null,
          configuredMethods: [],
          missingMethods: ['MOMO', 'VNPAY', 'CASH', 'CARD', 'BANK_TRANSFER', 'CUSTOMER_WALLET', 'MANUAL'],
          status: 'MISSING_ACTIVE_POLICY',
        },
        remediationPreview: {
          status: 'BLOCKED',
          policyVersionId: null,
          blockers: [],
          evidenceReviewCount: 1,
          evidenceCustomerPaymentAmountTotal: 600000,
          recordedFeeTotal: 10000,
          expectedFeeTotal: null,
          delta: null,
        },
      }),
    );

    expect(platformVatCsv).toContain('"section","period","currency"');
    expect(platformVatCsv).toContain('"reversal_count"');
    expect(platformVatCsv).toContain('"summary","2026-06","VND"');
    expect(platformVatCsv).toContain('"rate_breakdown","2026-06","VND","REDUCED_8"');
    expect(platformVatCsv).toContain('"18962"');
    expect(paymentFeeCsv).toContain('"method_breakdown","2026-06","VND","MOMO"');
    expect(paymentFeeCsv).toContain('"reversal_count"');
    expect(paymentFeeCsv).toContain('"payer_breakdown","2026-06","VND","HANDS"');
    expect(paymentFeeCsv).toContain('"treatment_breakdown","2026-06","VND","OPERATING_EXPENSE"');
    expect(paymentFeeCsv).toContain('"10000"');
  });
});
