import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorPrimaryCommandQueue } from './booking-monitor-primary-command-queue-model';

describe('buildBookingMonitorPrimaryCommandQueue', () => {
  it('groups booking command strips with the matching route href', () => {
    const queue = buildBookingMonitorPrimaryCommandQueue([
      { id: 'missing-address-1', status: 'OPEN_MATCHING' },
      { id: 'missing-address-2', status: 'OPEN_MATCHING' },
    ] as unknown as AdminBooking[]);

    expect(queue).toEqual([
      expect.objectContaining({
        count: 2,
        href: '/bookings?view=address',
        primaryAction: 'Confirm service address',
        sampleBookingIds: ['missing-address-1', 'missing-address-2'],
        status: 'Address check',
      }),
    ]);
  });
});
