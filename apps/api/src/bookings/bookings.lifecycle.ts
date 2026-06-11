import { BookingStatus, PaymentStatus } from '@prisma/client';

export function bookingServiceStartedUpdateData() {
  return {
    status: BookingStatus.IN_SERVICE,
    chatRoom: { upsert: { create: {}, update: {} } },
  };
}

export function bookingCompletedUpdateData() {
  return {
    status: BookingStatus.COMPLETED,
    payment: { update: { status: PaymentStatus.CAPTURED } },
  };
}
