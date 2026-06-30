import { BookingStatus, PaymentStatus } from '@prisma/client';
import { paymentCaptureUpdateData, paymentRefundUpdateData } from './payment-admin-data';

describe('payment admin update data helpers', () => {
  it('builds capture update data', () => {
    expect(paymentCaptureUpdateData()).toEqual({ status: PaymentStatus.CAPTURED });
  });

  it('builds refund update data with booking closeout and completed refund transaction', () => {
    expect(paymentRefundUpdateData({ bookingId: 'booking-1', amount: 300000 })).toEqual({
      status: PaymentStatus.REFUNDED,
      booking: { update: { status: BookingStatus.REFUNDED } },
      refunds: {
        create: {
          bookingId: 'booking-1',
          amount: 300000,
          reason: 'Admin manual refund',
          status: 'COMPLETED',
        },
      },
    });
  });
});
