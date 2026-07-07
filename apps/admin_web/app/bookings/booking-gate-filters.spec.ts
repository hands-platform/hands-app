import type { AdminAuditLog } from '../../lib/admin-api';
import {
  bookingGateAuditQuery,
  bookingGateCount,
  bookingGateFilterOptions,
  bookingGateMatchesFilter,
  buildBookingGateTriage,
} from './booking-gate-filters';

function auditLog(reasonCode: string | null, overrides: Partial<AdminAuditLog> = {}): AdminAuditLog {
  return {
    id: reasonCode ?? 'unknown',
    action: 'booking.create.rejected',
    target: 'booking:create',
    metadata: reasonCode ? { reasonCode } : {},
    createdAt: '2026-06-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('booking gate filters', () => {
  it('classifies audit logs by gate filter', () => {
    expect(bookingGateMatchesFilter(auditLog('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA'), 'service-area')).toBe(true);
    expect(bookingGateMatchesFilter(auditLog('CUSTOMER_CURRENT_LOCATION_STALE'), 'customer-gps')).toBe(true);
    expect(bookingGateMatchesFilter(auditLog('CUSTOMER_CURRENT_LOCATION_TOO_FAR'), 'customer-distance')).toBe(true);
    expect(bookingGateMatchesFilter(auditLog('PREFERRED_PARTNER_TOO_FAR'), 'first-pick-distance')).toBe(true);
    expect(bookingGateMatchesFilter(auditLog(null), 'unknown')).toBe(true);
    expect(bookingGateMatchesFilter(auditLog('PREFERRED_PARTNER_TOO_FAR'), 'all')).toBe(true);
  });

  it('counts logs for a selected gate filter', () => {
    const logs = [
      auditLog('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA'),
      auditLog('PREFERRED_PARTNER_TOO_FAR'),
      auditLog('PREFERRED_PARTNER_TOO_FAR'),
    ];

    expect(bookingGateCount(logs, 'first-pick-distance')).toBe(2);
    expect(bookingGateCount(logs, 'service-area')).toBe(1);
    expect(bookingGateCount(logs, 'customer-gps')).toBe(0);
    expect(bookingGateCount(logs, 'all')).toBe(3);
  });

  it('builds audit-log search queries for each gate filter', () => {
    expect(bookingGateAuditQuery('all')).toBe('booking.create.rejected');
    expect(bookingGateAuditQuery('service-area')).toBe('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA');
    expect(bookingGateAuditQuery('customer-distance')).toBe('CUSTOMER_CURRENT_LOCATION_TOO_FAR');
    expect(bookingGateAuditQuery('first-pick-distance')).toBe('PREFERRED_PARTNER_TOO_FAR');
    expect(bookingGateAuditQuery('customer-gps')).toBe('CUSTOMER_CURRENT_LOCATION');
    expect(bookingGateAuditQuery('unknown')).toBe('booking.create.rejected UNKNOWN');
  });

  it('builds triage cards without the all filter option', () => {
    const triage = buildBookingGateTriage(
      [auditLog('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA'), auditLog('CUSTOMER_CURRENT_LOCATION_STALE')],
      'service-area',
      (log) => `age:${log.id}`,
    );

    expect(triage).toHaveLength(bookingGateFilterOptions.length - 1);
    expect(triage.find((item) => item.filter === 'all')).toBeUndefined();
    expect(triage.find((item) => item.filter === 'service-area')).toMatchObject({
      count: 1,
      latestAge: 'age:BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      status: 'Selected',
      tone: 'warn',
      auditHref: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
    });
    expect(triage.find((item) => item.filter === 'first-pick-distance')).toMatchObject({
      count: 0,
      latestAge: 'none',
      status: 'Clear',
      tone: 'ok',
    });
  });

  it('keeps gate filter hints operator-facing', () => {
    const optionalGps = bookingGateFilterOptions.find((option) => option.value === 'customer-gps');
    const unknownGate = bookingGateFilterOptions.find((option) => option.value === 'unknown');

    expect(optionalGps?.operatorHint).toContain('confirmed service address');
    expect(optionalGps?.operatorHint).not.toContain('address snapshot');
    expect(unknownGate?.operatorHint).toContain('Open the audit row');
    expect(unknownGate?.operatorHint).not.toContain('raw audit entry');
  });
});
