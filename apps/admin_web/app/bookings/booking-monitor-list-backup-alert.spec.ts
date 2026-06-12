import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorListBackupAlert } from './booking-monitor-list-backup-alert';

describe('bookingMonitorListBackupAlert', () => {
  it('builds list row backup alert copy from retained alert trace metadata', () => {
    const nowMs = Date.parse('2026-06-07T01:15:00.000Z');
    const booking = {
      status: 'OPEN_MATCHING',
      metadata: {
        backupNotificationTraces: [
          { notifiedCount: 2, stage: 'initial_open', createdAt: '2026-06-07T01:00:00.000Z' },
          { notifiedCount: '3', stage: 'retry', createdAt: '2026-06-07T01:10:00.000Z' },
        ],
      },
    } as AdminBooking;

    expect(bookingMonitorListBackupAlert(booking, nowMs)).toEqual({
      label: 'Marketplace alerts: 5 notified / 2 batch(es) / last 5m ago',
      pill: '5 marketplace alert(s)',
      tone: 'pill-success',
    });
  });
});
