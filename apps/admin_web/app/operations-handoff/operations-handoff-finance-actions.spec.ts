import type {
  AdminCashSettlementSummary,
  AdminEarning,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import { buildFinanceHandoffActionMap } from './operations-handoff-finance-actions';

describe('operations handoff finance action model', () => {
  it('builds finance handoff rows from open payments, refunds, payouts, earnings, and cash debt', () => {
    const rows = buildFinanceHandoffActionMap({
      payments: [
        payment({ amount: 100000, status: 'AUTHORIZED' }),
        payment({ amount: 50000, method: 'CASH', status: 'PENDING' }),
        payment({ method: 'MOMO', providerRef: null, status: 'PENDING' }),
      ],
      refunds: [refund({ amount: 25000, status: 'PENDING' })],
      payouts: [
        payout({ status: 'PROCESSING', totalNetAmount: 80000, transferRef: null }),
        payout({ status: 'PAID', totalNetAmount: 90000, transferRef: null }),
      ],
      earnings: [
        earning({ status: 'PENDING', taxLogs: [] }),
        earning({ status: 'PAID', taxLogs: [taxLog()] }),
      ],
      cashSummary: cashSummary({ providerCount: 2, totalDebtAmount: 30000 }),
    });

    expect(rowById(rows, 'finance-payment-state')).toMatchObject({
      count: 2,
      countLabel: '2 rows',
      statusClass: 'pill pill-warn',
      title: 'Payment state review',
    });
    expect(rowById(rows, 'finance-refund-state')).toMatchObject({
      count: 1,
      statusClass: 'pill pill-danger',
      title: 'Refund state review',
    });
    expect(rowById(rows, 'finance-cash-debt')).toMatchObject({
      count: 2,
      countLabel: '2 Partners',
      nextAction:
        'Record deposit reference or approved offset before final acceptance, service start, or payout release resumes.',
      statusClass: 'pill pill-danger',
      title: 'Cash wallet debt review',
    });
    expect(rowById(rows, 'finance-reference-trace')).toMatchObject({
      count: 4,
      countLabel: '4 checks',
      statusClass: 'pill pill-warn',
    });
    expect(rowById(rows, 'finance-earning-release')).toMatchObject({
      count: 1,
      statusClass: 'pill pill-info',
    });
  });

  it('sorts danger rows ahead of warning, info, and clear rows', () => {
    const rows = buildFinanceHandoffActionMap({
      payments: [payment({ status: 'AUTHORIZED' })],
      refunds: [refund({ status: 'PENDING' })],
      payouts: [],
      earnings: [earning({ status: 'AVAILABLE', taxLogs: [taxLog()] })],
      cashSummary: cashSummary({ providerCount: 0 }),
    });

    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
      'finance-refund-state',
      'finance-payment-state',
      'finance-earning-release',
    ]);
  });

  it('adds factual owner workload rows with assignee and oldest queue metadata', () => {
    const rows = buildFinanceHandoffActionMap({
      payments: [],
      refunds: [],
      payouts: [],
      earnings: [],
      cashSummary: cashSummary({ providerCount: 0 }),
      reviewWorkloads: [
        {
          allHref: '/finance-tax/payment-clearing?range=all&review=open',
          assigneeLabel: 'Finance Operator',
          currency: 'VND',
          isMonetary: true,
          key: 'payment-clearing',
          label: 'Payment clearing',
          mine: { amount: 120000, count: 1, href: '/finance-tax/payment-clearing?owner=mine' },
          oldestOccurredAt: '2026-07-23T00:00:00.000Z',
          openAmount: 120000,
          openCount: 1,
          over48h: { amount: 0, count: 0, href: '/finance-tax/payment-clearing?age=48h' },
          primaryHref: '/finance-tax/payment-clearing?owner=mine',
          state: 'available',
          status: 'Assigned',
          tone: 'info',
          unassigned: { amount: 0, count: 0, href: '/finance-tax/payment-clearing?owner=unassigned' },
        },
      ],
    });

    expect(rowById(rows, 'finance-owner-payment-clearing')).toMatchObject({
      assignee: 'Finance Operator',
      count: 1,
      oldestOpenAt: '2026-07-23T00:00:00.000Z',
      owner: 'Finance operations',
      status: 'Assigned',
      title: 'Payment clearing ownership',
    });
  });
});

function rowById(rows: ReturnType<typeof buildFinanceHandoffActionMap>, id: string) {
  const row = rows.find((item) => item.id === id);
  expect(row).toBeDefined();
  return row;
}

function payment(input: Partial<AdminPayment>): AdminPayment {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: 'MOMO',
    providerRef: 'provider-ref-1',
    status: 'CAPTURED',
    ...input,
  };
}

function refund(input: Partial<AdminRefund>): AdminRefund {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    createdAt: '2026-06-14T00:00:00.000Z',
    id: 'refund-1',
    paymentId: 'payment-1',
    payment: { currency: 'VND', method: 'MOMO', status: 'CAPTURED' },
    status: 'COMPLETED',
    ...input,
  };
}

function payout(input: Partial<AdminPayoutBatch>): AdminPayoutBatch {
  return {
    createdAt: '2026-06-14T00:00:00.000Z',
    currency: 'VND',
    id: 'payout-1',
    providerProfileId: 'partner-1',
    status: 'PAID',
    totalNetAmount: 100000,
    transferRef: 'transfer-1',
    ...input,
  };
}

function earning(input: Partial<AdminEarning>): AdminEarning {
  return {
    bookingId: 'booking-1',
    currency: 'VND',
    grossAmount: 150000,
    id: 'earning-1',
    netAmount: 120000,
    platformFee: 20000,
    providerProfileId: 'partner-1',
    status: 'PAID',
    withholdingAmount: 10000,
    ...input,
  };
}

function cashSummary(input: Partial<AdminCashSettlementSummary>): AdminCashSettlementSummary {
  return {
    currency: 'VND',
    generatedAt: '2026-06-14T00:00:00.000Z',
    highDebtProviderCount: 0,
    missingPaymentEvidenceCount: 0,
    oldestOpenAgeMinutes: 0,
    oldestOpenAt: null,
    providerCount: 0,
    rowCount: 0,
    staleDebtRowCount: 0,
    topProviderGroups: [],
    totalDebtAmount: 0,
    totalCompanyCouponOffset: 0,
    totalPlatformFee: 0,
    totalTaxAmount: 0,
    cashPaymentRowCount: 0,
    ...input,
  };
}

function taxLog() {
  return {
    currency: 'VND',
    grossAmount: 150000,
    id: 'tax-1',
    taxableAmount: 130000,
    withholdingAmount: 10000,
  };
}
