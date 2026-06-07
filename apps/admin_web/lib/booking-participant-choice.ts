export type BookingParticipantChoiceInput = {
  status?: string | null;
  providerProfileId?: string | null;
  providerProfile?: {
    id?: string | null;
  } | null;
};

export type BookingParticipantChoiceBookingInput<
  T extends BookingParticipantChoiceInput = BookingParticipantChoiceInput,
> = {
  preferredProviderId?: string | null;
  preferredProvider?: {
    id?: string | null;
  } | null;
  selectedProviderId?: string | null;
  selectedProvider?: {
    id?: string | null;
  } | null;
  participants?: T[] | null;
};

export function bookingParticipantPartnerId(participant: BookingParticipantChoiceInput) {
  return participant.providerProfileId ?? participant.providerProfile?.id ?? null;
}

export function bookingPreferredPartnerIdForChoice(booking: BookingParticipantChoiceBookingInput) {
  return booking.preferredProvider?.id ?? booking.preferredProviderId ?? null;
}

export function bookingSelectedPartnerIdForChoice(booking: BookingParticipantChoiceBookingInput) {
  return booking.selectedProvider?.id ?? booking.selectedProviderId ?? null;
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

export function bookingMarketplaceParticipantsForBooking<T extends BookingParticipantChoiceInput>(
  booking: BookingParticipantChoiceBookingInput<T>,
) {
  return bookingMarketplaceParticipants(booking.participants, bookingPreferredPartnerIdForChoice(booking));
}

function bookingParticipantChoicePriority(participant: BookingParticipantChoiceInput) {
  switch (participant.status) {
    case 'SELECTED':
      return 4;
    case 'ACCEPTED':
      return 3;
    case 'JOINED':
      return 2;
    default:
      return 0;
  }
}

export function bookingCustomerSelectableParticipants<T extends BookingParticipantChoiceInput>(
  participants: T[] | null | undefined,
  preferredProviderId?: string | null,
) {
  const byPartner = new Map<string, T>();
  for (const participant of participants ?? []) {
    if (!isCustomerSelectableBookingParticipant(participant, preferredProviderId)) {
      continue;
    }

    const partnerId = bookingParticipantPartnerId(participant);
    if (!partnerId) {
      continue;
    }

    const current = byPartner.get(partnerId);
    if (
      !current ||
      bookingParticipantChoicePriority(participant) > bookingParticipantChoicePriority(current)
    ) {
      byPartner.set(partnerId, participant);
    }
  }
  return [...byPartner.values()];
}

export function bookingCustomerSelectableParticipantsForBooking<T extends BookingParticipantChoiceInput>(
  booking: BookingParticipantChoiceBookingInput<T>,
) {
  return bookingCustomerSelectableParticipants(booking.participants, bookingPreferredPartnerIdForChoice(booking));
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

export function bookingHasCustomerSelectablePartnerForBooking<T extends BookingParticipantChoiceInput>(
  booking: BookingParticipantChoiceBookingInput<T>,
) {
  return bookingHasCustomerSelectablePartner(
    booking.participants,
    bookingPreferredPartnerIdForChoice(booking),
    bookingSelectedPartnerIdForChoice(booking),
  );
}
