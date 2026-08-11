import { PaymentStatus } from '@prisma/client';

export function paymentCaptureUpdateData() {
  return { status: PaymentStatus.CAPTURED };
}

type PaymentRefundUpdateInput = {
  amount: number;
  bookingId: string;
  currency?: string;
  reason?: string;
  requestedAt?: Date;
  requestedByAdminId?: string;
  source?: string;
};

export function paymentRefundRequestCreateData(input: PaymentRefundUpdateInput) {
  const metadata = paymentRefundMetadata(input);

  return {
    bookingId: input.bookingId,
    amount: input.amount,
    currency: input.currency ?? 'VND',
    ...(metadata ? { metadata } : {}),
    reason: input.reason ?? 'Admin manual refund',
    status: 'REQUESTED',
  };
}

function paymentRefundMetadata(input: PaymentRefundUpdateInput) {
  const metadata = {
    ...(input.requestedAt ? { requestedAt: input.requestedAt.toISOString() } : {}),
    ...(input.requestedByAdminId ? { requestedByAdminId: input.requestedByAdminId } : {}),
    ...(input.source ? { source: input.source } : {}),
  };

  return Object.keys(metadata).length > 0 ? metadata : null;
}
