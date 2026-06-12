import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingParticipantPartnerId,
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
} from '../../lib/booking-participant-choice';
import { isPreferredAwaitingDecision as preferredAwaitingDecisionFromFacts } from '../../lib/booking-status-location-helpers';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

export function bookingIsSelectedProviderParticipant(booking: AdminBooking): boolean {
  const selectedProviderId = bookingSelectedPartnerIdForChoice(booking);
  if (!selectedProviderId) {
    return false;
  }

  return (booking.participants ?? []).some(
    (participant) =>
      bookingParticipantPartnerId(participant) === selectedProviderId && participant.status !== 'REJECTED',
  );
}

export function bookingIsBackupSelected(booking: AdminBooking): boolean {
  const selectedProviderId = bookingSelectedPartnerIdForChoice(booking);
  const preferredProviderId = bookingPreferredPartnerIdForChoice(booking);
  return Boolean(selectedProviderId && preferredProviderId && selectedProviderId !== preferredProviderId);
}

export function bookingPreferredParticipantState(booking: AdminBooking): BookingParticipant | null {
  const preferredProviderId = bookingPreferredPartnerIdForChoice(booking);
  if (!preferredProviderId) {
    return null;
  }

  return (
    (booking.participants ?? []).find(
      (participant) => bookingParticipantPartnerId(participant) === preferredProviderId,
    ) ?? null
  );
}

export function bookingPreferredAwaitingDecision(booking: AdminBooking): boolean {
  const participant = bookingPreferredParticipantState(booking);
  return preferredAwaitingDecisionFromFacts({
    finalSelection: booking.matchingEvidence?.finalSelection,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredParticipantStatus: participant?.status,
  });
}

export function bookingPreferredProviderStateLabel(booking: AdminBooking): string {
  if (bookingIsBackupSelected(booking)) {
    return 'not final';
  }

  if (booking.matchingEvidence?.firstPickStatus) {
    return bookingPreferredPartnerDecisionLabel(booking.matchingEvidence.firstPickStatus);
  }

  const participant = bookingPreferredParticipantState(booking);
  if (!participant) {
    return 'requested';
  }
  return bookingPreferredPartnerDecisionLabel(participant.status);
}

export function bookingPreferredPartnerDecisionLabel(status: string): string {
  if (status === 'REJECTED') {
    return 'declined';
  }
  if (status === 'ACCEPTED' || status === 'SELECTED') {
    return 'confirmed';
  }
  return 'pending';
}
