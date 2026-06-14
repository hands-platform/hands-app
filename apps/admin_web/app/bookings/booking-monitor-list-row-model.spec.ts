import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorListRow } from './booking-monitor-list-row-model';

const nowMs = new Date('2026-06-12T09:45:00.000Z').getTime();

describe('buildBookingMonitorListRow', () => {
  it('builds a monitor list row from booking facts', () => {
    const booking = {
      createdAt: '2026-06-12T09:40:00.000Z',
      id: 'booking-1',
      participants: [],
      status: 'OPEN_MATCHING',
    } as unknown as AdminBooking;

    const row = buildBookingMonitorListRow(booking, nowMs, nowMs);

    expect(row.booking).toBe(booking);
    expect(row.stage.key).toBe('first-pick');
    expect(row.nextActionLabel).toBe('Check notifications and nearby Partner supply.');
    expect(row.selection.label).toBe('No first-pick Partner');
    expect(row.serviceOptionLabel).toBe('Service pending');
  });
});
