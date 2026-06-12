import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingIsBackupSelected,
  bookingIsSelectedProviderParticipant,
  bookingPreferredAwaitingDecision,
  bookingPreferredParticipantState,
  bookingPreferredProviderStateLabel,
} from './booking-preferred-provider-state';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

function participant(input: Partial<BookingParticipant>): BookingParticipant {
  return input as BookingParticipant;
}

describe('booking preferred provider state', () => {
  it('finds selected and preferred participants by partner ids', () => {
    const preferred = participant({
      id: 'participant-preferred',
      providerProfile: { id: 'preferred' },
      status: 'JOINED',
    });
    const item = booking({
      participants: [
        preferred,
        participant({
          id: 'participant-selected',
          providerProfileId: 'selected',
          status: 'SELECTED',
        }),
      ],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      selectedProvider: { id: 'selected', displayName: 'Selected Partner' } as AdminBooking['selectedProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(bookingPreferredParticipantState(item)).toBe(preferred);
    expect(bookingIsSelectedProviderParticipant(item)).toBe(true);
    expect(bookingIsBackupSelected(item)).toBe(true);
  });

  it('derives pending and display labels from preferred provider state', () => {
    const item = booking({
      participants: [
        participant({
          id: 'participant-preferred',
          providerProfileId: 'preferred',
          status: 'JOINED',
        }),
      ],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(bookingPreferredAwaitingDecision(item)).toBe(true);
    expect(bookingPreferredProviderStateLabel(item)).toBe('pending');

    expect(
      bookingPreferredProviderStateLabel(
        booking({
          matchingEvidence: { firstPickStatus: 'REJECTED' } as AdminBooking['matchingEvidence'],
          preferredProvider: { id: 'preferred' } as AdminBooking['preferredProvider'],
          status: 'OPEN_MATCHING',
        }),
      ),
    ).toBe('declined');
  });

  it('prioritizes backup selection over preferred provider status labels', () => {
    const item = booking({
      matchingEvidence: { firstPickStatus: 'ACCEPTED' } as AdminBooking['matchingEvidence'],
      participants: [
        participant({
          id: 'participant-preferred',
          providerProfileId: 'preferred',
          status: 'ACCEPTED',
        }),
      ],
      preferredProvider: { id: 'preferred' } as AdminBooking['preferredProvider'],
      selectedProvider: { id: 'selected' } as AdminBooking['selectedProvider'],
      status: 'MATCHED',
    });

    expect(bookingPreferredProviderStateLabel(item)).toBe('not final');
  });
});
