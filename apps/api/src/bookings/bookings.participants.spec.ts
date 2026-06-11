import {
  bookingParticipantCompoundKey,
  bookingParticipantResponseUnavailableMessage,
} from './bookings.participants';

describe('booking participant helpers', () => {
  it('builds the Prisma compound key for a booking participant', () => {
    expect(bookingParticipantCompoundKey('booking-1', 'partner-1')).toEqual({
      bookingId_providerProfileId: {
        bookingId: 'booking-1',
        providerProfileId: 'partner-1',
      },
    });
  });

  it('keeps provider response unavailable messages role-specific', () => {
    expect(bookingParticipantResponseUnavailableMessage('partner-1', 'partner-1')).toBe(
      'Preferred partner invitation is not available for this booking',
    );
    expect(bookingParticipantResponseUnavailableMessage('first-pick', 'marketplace-partner')).toBe(
      'Partner must participate in this marketplace booking before responding',
    );
    expect(bookingParticipantResponseUnavailableMessage(null, 'marketplace-partner')).toBe(
      'Partner must participate in this marketplace booking before responding',
    );
  });
});
