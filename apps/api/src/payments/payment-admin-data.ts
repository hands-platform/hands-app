import { BookingStatus, PaymentStatus } from '@prisma/client';

export function paymentCaptureUpdateData() {
  return { status: PaymentStatus.CAPTURED };
}

type PaymentRefundUpdateInput = {
  actorId?: string;
  amount: number;
  approvalAdminId?: string;
  bookingId: string;
  currency?: string;
  occurredAt?: Date;
  reason?: string;
};

export function paymentRefundUpdateData(input: PaymentRefundUpdateInput) {
  const metadata = paymentRefundMetadata(input);

  return {
    status: PaymentStatus.REFUNDED,
    booking: { update: { status: BookingStatus.REFUNDED } },
    refunds: {
      create: {
        bookingId: input.bookingId,
        amount: input.amount,
        currency: input.currency ?? 'VND',
        ...(metadata ? { metadata } : {}),
        reason: input.reason ?? 'Admin manual refund',
        status: 'COMPLETED',
      },
    },
  };
}

function paymentRefundMetadata(input: PaymentRefundUpdateInput) {
  const metadata = {
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.approvalAdminId ? { approvalAdminId: input.approvalAdminId } : {}),
    ...(input.occurredAt ? { occurredAt: input.occurredAt.toISOString() } : {}),
  };

  return Object.keys(metadata).length > 0 ? metadata : null;
}
