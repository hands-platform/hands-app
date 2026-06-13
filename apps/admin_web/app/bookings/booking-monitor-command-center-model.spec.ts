import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMonitorCommandCenter,
  buildBookingMonitorCommandCenterFacts,
} from './booking-monitor-command-center-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('booking monitor command center model', () => {
  it('builds dispatch pressure from open matching bookings without supply', () => {
    const lanes = buildBookingMonitorCommandCenter(
      [
        {
          expiresAt: '2026-06-07T09:45:00.000Z',
          id: 'no-supply',
          participants: [],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
      ],
      nowMs,
    );

    expect(lanes[0]).toMatchObject({
      href: '/bookings?view=no-supply',
      status: 'Action needed',
      title: 'Dispatch pressure',
      tone: 'danger',
    });
  });

  it('builds customer protection facts from matched bookings without chat', () => {
    const facts = buildBookingMonitorCommandCenterFacts(
      [
        {
          id: 'matched-without-chat',
          selectedProvider: { id: 'partner-1' },
          status: 'MATCHED',
        } as unknown as AdminBooking,
      ],
      nowMs,
    );

    expect(facts.active).toHaveLength(1);
    expect(facts.matchedWithoutChat).toHaveLength(1);
  });
});
