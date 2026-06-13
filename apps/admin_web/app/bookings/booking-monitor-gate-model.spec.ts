import type { AdminAuditLog } from '../../lib/admin-api';
import { buildBookingMonitorGateModel } from './booking-monitor-gate-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

function auditLog(
  id: string,
  reasonCode: string,
  createdAt: string,
): AdminAuditLog {
  return {
    action: 'booking.create.rejected',
    createdAt,
    id,
    metadata: { reasonCode },
    target: 'booking:create',
  };
}

describe('buildBookingMonitorGateModel', () => {
  it('orders create rejections and builds the active gate view model', () => {
    const model = buildBookingMonitorGateModel({
      activeFilter: 'first-pick-distance',
      logs: [
        auditLog('old-service-area', 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA', '2026-06-07T09:50:00.000Z'),
        auditLog('latest-first-pick', 'PREFERRED_PARTNER_TOO_FAR', '2026-06-07T09:59:00.000Z'),
      ],
      nowMs,
    });

    expect(model.orderedBookingCreateRejections.map((log) => log.id)).toEqual([
      'latest-first-pick',
      'old-service-area',
    ]);
    expect(model.visibleBookingCreateRejections.map((log) => log.id)).toEqual(['latest-first-pick']);
    expect(model.bookingGateRejectionLane.status).toBe('2 stopped');
    expect(model.bookingGateTriage.find((item) => item.filter === 'first-pick-distance')).toMatchObject({
      count: 1,
      status: 'Selected',
    });
  });
});
