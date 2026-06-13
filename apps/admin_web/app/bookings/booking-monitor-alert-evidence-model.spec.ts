import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorAlertEvidenceNeedsOps } from './booking-monitor-alert-evidence-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

describe('bookingMonitorAlertEvidenceNeedsOps', () => {
  it('flags existing alert batches from booking metadata', () => {
    expect(
      bookingMonitorAlertEvidenceNeedsOps(
        {
          id: 'booking-with-alert',
          metadata: {
            backupNotificationTraces: [{ notifiedCount: 1 }],
          } as AdminBooking['metadata'],
          status: 'MATCHED',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toBe(true);
  });

  it('flags open matching bookings without participants', () => {
    expect(
      bookingMonitorAlertEvidenceNeedsOps(
        {
          id: 'open-without-participants',
          participants: [],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        nowMs,
      ),
    ).toBe(true);
  });
});
