import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorCheckFlags } from './booking-monitor-check-flags-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('bookingMonitorCheckFlags', () => {
  it('builds matching-window and supply flags from booking facts', () => {
    expect(
      bookingMonitorCheckFlags(
        {
          expiresAt: '2026-06-07T09:45:00.000Z',
          id: 'expired-open-matching',
          participants: [],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ).map((flag) => flag.title),
    ).toEqual(expect.arrayContaining(['Matching window expired', 'No partner supply']));
  });

  it('builds matched chat repair flags from retained chat facts', () => {
    expect(
      bookingMonitorCheckFlags(
        {
          id: 'matched-without-chat',
          selectedProvider: { id: 'partner-1' },
          status: 'MATCHED',
        } as unknown as AdminBooking,
        nowMs,
      ).map((flag) => flag.title),
    ).toEqual(expect.arrayContaining(['Matched without chat']));
  });
});
