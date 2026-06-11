import { BookingMatchSource, BookingStatus, ParticipantStatus, ProviderStatus } from '@prisma/client';

export function bookingParticipantCompoundKey(bookingId: string, providerProfileId: string) {
  return {
    bookingId_providerProfileId: { bookingId, providerProfileId },
  };
}

export function bookingSelectedParticipantUpdate(
  bookingId: string,
  providerProfileId: string,
  respondedAt = new Date(),
) {
  return {
    update: {
      where: bookingParticipantCompoundKey(bookingId, providerProfileId),
      data: { status: ParticipantStatus.SELECTED, respondedAt },
    },
  };
}

export function bookingParticipantJoinUpsert(input: {
  bookingId: string;
  providerProfileId: string;
  providerStatusAtJoin: ProviderStatus;
  distanceMeters: number | null;
  respondedAt?: Date;
}) {
  return {
    where: bookingParticipantCompoundKey(input.bookingId, input.providerProfileId),
    update: {
      status: ParticipantStatus.JOINED,
      respondedAt: input.respondedAt ?? new Date(),
      distanceMeters: input.distanceMeters,
    },
    create: {
      bookingId: input.bookingId,
      providerProfileId: input.providerProfileId,
      status: ParticipantStatus.JOINED,
      distanceMeters: input.distanceMeters,
      providerStatusAtJoin: input.providerStatusAtJoin,
    },
    include: { providerProfile: true },
  };
}

export function preferredProviderInitialParticipantCreate(input: {
  providerProfileId: string;
  providerStatusAtJoin: ProviderStatus;
  distanceMeters: number | null;
}) {
  return {
    create: {
      providerProfileId: input.providerProfileId,
      status: ParticipantStatus.JOINED,
      distanceMeters: input.distanceMeters,
      providerStatusAtJoin: input.providerStatusAtJoin,
    },
  };
}

export function bookingMatchedUpdateData(input: {
  bookingId: string;
  providerProfileId: string;
  matchSource: BookingMatchSource;
  matchedAt?: Date;
  respondedAt?: Date;
}) {
  return {
    status: BookingStatus.MATCHED,
    selectedProviderId: input.providerProfileId,
    matchedAt: input.matchedAt ?? new Date(),
    matchSource: input.matchSource,
    participants: bookingSelectedParticipantUpdate(
      input.bookingId,
      input.providerProfileId,
      input.respondedAt,
    ),
    chatRoom: { upsert: { create: {}, update: {} } },
  };
}

export function bookingFirstPickRejectedUpdateData(input: {
  bookingId: string;
  providerProfileId: string;
  respondedAt?: Date;
}) {
  return {
    status: BookingStatus.OPEN_MATCHING,
    selectedProviderId: null,
    participants: {
      update: {
        where: bookingParticipantCompoundKey(input.bookingId, input.providerProfileId),
        data: {
          status: ParticipantStatus.REJECTED,
          respondedAt: input.respondedAt ?? new Date(),
        },
      },
    },
  };
}

export function bookingParticipantResponseRoute(
  preferredProviderId: string | null | undefined,
  providerProfileId: string,
  status: ParticipantStatus,
) {
  if (preferredProviderId !== providerProfileId) {
    return 'marketplace';
  }
  if (status === ParticipantStatus.ACCEPTED) {
    return 'first-pick-accepted';
  }
  if (status === ParticipantStatus.REJECTED) {
    return 'first-pick-rejected';
  }
  return 'marketplace';
}

export function bookingParticipantResponseUnavailableMessage(
  preferredProviderId: string | null | undefined,
  providerProfileId: string,
) {
  return preferredProviderId === providerProfileId
    ? 'Preferred partner invitation is not available for this booking'
    : 'Partner must participate in this marketplace booking before responding';
}
