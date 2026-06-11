import {
  paymentCaptureAuditMetadata,
  paymentRefundAuditMetadata,
  paymentReleaseAuditMetadata,
} from './payment-admin-audit';

describe('payment admin audit helpers', () => {
  const payment = {
    amount: 300000,
    method: 'MOMO',
    bookingId: 'booking-1',
    status: 'RELEASED',
  };

  it('builds capture audit metadata', () => {
    expect(paymentCaptureAuditMetadata(payment)).toEqual({
      amount: 300000,
      method: 'MOMO',
      bookingId: 'booking-1',
    });
  });

  it('builds release audit metadata with the resulting status', () => {
    expect(paymentReleaseAuditMetadata(payment)).toEqual({
      amount: 300000,
      method: 'MOMO',
      bookingId: 'booking-1',
      status: 'RELEASED',
    });
  });

  it('builds refund audit metadata with earning cancellation evidence', () => {
    expect(
      paymentRefundAuditMetadata(payment, { skipped: false, earningId: 'earning-1' }),
    ).toEqual({
      amount: 300000,
      method: 'MOMO',
      earningCancellation: { skipped: false, earningId: 'earning-1' },
    });
  });
});
