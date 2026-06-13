import { Role } from '@prisma/client';
import { paymentUpdatedNotification } from './payments.notifications';

describe('payment notification payloads', () => {
  it('builds payment update notifications', () => {
    expect(paymentUpdatedNotification({ paymentId: 'payment-1', bookingId: 'booking-1' })).toEqual({
      targetRole: Role.CUSTOMER,
      type: 'payment.updated',
      title: 'Payment updated',
      body: 'Your booking payment status was updated.',
      data: { paymentId: 'payment-1', bookingId: 'booking-1' },
    });
  });
});
