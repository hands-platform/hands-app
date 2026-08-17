import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingExpiryEligibility } from '../../../lib/booking-operator-action-rules';
import {
  bookingParticipantPartnerId,
  bookingCustomerSelectableParticipantsForBooking,
  bookingPreferredPartnerIdForChoice,
  bookingSelectedPartnerIdForChoice,
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

export function bookingSelectedProviderId(booking: AdminBookingDetail) {
  return bookingSelectedPartnerIdForChoice(booking);
}

export function bookingParticipantProviderId(participant: BookingDetailParticipant) {
  return bookingParticipantPartnerId(participant);
}

export function bookingCustomerSelectableParticipantsForFinalChoice(booking: AdminBookingDetail) {
  return bookingCustomerSelectableParticipantsForBooking(booking);
}

export function bookingDetailExpiryEligibility(booking: AdminBookingDetail) {
  return bookingExpiryEligibility({
    customerChoiceCandidateCount: bookingCustomerSelectableParticipantsForFinalChoice(booking).length,
    closedReason: booking.closedReason,
    closeoutRecoveryPending:
      booking.opsTasks?.some(
        (task) =>
          task.type === 'PAYMENT_REVIEWED' &&
          task.status === 'PENDING' &&
          task.note?.startsWith('Booking closeout is pending'),
      ) ?? false,
    expiresAt: booking.expiresAt,
    selectedProviderId: bookingSelectedProviderId(booking),
    status: booking.status,
  });
}
