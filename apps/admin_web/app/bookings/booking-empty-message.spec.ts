import { emptyBookingMessage } from './booking-empty-message';

describe('booking empty messages', () => {
  it('returns queue-specific empty-state copy', () => {
    expect(emptyBookingMessage('active')).toBe('No active bookings match this queue. Dispatch is clear right now.');
    expect(emptyBookingMessage('blocked-create')).toBe(
      'Blocked booking create attempts are listed above. No booking row exists because payment and matching did not start.',
    );
    expect(emptyBookingMessage('customer-choice')).toBe(
      'No Stage 3 customer choice bookings are waiting. Participating/accepted partners are not blocked on customer selection.',
    );
  });

  it('uses the loading fallback for the all view', () => {
    expect(emptyBookingMessage('all')).toBe(
      'No bookings loaded. Start the API and run the smoke flow to populate this table.',
    );
  });
});
