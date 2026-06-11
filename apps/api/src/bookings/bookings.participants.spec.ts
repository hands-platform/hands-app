import { ParticipantStatus } from '@prisma/client';
import {
  bookingParticipantCompoundKey,
  bookingParticipantResponseRoute,
  bookingParticipantResponseUnavailableMessage,
  bookingSelectedParticipantUpdate,
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

  it('builds the selected participant update payload', () => {
    const respondedAt = new Date('2026-06-11T00:00:00.000Z');

    expect(bookingSelectedParticipantUpdate('booking-1', 'partner-1', respondedAt)).toEqual({
      update: {
        where: {
          bookingId_providerProfileId: {
            bookingId: 'booking-1',
            providerProfileId: 'partner-1',
          },
        },
        data: {
          status: ParticipantStatus.SELECTED,
          respondedAt,
        },
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

  it('routes first-pick accepted and rejected responses before marketplace handling', () => {
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.ACCEPTED)).toBe(
      'first-pick-accepted',
    );
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.REJECTED)).toBe(
      'first-pick-rejected',
    );
    expect(bookingParticipantResponseRoute('first-pick', 'marketplace-partner', ParticipantStatus.ACCEPTED)).toBe(
      'marketplace',
    );
    expect(bookingParticipantResponseRoute('partner-1', 'partner-1', ParticipantStatus.JOINED)).toBe(
      'marketplace',
    );
  });
});
