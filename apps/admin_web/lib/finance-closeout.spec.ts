import type {
  AdminBookingSettlementGapList,
  AdminCashSettlementSummary,
  AdminEarning,
  AdminEarningSummary,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from './admin-api';
import {
  buildCloseoutTasks,
  buildFinanceCloseoutApiHrefs,
  buildFinanceCloseoutEvidenceChecklist,
  buildFinanceCloseoutFilters,
  buildFinanceCloseoutPageHref,
  buildFinanceCloseoutSettlementBatchReviewHref,
  buildFinanceCloseoutSettlementRepairHref,
  buildFinanceCloseoutSettlementDryRunHref,
  buildFinanceCloseoutSettlementPagination,
  buildFinanceCloseoutSettlementPeriodOptions,
  buildHandoffRows,
  buildReconciliation,
  buildShiftCloseActionMap,
  summarizeEarnings,
} from './finance-closeout';

describe('finance closeout helpers', () => {
  it('defaults closeout filters to today and builds bounded finance API hrefs', () => {
    const defaultFilters = buildFinanceCloseoutFilters({});
    const rangeFilters = buildFinanceCloseoutFilters({ range: '30d' });

    expect(defaultFilters).toMatchObject({
      label: 'Today (Vietnam)',
      range: 'today',
      settlementAge: 'backlog',
      settlementPage: 1,
      settlementPageSize: 10,
      settlementPaymentMethod: 'all',
      settlementPeriod: 'all',
      settlementQuery: '',
      settlementTrack: 'canonical',
      settlementTrackLabel: 'Canonical',
    });
    expect(buildFinanceCloseoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildFinanceCloseoutApiHrefs(rangeFilters)).toEqual({
      bookingSettlementGapDryRunHref: '/admin/booking-settlement-gaps/dry-run?take=100',
      bookingSettlementGapSummaryHref: '/admin/booking-settlement-gaps/summary',
      bookingSettlementGapsHref: '/admin/booking-settlement-gaps?age=backlog&skip=0&take=10&track=canonical',
      cashSettlementSummaryHref: '/admin/cash-settlement-summary?range=30d',
      earningsHref: '/admin/earnings?range=30d&take=10&review=closeout-review',
      earningsSummaryHref: '/admin/earnings/summary?range=30d',
      paymentSummaryHref: '/admin/payments/summary?range=30d',
      paymentsHref: '/admin/payments?range=30d&take=10&review=needs-action',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=10&review=needs-review',
      refundSummaryHref: '/admin/refunds/summary?range=30d',
      refundsHref: '/admin/refunds?range=30d&take=10&review=open',
    });
  });

  it('preserves closeout state in settlement backlog links and builds server pagination', () => {
    const filters = buildFinanceCloseoutFilters({
      q: 'booking 1',
      range: '7d',
      settlementAge: '7d-plus',
      settlementPage: '3',
      settlementPaymentMethod: 'MOMO',
      settlementPeriod: '2026-07',
      settlementTrack: 'historical-ready',
    });
    const hrefs = buildFinanceCloseoutApiHrefs(filters);
    const list: AdminBookingSettlementGapList = {
      generatedAt: '2026-07-13T00:00:00.000Z',
      hasNext: true,
      items: [{ id: 'gap-21' } as never, { id: 'gap-22' } as never],
      skip: 20,
      take: 10,
      total: 32,
    };

    expect(hrefs.bookingSettlementGapsHref).toBe(
      '/admin/booking-settlement-gaps?age=7d-plus&skip=20&take=10&track=historical-ready&q=booking+1&period=2026-07&paymentMethod=MOMO',
    );
    expect(buildFinanceCloseoutPageHref(filters, { settlementPage: 2 })).toBe(
      '/finance-closeout?range=7d&settlementAge=7d-plus&settlementPage=2&settlementPaymentMethod=MOMO&settlementPeriod=2026-07&settlementTrack=historical-ready&q=booking+1',
    );
    expect(buildFinanceCloseoutSettlementRepairHref(filters, 'gap-21')).toBe(
      '/finance-closeout?range=7d&settlementAge=7d-plus&settlementPage=3&settlementPaymentMethod=MOMO&settlementPeriod=2026-07&settlementTrack=historical-ready&q=booking+1&repairBookingId=gap-21',
    );
    expect(hrefs.bookingSettlementGapDryRunHref).toBe(
      '/admin/booking-settlement-gaps/dry-run?take=100&period=2026-07&paymentMethod=MOMO',
    );
    expect(buildFinanceCloseoutSettlementDryRunHref(filters)).toBe(
      '/finance-closeout?range=7d&settlementAge=7d-plus&settlementPage=3&settlementPaymentMethod=MOMO&settlementPeriod=2026-07&settlementTrack=historical-ready&q=booking+1&settlementDryRun=1',
    );
    expect(buildFinanceCloseoutSettlementBatchReviewHref(filters, ['gap-21', 'gap-22', 'gap-21'])).toBe(
      '/finance-closeout?range=7d&settlementAge=7d-plus&settlementPage=3&settlementPaymentMethod=MOMO&settlementPeriod=2026-07&settlementTrack=historical-ready&q=booking+1&settlementDryRun=1&reviewBookingId=gap-21&reviewBookingId=gap-22',
    );
    expect(buildFinanceCloseoutSettlementPagination(list)).toEqual({
      from: 21,
      page: 3,
      pageSize: 10,
      to: 22,
      totalPages: 4,
      totalRows: 32,
    });
  });

  it('builds bounded Vietnam settlement month options', () => {
    expect(
      buildFinanceCloseoutSettlementPeriodOptions(new Date('2026-07-13T00:00:00.000Z')).slice(0, 3),
    ).toEqual([
      { label: 'All settlement months', value: 'all' },
      { label: 'July 2026', value: '2026-07' },
      { label: 'June 2026', value: '2026-06' },
    ]);
    expect(buildFinanceCloseoutSettlementPeriodOptions(new Date('2026-07-13T00:00:00.000Z'))).toHaveLength(
      13,
    );
  });

  it('builds reconciliation counts and all-date cash debt from settlement summary', () => {
    const reconciliation = buildReconciliation({
      cashSummary: cashSummaryFixture({ totalDebtAmount: 450000 }),
      currency: 'VND',
      earnings: [
        earningFixture({ id: 'earning-without-tax', netAmount: -200000, status: 'PENDING', taxLogs: [] }),
      ],
      earningsSummary: earningSummaryFixture({ netAmount: -300000 }),
      payments: [
        paymentFixture({ id: 'authorized', status: 'AUTHORIZED' }),
        paymentFixture({ id: 'cash', method: 'CASH', status: 'PENDING' }),
        paymentFixture({ id: 'missing-ref', providerRef: null, status: 'PENDING' }),
      ],
      payouts: [payoutFixture({ id: 'processing-missing-ref', status: 'PROCESSING', transferRef: null })],
      range: 'all',
      refunds: [refundFixture({ id: 'requested', status: 'REQUESTED' })],
    });

    expect(reconciliation.openPaymentCount).toBe(2);
    expect(reconciliation.openRefundCount).toBe(1);
    expect(reconciliation.openPayoutCount).toBe(1);
    expect(reconciliation.cashDebtAmount).toBe(450000);
    expect(reconciliation.missingReferenceCount).toBe(2);
    expect(reconciliation.earningsWithoutTaxLogs).toHaveLength(1);
  });

  it('builds finance closeout task, evidence, action, and handoff rows from reconciliation', () => {
    const reconciliation = buildReconciliation({
      cashSummary: null,
      currency: 'VND',
      earnings: [earningFixture({ id: 'cash-debt', netAmount: -250000, status: 'PENDING', taxLogs: [] })],
      earningsSummary: earningSummaryFixture({ netAmount: -250000 }),
      payments: [paymentFixture({ id: 'authorized', status: 'AUTHORIZED' })],
      payouts: [payoutFixture({ id: 'open-payout', status: 'PROCESSING', totalNetAmount: 800000 })],
      range: '30d',
      refunds: [refundFixture({ id: 'requested', amount: 120000, status: 'REQUESTED' })],
    });

    expect(buildCloseoutTasks(reconciliation).map((task) => task.title)).toEqual([
      'Payment hold review',
      'Cash collection review',
      'Refund queue',
      'Missing references',
      'Payout release review',
      'Tax log coverage',
    ]);
    expect(buildFinanceCloseoutEvidenceChecklist(reconciliation).map((item) => item.title)).toEqual([
      'Payment state',
      'Refund queue',
      'Cash debt',
      'Batch payout release',
    ]);
    expect(buildShiftCloseActionMap(reconciliation).at(-1)).toMatchObject({
      action: 'Handoff note',
      status: 'Needs note',
    });
    expect(buildHandoffRows(reconciliation)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amount: '250.000 VND', label: 'Cash wallet debt' }),
        expect.objectContaining({ amount: '800.000 VND', label: 'Payout batches' }),
      ]),
    );
  });

  it('summarizes earnings by status buckets', () => {
    expect(
      summarizeEarnings(
        [
          earningFixture({ grossAmount: 500000, netAmount: 300000, status: 'PENDING' }),
          earningFixture({ grossAmount: 700000, netAmount: 450000, status: 'AVAILABLE' }),
          earningFixture({ grossAmount: 900000, netAmount: 650000, status: 'PAID' }),
        ],
        'VND',
      ),
    ).toMatchObject({
      availableNetAmount: 450000,
      count: 3,
      grossAmount: 2100000,
      paidNetAmount: 650000,
      pendingNetAmount: 300000,
    });
  });
});

