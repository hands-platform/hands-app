import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingStageSnapshot } from './booking-stage-snapshot';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-stage',
    status: 'OPEN_MATCHING',
    participants: [],
    ...input,
  } as AdminBookingDetail;
}

describe('booking stage snapshot', () => {
  it('flags matched bookings without a recorded final Partner instead of falling back to preferred Partner', () => {
    const snapshot = bookingStageSnapshot(
      booking({
        status: 'MATCHED',
        preferredProvider: {
          id: 'partner-first',
          displayName: 'First Pick Partner',
        },
      }),
      {
        detail: 'Customer wait panel detail.',
      },
      {
        eligibleCount: 0,
      },
    );

    expect(snapshot).toMatchObject({
      stage: 'Stage 4 - Final Partner repair',
      pillClass: 'pill-danger',
      actionLabel: 'Repair final Partner',
    });
    expect(snapshot.badges.at(-1)).toMatchObject({
      label: 'Not selected',
      tone: 'pill-danger',
    });
  });

  it('prefers server matching evidence for customer choice and chat readiness', () => {
    const snapshot = bookingStageSnapshot(
      booking({
        status: 'OPEN_MATCHING',
        participants: [],
        matchingEvidence: {
          stage: 'OPEN_MARKETPLACE_ACTIVE',
          finalSelection: 'CUSTOMER_SELECTION_AVAILABLE',
          firstPickStatus: 'JOINED',
          marketplaceParticipantCount: 1,
          selectableParticipantCount: 2,
          matchedAt: null,
          matchSource: null,
          chatReady: true,
        },
      }),
      {
        detail: 'Customer can pick from the API shortlist.',
      },
      {
        eligibleCount: 0,
      },
    );

    expect(snapshot).toMatchObject({
      stage: 'Stage 3 - Customer choice',
      actionLabel: 'Review shortlist',
    });
    expect(snapshot.metrics).toContainEqual(
      expect.objectContaining({
        label: 'Shortlist',
        value: '2 selectable',
      }),
    );
    expect(snapshot.badges).toContainEqual(
      expect.objectContaining({
        label: 'Chat ready',
        tone: 'pill-success',
      }),
    );
  });

  it('uses stage-specific status helper for completed closeout', () => {
    const snapshot = bookingStageSnapshot(
      booking({
        payment: { id: 'payment-1' } as AdminBookingDetail['payment'],
        status: 'COMPLETED',
      }),
      {
        detail: 'Customer wait panel detail.',
      },
      {
        eligibleCount: 0,
      },
    );

    expect(snapshot.metrics).toContainEqual(
      expect.objectContaining({
        helper: 'Closeout stage ready.',
        label: 'Status',
        value: 'COMPLETED',
      }),
    );
  });
});
