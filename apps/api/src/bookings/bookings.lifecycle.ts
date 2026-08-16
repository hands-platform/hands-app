import { BookingStatus } from '@prisma/client';

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

export function bookingResponseTimeoutAt(input: {
  expiresAt?: Date | null;
  providerResponseWindowMinutes: number;
  now?: Date;
}) {
  if (input.expiresAt) {
    return input.expiresAt;
  }

  const now = input.now ?? new Date();
  return new Date(now.getTime() + input.providerResponseWindowMinutes * MINUTE_MS);
}

export function bookingServiceStartedUpdateData() {
  return {
    status: BookingStatus.IN_SERVICE,
    chatRoom: { upsert: { create: {}, update: {} } },
  };
}

export function bookingCompletedUpdateData(completedAt = new Date()) {
  return {
    status: BookingStatus.COMPLETED,
    closedAt: completedAt,
  };
}
