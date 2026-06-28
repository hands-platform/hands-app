import type {
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
  buildHandoffRows,
  buildReconciliation,
  buildShiftCloseActionMap,
  summarizeEarnings,
} from './finance-closeout';

describe('finance closeout helpers', () => {
  it('defaults closeout filters to today and builds bounded finance API hrefs', () => {
    const defaultFilters = buildFinanceCloseoutFilters({});
    const rangeFilters = buildFinanceCloseoutFilters({ range: '30d' });

    expect(defaultFilters).toMatchObject({ label: 'Today (Vietnam)', range: 'today' });
    expect(buildFinanceCloseoutFilters({ range: 'all' }).range).toBe('all');
    expect(buildFinanceCloseoutApiHrefs(rangeFilters)).toEqual({
      cashSettlementSummaryHref: '/admin/cash-settlement-summary?range=30d',
      earningsHref: '/admin/earnings?range=30d&take=50',
      earningsSummaryHref: '/admin/earnings/summary?range=30d',
      payoutBatchesHref: '/admin/payout-batches?range=30d&take=50',
      paymentsHref: '/admin/payments?range=30d&take=50',
      refundsHref: '/admin/refunds?range=30d&take=50',
    });
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
      payouts: [
        payoutFixture({ id: 'processing-missing-ref', status: 'PROCESSING', transferRef: null }),
      ],
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
      earnings: [
        earningFixture({ id: 'cash-debt', netAmount: -250000, status: 'PENDING', taxLogs: [] }),
      ],
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
    taxLogs: overrides.taxLogs ?? [{ grossAmount: 500000, id: 'tax', taxableAmount: 500000, withholdingAmount: 50000, currency: 'VND' }],
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
    totalDebtAmount: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    ...overrides,
  };
}
