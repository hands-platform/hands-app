import { marketplaceDisplayText } from './admin-copy';
import { bookingParticipantPartnerId } from './booking-participant-choice';

export type BookingPartnerDecisionInput = {
  selectedProvider?: { displayName?: string | null } | null;
  preferredProvider?: { displayName?: string | null } | null;
  participants?: Array<{
    status?: string | null;
    providerProfileId?: string | null;
    providerProfile?: { id?: string | null } | null;
  }> | null;
};

function partnerDisplayName(provider?: { displayName?: string | null } | null) {
  return provider?.displayName ? marketplaceDisplayText(provider.displayName) : 'Not selected';
}

export function bookingPartnerHint(booking: BookingPartnerDecisionInput) {
  if (booking.selectedProvider) {
    return `Final partner: ${partnerDisplayName(booking.selectedProvider)}.`;
  }
  if (booking.preferredProvider && (booking.participants?.length ?? 0) === 0) {
    return 'Preferred partner has first response window.';
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return 'Shortlist has partners ready for customer decision.';
  }
  return 'No partner response yet.';
}

export function bookingPartnerDecisionLabel(
  booking: BookingPartnerDecisionInput,
  preferredProviderId?: string | null,
) {
  const preferredParticipant = (booking.participants ?? []).find(
    (participant) => bookingParticipantPartnerId(participant) === preferredProviderId,
  );
  if (preferredParticipant) {
    return preferredParticipant.status ?? 'Waiting';
  }
  if ((booking.participants?.length ?? 0) > 0) {
    return `${booking.participants?.length ?? 0} marketplace ready`;
  }
  return 'Waiting';
}
