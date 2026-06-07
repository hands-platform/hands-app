import type { AdminBooking } from './admin-api';
import { buildMarketplaceParticipantSnapshot } from './dashboard-marketplace';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    id: 'booking-default',
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBooking;
}

describe('dashboard marketplace participant snapshot', () => {
  it('summarizes first-pick, marketplace, selectable, selected, and declined participant rows', () => {
    const bookings = [
      booking({
        id: 'booking-selected-123456',
        preferredProviderId: 'partner-first',
        selectedProviderId: 'partner-market',
        services: [
          {
            service: {
              name: 'Foot Massage',
              durationMin: 60,
            },
          },
        ],
        participants: [
          {
            id: 'participant-first',
            providerProfileId: 'partner-first',
            status: 'ACCEPTED',
            joinedAt: '2026-06-07T01:00:00.000Z',
            respondedAt: '2026-06-07T01:01:00.000Z',
          },
          {
            id: 'participant-market',
            providerProfileId: 'partner-market',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:02:00.000Z',
          },
        ],
      }),
      booking({
        id: 'booking-open-empty',
        status: 'OPEN_MATCHING',
        participants: [],
      }),
      booking({
        id: 'booking-declined',
        status: 'CANCELLED',
        participants: [
          {
            id: 'participant-declined',
            providerProfileId: 'partner-declined',
            status: 'REJECTED',
            joinedAt: '2026-06-07T00:55:00.000Z',
            respondedAt: '2026-06-07T00:56:00.000Z',
          },
        ],
      }),
    ];

    const snapshot = buildMarketplaceParticipantSnapshot(bookings);

    expect(snapshot.participantRows).toBe(3);
    expect(snapshot.firstPickRows).toBe(1);
    expect(snapshot.marketplaceRows).toBe(2);
    expect(snapshot.customerSelectableRows).toBe(2);
    expect(snapshot.customerSelectedRows).toBe(1);
    expect(snapshot.declinedRows).toBe(1);
    expect(snapshot.openBookingsWithoutParticipants).toBe(1);
    expect(snapshot.bookingsWithParticipantHistory).toBe(2);
    expect(snapshot.latestParticipantLabel).toBe('Foot Massage (60 min) / booking-');
    expect(snapshot.latestParticipantHref).toBe('/bookings/booking-selected-123456#participants');
  });

  it('uses nested partner ids when direct id fields are not included in the admin payload', () => {
    const snapshot = buildMarketplaceParticipantSnapshot([
      booking({
        id: 'booking-nested-ids',
        preferredProvider: { id: 'partner-first', displayName: 'Linh Wellness' },
        participants: [
          {
            id: 'participant-first',
            status: 'ACCEPTED',
            joinedAt: '2026-06-07T01:00:00.000Z',
            providerProfile: { id: 'partner-first', displayName: 'Linh Wellness' },
          },
          {
            id: 'participant-market',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:01:00.000Z',
            providerProfile: { id: 'partner-market', displayName: 'Sen Ne' },
          },
        ],
      }),
    ]);

    expect(snapshot.firstPickRows).toBe(1);
    expect(snapshot.marketplaceRows).toBe(1);
    expect(snapshot.customerSelectableRows).toBe(2);
  });

  it('does not count a pending first-pick partner as customer-selectable marketplace supply', () => {
    const snapshot = buildMarketplaceParticipantSnapshot([
      booking({
        id: 'booking-first-pick-pending',
        preferredProviderId: 'partner-first',
        participants: [
          {
            id: 'participant-first-pending',
            providerProfileId: 'partner-first',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:00:00.000Z',
          },
          {
            id: 'participant-market-ready',
            providerProfileId: 'partner-market',
            status: 'JOINED',
            joinedAt: '2026-06-07T01:01:00.000Z',
          },
        ],
      }),
    ]);

    expect(snapshot.firstPickRows).toBe(1);
    expect(snapshot.marketplaceRows).toBe(1);
    expect(snapshot.customerSelectableRows).toBe(1);
  });

  it('returns operator-safe fallbacks when no participant history exists', () => {
    const snapshot = buildMarketplaceParticipantSnapshot([
      booking({
        id: 'booking-empty',
        status: 'OPEN_MATCHING',
        participants: [],
      }),
    ]);

    expect(snapshot.participantRows).toBe(0);
    expect(snapshot.latestParticipantLabel).toBe('No participant row');
    expect(snapshot.latestParticipantHref).toBe('/bookings?view=marketplace');
  });
});
