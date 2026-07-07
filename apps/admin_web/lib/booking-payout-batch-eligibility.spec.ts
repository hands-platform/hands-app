import { bookingPayoutBatchEligibility } from './booking-payout-batch-eligibility';

const baseInput = {
  bookingStatus: 'COMPLETED',
  paymentExists: true,
  paymentMethod: 'MOMO',
  paymentStatus: 'CAPTURED',
  customerPriceLabel: '450.000 VND',
  earningExists: true,
  earningStatus: 'CREATED',
  earningNetAmountLabel: '380.000 VND',
  payoutBatchShortId: null,
  hasTaxLog: true,
  hasPlatformFeeLog: true,
  hasWalletLedger: true,
  cashDebt: false,
  walletLedgerLabel: 'No wallet movement',
  closeoutOpenItemLabels: [],
  financeFlagTitles: [],
  closeoutHelper: 'All closeout evidence is ready.',
};

describe('bookingPayoutBatchEligibility', () => {
  it('marks completed captured bookings with clean ledgers as batch ready', () => {
    const result = bookingPayoutBatchEligibility(baseInput);

    expect(result).toMatchObject({
      status: 'Batch ready',
      tone: 'pill-success',
    });
    expect(result.rows.map((row) => row.label)).toEqual([
      'Completed service',
      'Payment settlement',
      'Earning ledger',
      'Tax, fee, and wallet logs',
      'Cash fee debt',
      'Closeout status',
    ]);
    expect(result.rows[5]).toMatchObject({
      status: 'Ready',
      className: 'ops-task-done',
    });
  });

  it('keeps already paid earnings visible as audit evidence', () => {
    const result = bookingPayoutBatchEligibility({
      ...baseInput,
      earningStatus: 'PAID',
    });

    expect(result).toMatchObject({
      status: 'Already paid',
      tone: 'pill-success',
    });
    expect(result.summary).toContain('already been paid or settled');
  });

  it('blocks payout batching when completion, payment, or earning evidence is missing', () => {
    const result = bookingPayoutBatchEligibility({
      ...baseInput,
      bookingStatus: 'MATCHED',
      paymentExists: false,
      paymentMethod: null,
      paymentStatus: null,
      earningExists: false,
      earningStatus: null,
      earningNetAmountLabel: '0 VND',
    });

    expect(result).toMatchObject({
      status: 'Blocked',
      tone: 'pill-danger',
    });
    expect(result.rows[0]).toMatchObject({
      status: 'Not ready',
      className: 'ops-task-blocked',
    });
    expect(result.rows[1]).toMatchObject({
      status: 'Missing',
      className: 'ops-task-blocked',
    });
    expect(result.rows[2]).toMatchObject({
      status: 'Missing',
      className: 'ops-task-blocked',
    });
  });

  it('blocks payout release when cash fee debt remains', () => {
    const result = bookingPayoutBatchEligibility({
      ...baseInput,
      paymentMethod: 'CASH',
      paymentStatus: 'AUTHORIZED',
      cashDebt: true,
      walletLedgerLabel: 'Wallet balance -120.000 VND',
    });

    expect(result).toMatchObject({
      status: 'Blocked',
      tone: 'pill-danger',
    });
    expect(result.rows[4]).toMatchObject({
      label: 'Cash fee debt',
      status: 'Blocked',
      href: '/cash-settlements',
      pillClass: 'pill-danger',
    });
    expect(result.rows[4].operatorRule).toContain('cannot participate in marketplace bookings');
  });

  it('keeps incomplete tax, fee, and wallet logs in review rather than batch ready', () => {
    const result = bookingPayoutBatchEligibility({
      ...baseInput,
      hasTaxLog: true,
      hasPlatformFeeLog: false,
      hasWalletLedger: false,
      closeoutOpenItemLabels: [],
      financeFlagTitles: ['Missing fee ledger'],
    });

    expect(result).toMatchObject({
      status: 'Review',
      tone: 'pill-warn',
    });
    expect(result.rows[3]).toMatchObject({
      status: '1/3',
      className: 'ops-task-warning',
    });
    expect(result.rows[5].detail).toBe('Missing fee ledger');
  });
});
