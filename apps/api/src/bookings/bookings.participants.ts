export function bookingParticipantCompoundKey(bookingId: string, providerProfileId: string) {
  return {
    bookingId_providerProfileId: { bookingId, providerProfileId },
  };
}

export function bookingParticipantResponseUnavailableMessage(
  preferredProviderId: string | null | undefined,
  providerProfileId: string,
) {
  return preferredProviderId === providerProfileId
    ? 'Preferred partner invitation is not available for this booking'
    : 'Partner must participate in this marketplace booking before responding';
}
