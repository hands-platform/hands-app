import { paymentRefundEarningCancellationAudit } from './payment-refund-audit';

describe('payment refund audit helpers', () => {
  it('records skipped earning cancellation reasons', () => {
    expect(
      paymentRefundEarningCancellationAudit({ skipped: true, reason: 'ALREADY_PAID' }),
    ).toEqual({
      skipped: true,
      reason: 'ALREADY_PAID',
    });
  });

  it('records cancelled earning ids with a stable fallback', () => {
    expect(
      paymentRefundEarningCancellationAudit({
        skipped: false,
        earning: { id: 'earning-1' },
      }),
    ).toEqual({ skipped: false, earningId: 'earning-1' });

    expect(
      paymentRefundEarningCancellationAudit({
        skipped: false,
        earning: null,
      }),
    ).toEqual({ skipped: false, earningId: 'unknown' });
  });

  it('records refund-after-payout receivable evidence', () => {
    expect(
      paymentRefundEarningCancellationAudit({
        skipped: false,
        reason: 'PAID_REFUND_RECEIVABLE_CREATED',
        earning: { id: 'earning-paid-1' },
        receivableAmount: 430000,
      }),
    ).toEqual({
      skipped: false,
      earningId: 'earning-paid-1',
      reason: 'PAID_REFUND_RECEIVABLE_CREATED',
      receivableAmount: 430000,
    });
  });
});
