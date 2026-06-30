import { BookingStatus, PaymentStatus } from '@prisma/client';

export function paymentCaptureUpdateData() {
  return { status: PaymentStatus.CAPTURED };
}

export function paymentRefundUpdateData(input: { bookingId: string; amount: number }) {
  return {
    status: PaymentStatus.REFUNDED,
    booking: { update: { status: BookingStatus.REFUNDED } },
    refunds: {
      create: {
        bookingId: input.bookingId,
        amount: input.amount,
        reason: 'Admin manual refund',
        status: 'COMPLETED',
      },
    },
  };
}
