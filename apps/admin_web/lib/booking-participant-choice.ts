export type BookingParticipantChoiceInput = {
  status?: string | null;
  providerProfileId?: string | null;
  providerProfile?: {
    id?: string | null;
  } | null;
};

export function bookingParticipantPartnerId(participant: BookingParticipantChoiceInput) {
  return participant.providerProfileId ?? participant.providerProfile?.id ?? null;
}

export function isCustomerSelectableBookingParticipant(
  participant: BookingParticipantChoiceInput,
  preferredProviderId?: string | null,
) {
  const partnerId = bookingParticipantPartnerId(participant);
  if (!partnerId) {
    return false;
  }

  if (participant.status === 'ACCEPTED' || participant.status === 'SELECTED') {
    return true;
  }

  if (participant.status !== 'JOINED') {
    return false;
  }

  return partnerId !== preferredProviderId;
}
