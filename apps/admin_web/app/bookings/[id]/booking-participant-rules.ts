import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingCustomerSelectableParticipantsForBooking,
  bookingPreferredPartnerIdForChoice,
  isCustomerSelectableBookingParticipant,
} from '../../../lib/booking-participant-choice';

export type BookingDetailParticipant = NonNullable<AdminBookingDetail['participants']>[number];

export function isCustomerSelectableParticipantForFinalChoice(
  participant: BookingDetailParticipant,
  preferredProviderId?: string | null,
) {
  return isCustomerSelectableBookingParticipant(participant, preferredProviderId);
}

export function bookingPreferredProviderId(booking: AdminBookingDetail) {
  return bookingPreferredPartnerIdForChoice(booking);
}

export function bookingCustomerSelectableParticipantsForFinalChoice(booking: AdminBookingDetail) {
  return bookingCustomerSelectableParticipantsForBooking(booking);
}
