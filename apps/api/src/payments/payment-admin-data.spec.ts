import { BookingStatus, PaymentStatus } from '@prisma/client';
import { paymentCaptureUpdateData, paymentRefundUpdateData } from './payment-admin-data';

describe('payment admin update data helpers', () => {
  it('builds capture update data', () => {
    expect(paymentCaptureUpdateData()).toEqual({ status: PaymentStatus.CAPTURED });
  });

  it('builds refund update data with booking closeout and completed refund transaction', () => {
    expect(
      paymentRefundUpdateData({
        actorId: 'admin-1',
        amount: 300000,
        approvalAdminId: 'finance-admin-2',
        bookingId: 'booking-1',
        currency: 'VND',
        occurredAt: new Date('2026-06-30T10:15:00.000Z'),
      }),
    ).toEqual({
      status: PaymentStatus.REFUNDED,
      booking: { update: { status: BookingStatus.REFUNDED } },
      refunds: {
        create: {
          bookingId: 'booking-1',
          amount: 300000,
          currency: 'VND',
          metadata: {
            actorId: 'admin-1',
            approvalAdminId: 'finance-admin-2',
            occurredAt: '2026-06-30T10:15:00.000Z',
          },
          reason: 'Admin manual refund',
          status: 'COMPLETED',
        },
      },
    });
  });
});
