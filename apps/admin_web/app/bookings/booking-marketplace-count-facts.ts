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
  return (
    booking.matchingEvidence?.marketplaceParticipantCount ??
    bookingMarketplaceParticipants(booking).length
  );
}

export function bookingCustomerSelectableCount(booking: AdminBooking): number {
  return (
    booking.matchingEvidence?.selectableParticipantCount ??
    bookingCustomerSelectableParticipants(booking).length
  );
}
