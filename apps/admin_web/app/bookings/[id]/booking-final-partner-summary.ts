import type { AdminBookingDetail } from '../../../lib/admin-api';
import { providerName, shortId } from './booking-formatters';
import {
  bookingParticipantProviderId,
  bookingSelectedProviderId,
} from './booking-participant-rules';

export type BookingFinalPartnerSummary = {
  id: string | null;
  label: string;
  href: string;
  selected: boolean;
};

export function bookingFinalPartnerSummary(booking: AdminBookingDetail): BookingFinalPartnerSummary {
  const selectedPartnerId = bookingSelectedProviderId(booking);
  const selectedParticipant = selectedPartnerId
    ? (booking.participants ?? []).find(
        (participant) => bookingParticipantProviderId(participant) === selectedPartnerId,
      )
    : null;
  const firstPickAcceptedPartner =
    booking.matchingEvidence?.finalSelection === 'FIRST_PICK_ACCEPTED'
      ? booking.preferredProvider
      : null;
  const selectedProfile = booking.selectedProvider?.displayName
    ? booking.selectedProvider
    : selectedParticipant?.providerProfile ?? booking.selectedProvider ?? firstPickAcceptedPartner ?? null;
  const id = selectedPartnerId ?? selectedProfile?.id ?? null;
  const label = selectedProfile
    ? providerName(selectedProfile)
    : id
      ? `Partner ${shortId(id)}`
      : 'Not selected';

  return {
    id,
    label,
    href: id ? `/partners/${id}` : '#participants',
    selected: Boolean(id || selectedProfile),
  };
}
