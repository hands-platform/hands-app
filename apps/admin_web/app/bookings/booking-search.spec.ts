import type { AdminBooking } from '../../lib/admin-api';
import { bookingMatchesSearch, bookingSearchHaystack, uniqueSortedOptions } from './booking-search';

function bookingFixture(): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    customerProfile: {
      user: {
        fullName: 'Linh Tran',
        phone: '+84901234567',
      },
    },
    preferredProvider: {
      displayName: 'Preferred Partner',
      user: {
        fullName: 'Minh Nguyen',
        phone: '+84907654321',
      },
    },
    selectedProvider: {
      displayName: 'Selected Partner',
      user: {
        fullName: 'Hoa Pham',
      },
    },
    payment: {
      method: 'CARD',
      status: 'AUTHORIZED',
      providerRef: 'pay_123',
      amount: 350000,
      currency: 'VND',
    },
    services: [
      {
        price: 350000,
        service: {
          name: 'Deep tissue',
          durationMin: 60,
          basePrice: 300000,
          payoutRules: [],
        },
      },
    ],
    participants: [
      {
        status: 'ACCEPTED',
        providerProfile: {
          displayName: 'Backup Partner',
          user: {
            phone: '+84908887777',
          },
        },
      },
    ],
  } as unknown as AdminBooking;
}

describe('booking search helpers', () => {
  it('builds a searchable haystack from booking identity, people, payment, and service fields', () => {
    const haystack = bookingSearchHaystack(bookingFixture());

    expect(haystack).toContain('booking-1');
    expect(haystack).toContain('linh tran');
    expect(haystack).toContain('preferred partner');
    expect(haystack).toContain('backup partner');
    expect(haystack).toContain('pay_123');
    expect(haystack).toContain('deep tissue');
  });

  it('matches normalized user search input', () => {
    const booking = bookingFixture();

    expect(bookingMatchesSearch(booking, '  LINH ')).toBe(true);
    expect(bookingMatchesSearch(booking, 'backup partner')).toBe(true);
    expect(bookingMatchesSearch(booking, '')).toBe(true);
    expect(bookingMatchesSearch(booking, 'not-in-booking')).toBe(false);
  });

  it('deduplicates and sorts filter options', () => {
    expect(uniqueSortedOptions(['CARD', null, 'CASH', 'CARD', undefined, ''])).toEqual(['CARD', 'CASH']);
  });
});
