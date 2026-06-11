import { ParticipantStatus } from '@prisma/client';

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
