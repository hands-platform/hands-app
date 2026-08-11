import { emptyBookingMessage } from './booking-empty-message';

describe('booking empty messages', () => {
  it('returns queue-specific empty-state copy', () => {
    expect(emptyBookingMessage('active')).toBe(
      'No active bookings match this queue. Dispatch is clear right now.',
    );
    expect(emptyBookingMessage('blocked-create')).toBe(
      'Blocked booking create attempts are listed above. No booking row exists because payment and matching did not start.',
    );
    expect(emptyBookingMessage('customer-choice')).toBe(
      'No customer is waiting to choose from participating Partners.',
    );
    expect(emptyBookingMessage('attention')).toBe(
      'No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.',
    );
  });

  it('uses the loading fallback for the all view', () => {
    expect(emptyBookingMessage('all')).toBe('No booking records are available yet.');
    expect(
      emptyBookingMessage('all', {
        age: 'all',
        dateRangeFilter: '30d',
        searchQuery: 'customer-123',
      }),
    ).toBe(
      'No records match “customer-123” in Last 30 days. Clear the search or change the period.',
    );
  });
});
