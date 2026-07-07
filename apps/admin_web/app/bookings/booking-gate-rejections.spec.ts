import type { AdminAuditLog } from '../../lib/admin-api';
import { bookingGateReasonCode, bookingGateRejectionInfo } from './booking-gate-rejections';

function auditLog(overrides: Partial<AdminAuditLog> = {}): AdminAuditLog {
  return {
    id: 'audit-1',
    action: 'booking.create.rejected',
    target: 'booking:create',
    createdAt: '2026-06-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('booking gate rejections', () => {
  it('reads reason codes from metadata aliases', () => {
    expect(bookingGateReasonCode(auditLog({ metadata: { reasonCode: 'PREFERRED_PARTNER_TOO_FAR' } }))).toBe(
      'PREFERRED_PARTNER_TOO_FAR',
    );
    expect(bookingGateReasonCode(auditLog({ metadata: { code: 'CUSTOMER_CURRENT_LOCATION_STALE' } }))).toBe(
      'CUSTOMER_CURRENT_LOCATION_STALE',
    );
    expect(bookingGateReasonCode(auditLog({ metadata: { reasonCode: '   ', code: null } }))).toBe('UNKNOWN');
  });

  it('builds service-area rejection evidence from the confirmed booking address', () => {
    const info = bookingGateRejectionInfo(
      auditLog({
        metadata: {
          reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
          bookingAddress: {
            addressText: 'Da Nang service address',
            lat: 16.0471,
            lng: 108.2062,
          },
          customerProfileId: 'customer-1',
        },
      }),
    );

    expect(info.reasonLabel).toBe('Address outside service area');
    expect(info.tone).toBe('warn');
    expect(info.operatorAction).toContain('Vietnam service area');
    expect(info.bookingAddressLabel).toBe('16.0471, 108.2062');
    expect(info.addressText).toBe('Da Nang service address');
    expect(info.customerHref).toBe('/customers/customer-1');
    expect(info.operatorAction).toContain('requested address');
    expect(info.operatorAction).not.toContain('address snapshot');
  });

  it('builds distance evidence labels from supported metadata aliases', () => {
    const info = bookingGateRejectionInfo(
      auditLog({
        target: 'customer:customer-from-target',
        metadata: {
          reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
          preferredPartnerDistanceMeters: '12500',
          preferredPartnerDistanceLimitMeters: 10000,
          customerDistanceMeters: 3000,
          customerDistanceLimitMeters: 20000,
        },
      }),
    );

    expect(info.preferredPartnerDistanceLabel).toBe('First-pick Partner: 12.5 km / limit 10 km');
    expect(info.customerDistanceLabel).toBe('Optional customer GPS: 3 km / limit 20 km');
    expect(info.customerHref).toBe('/customers/customer-from-target');
  });

  it('uses confirmed booking address wording for stale optional GPS timestamp follow-up', () => {
    const info = bookingGateRejectionInfo(
      auditLog({
        metadata: {
          reasonCode: 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING',
        },
      }),
    );

    expect(info.operatorAction).toContain('confirmed booking address');
    expect(info.operatorAction).not.toContain('address snapshot');
  });
});
