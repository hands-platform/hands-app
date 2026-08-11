import { PaymentStatus } from '@prisma/client';
import { paymentCaptureUpdateData, paymentRefundRequestCreateData } from './payment-admin-data';

describe('payment admin update data helpers', () => {
  it('builds capture update data', () => {
    expect(paymentCaptureUpdateData()).toEqual({ status: PaymentStatus.CAPTURED });
  });

  it('builds a durable requested refund before gateway and accounting finalization', () => {
    expect(
      paymentRefundRequestCreateData({
        amount: 300000,
        bookingId: 'booking-1',
        currency: 'VND',
        requestedAt: new Date('2026-07-14T00:00:00.000Z'),
        requestedByAdminId: 'admin-1',
        source: 'ADMIN_MANUAL',
      }),
    ).toEqual({
      amount: 300000,
      bookingId: 'booking-1',
      currency: 'VND',
      metadata: {
        requestedAt: '2026-07-14T00:00:00.000Z',
        requestedByAdminId: 'admin-1',
        source: 'ADMIN_MANUAL',
      },
      reason: 'Admin manual refund',
      status: 'REQUESTED',
    });
  });
});
