import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorMatchingFlowTimeline } from './booking-monitor-matching-flow';

describe('buildBookingMonitorMatchingFlowTimeline', () => {
  it('builds the operator timeline from booking count facts', () => {
    const timeline = buildBookingMonitorMatchingFlowTimeline(
      [
        {
          id: 'open-no-supply',
          matchingEvidence: {
            marketplaceParticipantCount: 0,
            selectableParticipantCount: 0,
          },
          status: 'OPEN_MATCHING',
        } as AdminBooking,
      ],
      new Date('2026-06-07T10:00:00.000Z').getTime(),
    );

    expect(timeline.map((step) => [step.stage, step.title, step.status])).toEqual([
      ['Stage 1', 'Direct first-pick request', 'Clear'],
      ['Stage 2', 'Marketplace participation', 'Supply gap'],
      ['Stage 3', 'Customer fallback Partner choice', 'Clear'],
      ['Stage 4', 'Chat and location handoff', 'Ready'],
    ]);
    expect(timeline[1].bookings.map((booking) => booking.id)).toEqual(['open-no-supply']);
  });
});
