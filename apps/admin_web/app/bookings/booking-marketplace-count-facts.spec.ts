import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceCountFacts,
  bookingMarketplaceParticipantCount,
  bookingMarketplaceParticipants,
} from './booking-marketplace-count-facts';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

function participant(input: Partial<BookingParticipant>): BookingParticipant {
  return input as BookingParticipant;
}

describe('booking marketplace count facts', () => {
  it('uses matching evidence counts when the API provides them', () => {
    const item = booking({
      id: 'booking-1',
      matchingEvidence: {
        marketplaceParticipantCount: 4,
        selectableParticipantCount: 2,
      } as AdminBooking['matchingEvidence'],
      participants: [],
    });

    expect(bookingMarketplaceCountFacts(item)).toEqual({
      customerSelectableCount: 2,
      marketplaceParticipantCount: 4,
    });
  });

  it('falls back to participant rows when matching evidence counts are absent', () => {
    const item = booking({
      id: 'booking-2',
      participants: [
        participant({
          providerProfile: { id: 'preferred' },
          status: 'JOINED',
        }),
        participant({
          providerProfile: { id: 'marketplace-1' },
          status: 'JOINED',
        }),
        participant({
          providerProfile: { id: 'marketplace-2' },
          status: 'PENDING',
        }),
        participant({
          providerProfile: { id: 'rejected' },
          status: 'REJECTED',
        }),
      ],
      preferredProvider: { id: 'preferred' } as AdminBooking['preferredProvider'],
    });

    expect(bookingMarketplaceParticipants(item)).toHaveLength(2);
    expect(bookingMarketplaceParticipantCount(item)).toBe(2);
    expect(bookingCustomerSelectableCount(item)).toBe(1);
  });
});
