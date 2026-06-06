import type { AdminBookingDetail } from '../../../lib/admin-api';

export type BookingDetailParticipant = NonNullable<AdminBookingDetail['participants']>[number];

export function isCustomerSelectableParticipantForFinalChoice(
  participant: BookingDetailParticipant,
  preferredProviderId?: string | null,
) {
  const partnerId = participant.providerProfile?.id;
  if (!partnerId) {
    return false;
  }
  if (participant.status === 'SELECTED') {
    return true;
  }
  if (participant.status === 'ACCEPTED') {
    return true;
  }
  if (participant.status === 'JOINED') {
    return partnerId !== preferredProviderId;
  }
  return false;
}

export function bookingPreferredProviderId(booking: AdminBookingDetail) {
  return booking.preferredProvider?.id ?? booking.preferredProviderId ?? null;
}
