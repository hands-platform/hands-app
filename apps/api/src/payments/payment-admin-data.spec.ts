import { PaymentStatus } from '@prisma/client';
import { paymentCaptureUpdateData, paymentRefundRequestCreateData } from './payment-admin-data';

describe('payment admin update data helpers', () => {
  it('builds capture update data', () => {
    expect(paymentCaptureUpdateData()).toEqual({ status: PaymentStatus.CAPTURED });
  });

  it('builds a durable requested refund before gateway and accounting finalization', () => {
    expect(
      paymentRefundRequestCreateData({
        actorId: 'admin-1',
        amount: 300000,
        approvalAdminId: 'finance-admin-2',
        bookingId: 'booking-1',
        currency: 'VND',
        occurredAt: new Date('2026-07-14T00:00:00.000Z'),
      }),
    ).toEqual({
      amount: 300000,
      bookingId: 'booking-1',
      currency: 'VND',
      metadata: {
        actorId: 'admin-1',
        approvalAdminId: 'finance-admin-2',
        occurredAt: '2026-07-14T00:00:00.000Z',
      },
      reason: 'Admin manual refund',
      status: 'REQUESTED',
    });
  });
});