function paymentFixture(overrides: Partial<AdminPayment>): AdminPayment {
  return {
    amount: 500000,
    bookingId: `${overrides.id ?? 'payment'}-booking`,
    currency: 'VND',
    id: overrides.id ?? 'payment',
    method: 'CARD',
    providerRef: 'gateway-ref',
    status: 'PAID',
    ...overrides,
  };
}

function refundFixture(overrides: Partial<AdminRefund>): AdminRefund {
  return {
    amount: 100000,
    bookingId: `${overrides.id ?? 'refund'}-booking`,
    createdAt: '2026-06-09T10:00:00.000Z',
    id: overrides.id ?? 'refund',
    paymentId: `${overrides.id ?? 'refund'}-payment`,
    status: 'COMPLETED',
    ...overrides,
  };
}

function earningFixture(overrides: Partial<AdminEarning>): AdminEarning {
  return {
    bookingId: `${overrides.id ?? 'earning'}-booking`,
    createdAt: '2026-06-09T10:00:00.000Z',
    currency: 'VND',
    grossAmount: overrides.grossAmount ?? 500000,
    id: overrides.id ?? 'earning',
    netAmount: overrides.netAmount ?? 300000,
    platformFee: 150000,
    providerProfileId: `${overrides.id ?? 'earning'}-partner`,
    status: overrides.status ?? 'PENDING',
    taxLogs: overrides.taxLogs ?? [
      { grossAmount: 500000, id: 'tax', taxableAmount: 500000, withholdingAmount: 50000, currency: 'VND' },
    ],
    withholdingAmount: 50000,
    ...overrides,
  };
}

