import type { AdminAuditLog } from '../../../lib/admin-api';
import { buildPartnerBookingGateAttemptRows } from './partner-detail-booking-gate-rows-model';

describe('partner detail booking gate rows model', () => {
  it('maps rejected booking creation evidence and sorts the newest attempt first', () => {
    const rows = buildPartnerBookingGateAttemptRows(
      [
        auditLog('gate-old', '2026-07-20T08:00:00.000Z', {
          bookingAddress: { addressText: '10 Le Loi' },
          preferredProviderDistanceLimitMeters: 5000,
          preferredProviderDistanceMeters: 6200,
          reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
        }),
        auditLog('ignored', '2026-07-20T10:00:00.000Z', {}, 'provider.updated'),
        auditLog('gate-new', '2026-07-20T09:00:00.000Z', {
          bookingAddress: { addressText: '25 Nguyen Hue, District 1' },
          currentLocationRecordedAt: '2026-07-20T08:58:00.000Z',
          customerDistanceLimitMeters: 1000,
          customerDistanceMeters: 250,
          customerProfileId: 'customer-long-record-id',
          preferredProviderDistanceLimitMeters: 5000,
          preferredProviderDistanceMeters: 4200,
          reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
          serviceId: 'service-long-record-id',
        }),
      ],
      'partner-1',
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      addressLabel: '25 Nguyen Hue, District 1',
      at: '2026-07-20T09:00:00.000Z',
      auditHref: '/audit-log?query=booking.create.rejected&target=provider%3Apartner-1',
      id: 'gate-new',
      tone: 'pill-info',
    });
    expect(rows[0]?.bookingMonitorHref).toContain('view=blocked-create');
    expect(rows[0]?.detail).toContain('Optional customer GPS evidence');
    expect(rows[0]?.distanceLabel).toContain('First-pick');
    expect(rows[0]?.distanceLabel).toContain('Optional customer GPS');
  });

  it('keeps incomplete or unknown evidence reviewable without inventing distances', () => {
    const [row] = buildPartnerBookingGateAttemptRows(
      [auditLog('gate-unknown', '2026-07-20T09:00:00.000Z', { reasonCode: 'UNRECOGNIZED_GATE' })],
      'partner-2',
    );

    expect(row).toMatchObject({
      addressLabel: 'No address metadata',
      distanceLabel: 'No distance value',
      gate: 'unknown',
      tone: 'pill-warn',
    });
    expect(row?.detail).toContain('No optional GPS timestamp');
  });
});

function auditLog(
  id: string,
  createdAt: string,
  metadata: Record<string, unknown>,
  action = 'booking.create.rejected',
): AdminAuditLog {
  return {
    action,
    createdAt,
    id,
    metadata,
    target: 'provider',
  } as AdminAuditLog;
}
