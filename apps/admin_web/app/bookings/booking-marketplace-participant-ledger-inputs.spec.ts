import type { AdminBooking } from '../../lib/admin-api';
import { bookingMarketplaceParticipantLedgerInputs } from './booking-marketplace-participant-ledger-inputs';

type BookingParticipant = NonNullable<AdminBooking['participants']>[number];

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

function participant(input: Partial<BookingParticipant>): BookingParticipant {
  return input as BookingParticipant;
}

describe('bookingMarketplaceParticipantLedgerInputs', () => {
  it('builds participant ledger inputs from admin booking and filters rows without provider ids', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');
    const includedParticipant = participant({
      distanceMeters: 900,
      id: 'participant-selected',
      joinedAt: '2026-06-12T09:45:00.000Z',
      providerProfile: { displayName: 'Selected Partner', id: 'selected' },
      respondedAt: '2026-06-12T09:55:00.000Z',
      status: 'SELECTED',
    });
    const item = booking({
      earning: {
        currency: 'VND',
        netAmount: 100000,
        status: 'PENDING',
      } as AdminBooking['earning'],
      expiresAt: '2026-06-12T10:05:00.000Z',
      id: 'booking-1',
      participants: [
        includedParticipant,
        participant({
          id: 'participant-without-provider',
          status: 'JOINED',
        }),
      ],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      selectedProvider: { id: 'selected', displayName: 'Selected Partner' } as AdminBooking['selectedProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(bookingMarketplaceParticipantLedgerInputs(item, nowMs, 5000)).toEqual([
      expect.objectContaining({
        alertLabel: 'No marketplace trace',
        alertTone: 'pill-danger',
        booking: item,
        bookingStatus: 'OPEN_MATCHING',
        customerSelectable: true,
        distanceMeters: 900,
        hasChatRoom: false,
        joinedLabel: '12 Jun 2026, 16:45 / 15m ago',
        marketplaceRadiusMeters: 5000,
        participant: includedParticipant,
        participantPartnerId: 'selected',
        partnerLabel: 'Selected Partner',
        preferredPartnerId: 'preferred',
        respondedLabel: 'Responded 12 Jun 2026, 16:55',
        selectedPartnerId: 'selected',
        sortTimestamp: Date.parse('2026-06-12T09:55:00.000Z'),
        status: 'SELECTED',
        walletLabel: 'Wallet 100.000 VND',
        walletTone: 'pill-info',
        windowLabel: '5m left',
      }),
    ]);
  });
});
