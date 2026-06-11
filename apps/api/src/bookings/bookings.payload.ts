import { BookingStatus, Prisma, Role } from '@prisma/client';

export function normalizeBookingAddress(address: Prisma.InputJsonValue | undefined, addressText: string) {
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    return { ...(address as Record<string, unknown>), addressText } as Prisma.InputJsonValue;
  }
  if (typeof address === 'string' && address.trim()) {
    return { addressText: address.trim() } as Prisma.InputJsonValue;
  }
  return { addressText } as Prisma.InputJsonValue;
}

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function customerCancellationCloseData(now = new Date()) {
  return {
    status: BookingStatus.CANCELLED,
    expiresAt: now,
    closedAt: now,
    closedByRole: Role.CUSTOMER,
    closedReason: 'customer_cancelled',
    closedNote: 'Customer cancelled before partner commitment.',
  };
}

export function bookingCancellationResultWithReleasedPayment<TBooking, TPayment>(
  booking: TBooking,
  releasedPayment: TPayment | null | undefined,
) {
  return releasedPayment ? { ...booking, payment: releasedPayment } : booking;
}

export function bookingCancellationProviderUserIds(booking: {
  preferredProvider?: { userId?: string | null } | null;
  selectedProvider?: { userId?: string | null } | null;
  participants?: Array<{ providerProfile?: { userId?: string | null } | null }>;
}) {
  const userIds = new Set<string>();
  if (booking.preferredProvider?.userId) {
    userIds.add(booking.preferredProvider.userId);
  }
  if (booking.selectedProvider?.userId) {
    userIds.add(booking.selectedProvider.userId);
  }
  for (const participant of booking.participants ?? []) {
    if (participant.providerProfile?.userId) {
      userIds.add(participant.providerProfile.userId);
    }
  }
  return userIds;
}
