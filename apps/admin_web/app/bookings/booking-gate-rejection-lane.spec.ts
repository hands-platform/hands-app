import type { AdminAuditLog } from '../../lib/admin-api';
import { buildBookingGateRejectionLane } from './booking-gate-rejection-lane';

function log(createdAt: string, reasonCode: string): AdminAuditLog {
  return {
    action: 'booking.create.rejected',
    createdAt,
    id: `audit-${reasonCode}`,
    metadata: { reasonCode },
    target: 'booking:create',
  } as AdminAuditLog;
}

describe('buildBookingGateRejectionLane', () => {
  it('builds a warning lane from blocked create audit logs', () => {
    const lane = buildBookingGateRejectionLane(
      [
        log('2026-06-07T09:50:00.000Z', 'CUSTOMER_CURRENT_LOCATION_TOO_FAR'),
        log('2026-06-07T09:45:00.000Z', 'PREFERRED_PARTNER_TOO_FAR'),
        log('2026-06-07T09:40:00.000Z', 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA'),
      ],
      new Date('2026-06-07T10:00:00.000Z').getTime(),
    );

    expect(lane).toMatchObject({
      href: '/bookings?view=blocked-create',
      status: '3 stopped',
      title: 'Blocked booking attempts',
      tone: 'warn',
    });
    expect(lane.detail).toContain('1 optional GPS distance');
    expect(lane.metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Optional GPS evidence', '1'],
      ['First-pick distance', '1'],
      ['Service area', '1'],
      ['Optional GPS evidence attempts', '1'],
      ['Latest', '10m ago'],
    ]);
  });

  it('uses the clear lane when there are no blocked create logs', () => {
    const lane = buildBookingGateRejectionLane([], new Date('2026-06-07T10:00:00.000Z').getTime());

    expect(lane).toMatchObject({
      detail: 'No booking create request has been blocked by the local booking gates.',
      status: 'Clear',
      tone: 'ok',
    });
  });
});
