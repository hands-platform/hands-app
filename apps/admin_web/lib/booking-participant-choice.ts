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

export function bookingMarketplaceParticipants<T extends BookingParticipantChoiceInput>(
  participants: T[] | null | undefined,
  preferredProviderId?: string | null,
) {
  return (participants ?? []).filter((participant) => {
    const partnerId = bookingParticipantPartnerId(participant);
    return Boolean(partnerId && participant.status !== 'REJECTED' && partnerId !== preferredProviderId);
  });
}

export function bookingCustomerSelectableParticipants<T extends BookingParticipantChoiceInput>(
  participants: T[] | null | undefined,
  preferredProviderId?: string | null,
) {
  return (participants ?? []).filter((participant) =>
    isCustomerSelectableBookingParticipant(participant, preferredProviderId),
  );
}

export function bookingHasCustomerSelectablePartner<T extends BookingParticipantChoiceInput>(
  participants: T[] | null | undefined,
  preferredProviderId?: string | null,
  selectedProviderId?: string | null,
) {
  return (
    !selectedProviderId &&
    bookingCustomerSelectableParticipants(participants, preferredProviderId).length > 0
  );
}
