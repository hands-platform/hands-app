import { BookingStatus, PaymentStatus } from '@prisma/client';

const MINUTE_MS = 60_000;

export function openBookingRequestTiming(input: {
  durationMin: number;
  providerResponseWindowMinutes: number;
  openedAt?: Date;
}) {
  const openedAt = input.openedAt ?? new Date();

  return {
    scheduledStartAt: openedAt,
    scheduledEndAt: new Date(openedAt.getTime() + input.durationMin * MINUTE_MS),
    openedAt,
    expiresAt: new Date(openedAt.getTime() + input.providerResponseWindowMinutes * MINUTE_MS),
  };
}

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
