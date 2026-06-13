import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorMatchesEvidenceFilter } from './booking-monitor-evidence-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('bookingMonitorMatchesEvidenceFilter', () => {
  it('matches address evidence from missing booking address snapshots', () => {
    expect(
      bookingMonitorMatchesEvidenceFilter(
        {
          id: 'missing-address',
          status: 'OPEN_MATCHING',
        } as AdminBooking,
        'address',
        nowMs,
      ),
    ).toBe(true);
  });

  it('matches money evidence from payment follow-up state', () => {
    expect(
      bookingMonitorMatchesEvidenceFilter(
        {
          id: 'payment-follow-up',
          status: 'OPEN_MATCHING',
        } as AdminBooking,
        'money',
        nowMs,
      ),
    ).toBe(true);
  });

  it('matches alert evidence from notification metadata', () => {
    expect(
      bookingMonitorMatchesEvidenceFilter(
        {
          id: 'alert-evidence',
          metadata: {
            backupNotificationTraces: [{ notifiedCount: 1 }],
          } as AdminBooking['metadata'],
          status: 'MATCHED',
        } as AdminBooking,
        'alerts',
        nowMs,
      ),
    ).toBe(true);
  });
});
