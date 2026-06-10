import {
  BookingMatchSource,
  BookingStatus,
  ParticipantStatus,
} from '@prisma/client';

export type AdminBookingMatchingEvidenceParticipant = {
  readonly providerProfileId?: string | null;
  readonly status?: ParticipantStatus | null;
};

export type AdminBookingMatchingEvidenceInput = {
  readonly status: BookingStatus;
  readonly preferredProviderId?: string | null;
  readonly selectedProviderId?: string | null;
  readonly matchedAt?: Date | string | null;
  readonly matchSource?: BookingMatchSource | null;
  readonly chatRoom?: { readonly id?: string | null } | null;
  readonly participants?: readonly AdminBookingMatchingEvidenceParticipant[];
};

export type AdminBookingMatchingEvidence = {
  readonly stage:
    | 'OPEN_MARKETPLACE_ACTIVE'
    | 'MATCHED'
    | 'SERVICE_ACTIVE'
    | 'CLOSED'
    | 'CREATED';
  readonly finalSelection:
    | 'FIRST_PICK_ACCEPTED'
    | 'CUSTOMER_SELECTED_PARTNER'
    | 'CUSTOMER_SELECTION_AVAILABLE'
    | 'FIRST_PICK_PENDING'
    | 'WAITING_FOR_PARTNERS'
    | 'NOT_READY';
  readonly firstPickStatus: ParticipantStatus | null;
  readonly marketplaceParticipantCount: number;
  readonly selectableParticipantCount: number;
  readonly matchedAt: Date | string | null;
  readonly matchSource: BookingMatchSource | null;
  readonly chatReady: boolean;
};

export function withAdminBookingMatchingEvidenceList<T extends AdminBookingMatchingEvidenceInput>(
  bookings: readonly T[],
): Array<T & { readonly matchingEvidence: AdminBookingMatchingEvidence }> {
  return bookings.map((booking) => withAdminBookingMatchingEvidence(booking));
}

export function withAdminBookingMatchingEvidence<T extends AdminBookingMatchingEvidenceInput>(
  booking: T,
): T & { readonly matchingEvidence: AdminBookingMatchingEvidence } {
  return {
    ...booking,
    matchingEvidence: buildAdminBookingMatchingEvidence(booking),
  };
}

export function buildAdminBookingMatchingEvidence(
  booking: AdminBookingMatchingEvidenceInput,
): AdminBookingMatchingEvidence {
  const participants = booking.participants ?? [];
  const firstPickParticipant = booking.preferredProviderId
    ? participants.find((participant) => participant.providerProfileId === booking.preferredProviderId)
    : undefined;
  const marketplaceParticipants = participants.filter((participant) =>
    isAdminMarketplaceParticipant(participant, booking.preferredProviderId),
  );
  const selectableParticipantCount = participants.filter((participant) =>
    isAdminCustomerSelectableParticipant(participant, booking.preferredProviderId),
  ).length;

  return {
    stage: adminBookingMatchingStage(booking),
    finalSelection: adminBookingFinalSelectionState(booking, firstPickParticipant, selectableParticipantCount),
    firstPickStatus: firstPickParticipant?.status ?? null,
    marketplaceParticipantCount: marketplaceParticipants.length,
    selectableParticipantCount,
    matchedAt: booking.matchedAt ?? null,
    matchSource: booking.matchSource ?? null,
    chatReady: Boolean(booking.chatRoom),
  };
}

function adminBookingMatchingStage(booking: AdminBookingMatchingEvidenceInput): AdminBookingMatchingEvidence['stage'] {
  switch (booking.status) {
    case BookingStatus.CREATED:
      return 'CREATED';
    case BookingStatus.OPEN_MATCHING:
      return 'OPEN_MARKETPLACE_ACTIVE';
    case BookingStatus.MATCHED:
      return 'MATCHED';
    case BookingStatus.PROVIDER_ON_THE_WAY:
    case BookingStatus.ARRIVED:
    case BookingStatus.IN_SERVICE:
      return 'SERVICE_ACTIVE';
    case BookingStatus.COMPLETED:
    case BookingStatus.CANCELLED:
    case BookingStatus.EXPIRED:
    case BookingStatus.NO_SHOW:
    case BookingStatus.REFUNDED:
      return 'CLOSED';
    default:
      return assertUnhandledAdminBookingStatus(booking.status);
  }
}

function adminBookingFinalSelectionState(
  booking: AdminBookingMatchingEvidenceInput,
  firstPickParticipant: AdminBookingMatchingEvidenceParticipant | undefined,
  selectableParticipantCount: number,
): AdminBookingMatchingEvidence['finalSelection'] {
  if (booking.matchSource === BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST) return 'FIRST_PICK_ACCEPTED';
  if (booking.matchSource === BookingMatchSource.CUSTOMER_SELECTED_PARTNER) return 'CUSTOMER_SELECTED_PARTNER';
  if (booking.selectedProviderId) return 'CUSTOMER_SELECTED_PARTNER';
  if (booking.status !== BookingStatus.OPEN_MATCHING) return 'NOT_READY';
  if (selectableParticipantCount > 0) return 'CUSTOMER_SELECTION_AVAILABLE';
  if (booking.preferredProviderId && firstPickParticipant?.status !== ParticipantStatus.REJECTED) {
    return 'FIRST_PICK_PENDING';
  }
  return 'WAITING_FOR_PARTNERS';
}

function isAdminCustomerSelectableParticipant(
  participant: AdminBookingMatchingEvidenceParticipant,
  preferredProviderId?: string | null,
) {
  if (participant.status === ParticipantStatus.ACCEPTED) return true;
  if (participant.status === ParticipantStatus.JOINED) return participant.providerProfileId !== preferredProviderId;
  return false;
}

function isAdminMarketplaceParticipant(
  participant: AdminBookingMatchingEvidenceParticipant,
  preferredProviderId?: string | null,
) {
  return Boolean(
    participant.providerProfileId &&
      participant.status !== ParticipantStatus.REJECTED &&
      participant.providerProfileId !== preferredProviderId,
  );
}

function assertUnhandledAdminBookingStatus(status: never): never {
  throw new Error(`Unhandled Admin booking matching evidence status: ${status}`);
}
