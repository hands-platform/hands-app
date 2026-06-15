import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingPreferredAwaitingDecision } from './booking-preferred-decision';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-preferred-decision',
    participants: [],
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

describe('bookingPreferredAwaitingDecision', () => {
  it('waits on a preferred Partner when no participant response exists yet', () => {
    expect(
      bookingPreferredAwaitingDecision(
        booking({
          preferredProvider: {
            id: 'partner-first',
            displayName: 'Preferred Partner',
          } as AdminBookingDetail['preferredProvider'],
          preferredProviderId: 'partner-first',
        }),
      ),
    ).toBe(true);
  });

  it('stops waiting after the preferred participant has decided', () => {
    expect(
      bookingPreferredAwaitingDecision(
        booking({
          participants: [
            {
              id: 'participant-first',
              providerProfileId: 'partner-first',
              status: 'ACCEPTED',
            },
          ] as AdminBookingDetail['participants'],
          preferredProvider: {
            id: 'partner-first',
            displayName: 'Preferred Partner',
          } as AdminBookingDetail['preferredProvider'],
          preferredProviderId: 'partner-first',
        }),
      ),
    ).toBe(false);
  });

  it('uses final selection evidence when it exists', () => {
    expect(
      bookingPreferredAwaitingDecision(
        booking({
          matchingEvidence: {
            finalSelection: 'FIRST_PICK_PENDING',
          } as AdminBookingDetail['matchingEvidence'],
          preferredProvider: {
            id: 'partner-first',
            displayName: 'Preferred Partner',
          } as AdminBookingDetail['preferredProvider'],
        }),
      ),
    ).toBe(true);

    expect(
      bookingPreferredAwaitingDecision(
        booking({
          matchingEvidence: {
            finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
          } as AdminBookingDetail['matchingEvidence'],
          preferredProvider: {
            id: 'partner-first',
            displayName: 'Preferred Partner',
          } as AdminBookingDetail['preferredProvider'],
        }),
      ),
    ).toBe(false);
  });
});