function payoutFixture(overrides: Partial<AdminPayoutBatch>): AdminPayoutBatch {
  return {
    createdAt: '2026-06-09T10:00:00.000Z',
    currency: 'VND',
    id: overrides.id ?? 'payout',
    providerProfileId: `${overrides.id ?? 'payout'}-partner`,
    status: 'PAID',
    totalNetAmount: overrides.totalNetAmount ?? 600000,
    transferRef: 'bank-ref',
    ...overrides,
  };
}

function earningSummaryFixture(overrides: Partial<AdminEarningSummary>): AdminEarningSummary {
  return {
    availableNetAmount: 0,
    count: 0,
    currency: 'VND',
    grossAmount: 0,
    netAmount: 0,
    paidNetAmount: 0,
    pendingNetAmount: 0,
    platformFee: 0,
    withholdingAmount: 0,
    ...overrides,
  };
}

function cashSummaryFixture(overrides: Partial<AdminCashSettlementSummary>): AdminCashSettlementSummary {
  return {
    cashPaymentRowCount: 0,
    currency: 'VND',
    generatedAt: '2026-06-09T10:00:00.000Z',
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    oldestOpenAgeMinutes: 0,
    providerCount: 1,
    rowCount: 1,
    staleDebtRowCount: 0,
    topProviderGroups: [],
    totalCompanyCouponOffset: 0,
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    ...overrides,
  };
}
