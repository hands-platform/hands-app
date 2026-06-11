import { BookingStatus, ParticipantStatus, Prisma } from '@prisma/client';

export function openBookingWhereForProvider(
  providerProfileId?: string,
  now = new Date(),
): Prisma.BookingWhereInput {
  const baseWhere: Prisma.BookingWhereInput = {
    status: BookingStatus.OPEN_MATCHING,
    expiresAt: { gt: now },
  };

  if (!providerProfileId) {
    return baseWhere;
  }

  const providerHasNotRejected = {
    participants: {
      none: {
        providerProfileId,
        status: ParticipantStatus.REJECTED,
      },
    },
  };

  return {
    ...baseWhere,
    OR: [
      {
        preferredProviderId: providerProfileId,
        ...providerHasNotRejected,
      },
      providerHasNotRejected,
    ],
  };
}

export function providerBookingHistoryWhere(providerProfileId: string): Prisma.BookingWhereInput {
  return {
    OR: [
      { preferredProviderId: providerProfileId },
      { selectedProviderId: providerProfileId },
      { participants: { some: { providerProfileId } } },
    ],
  };
}
