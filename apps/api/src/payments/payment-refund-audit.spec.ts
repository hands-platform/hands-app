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
});
