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
  it('flags matched bookings without a recorded final partner instead of falling back to preferred partner', () => {
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
      stage: 'Stage 4 - Final partner repair',
      pillClass: 'pill-danger',
      actionLabel: 'Repair final partner',
    });
    expect(snapshot.badges.at(-1)).toMatchObject({
      label: 'Not selected',
      tone: 'pill-danger',
    });
  });
});
