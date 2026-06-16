import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingCustomerSelectableParticipantsForBooking,
  bookingMarketplaceParticipantsForBooking,
} from '../../lib/booking-participant-choice';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

export type BookingMarketplaceCountFacts = {
  readonly customerSelectableCount: number;
  readonly marketplaceParticipantCount: number;
};

export function bookingMarketplaceParticipants(booking: AdminBooking): BookingParticipant[] {
  return bookingMarketplaceParticipantsForBooking(booking);
}

export function bookingCustomerSelectableParticipants(booking: AdminBooking): BookingParticipant[] {
  return bookingCustomerSelectableParticipantsForBooking(booking);
}

export function bookingMarketplaceCountFacts(booking: AdminBooking): BookingMarketplaceCountFacts {
  return {
    customerSelectableCount: bookingCustomerSelectableCount(booking),
    marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
  };
}

export function bookingMarketplaceParticipantCount(booking: AdminBooking): number {
  const matchingEvidenceCount = booking.matchingEvidence?.marketplaceParticipantCount;
  return matchingEvidenceCount ?? bookingMarketplaceParticipants(booking).length;
}

export function bookingCustomerSelectableCount(booking: AdminBooking): number {
  const matchingEvidenceCount = booking.matchingEvidence?.selectableParticipantCount;
  return matchingEvidenceCount ?? bookingCustomerSelectableParticipants(booking).length;
}
