import type { AdminAuditLog, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import { buildBookingCreateGateReview } from './booking-create-gate-review';

describe('booking create gate review builder', () => {
  it('builds current gate rows, reason evidence, and sorted recent attempts', () => {
    const review = buildBookingCreateGateReview(
      [
        setting(OPERATIONAL_POLICY_KEYS.bookingDistanceGateEnabled, false),
        setting(OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired, true),
        setting(OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm, 25),
        setting(OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm, 50),
        setting(OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes, 10),
      ],
      [
        rejectedLog('older-service-area', '2026-06-13T03:00:00.000Z', {
          reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
          reason: 'Address outside enabled service area',
          bookingAddress: { addressText: 'District 1' },
        }),
        rejectedLog('new-partner-distance', '2026-06-13T04:00:00.000Z', {
          preferredProviderDistanceLimitMeters: 50000,
          preferredProviderDistanceMeters: 62000,
          reasonCode: 'PREFERRED_PARTNER_TOO_FAR',
          reason: 'Preferred Partner too far',
        }),
      ],
    );

    expect(review.currentPolicyLabel).toBe('Distance gates disabled');
    expect(review.summary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Optional customer GPS evidence', value: '25 km' }),
        expect.objectContaining({ label: 'Blocked attempts', value: '2' }),
      ]),
    );
    expect(review.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          current: 'Disabled',
          gate: 'Distance gate',
          pillClass: 'pill-danger',
        }),
        expect.objectContaining({
          evidence: '1 reject',
          gate: 'Service area',
        }),
      ]),
    );
    expect(review.recentAttempts[0]).toEqual(
      expect.objectContaining({
        detail: 'Preferred Partner too far. First-pick 62 km / limit 50 km',
        href: '/audit-log?query=PREFERRED_PARTNER_TOO_FAR',
        id: 'new-partner-distance',
        pillClass: 'pill-danger',
        reason: 'First-pick partner too far',
      }),
    );
  });

  it('counts optional current-location evidence reasons together', () => {
    const review = buildBookingCreateGateReview([], [
      rejectedLog('missing-gps', '2026-06-13T03:00:00.000Z', {
        reasonCode: 'CUSTOMER_CURRENT_LOCATION_MISSING',
      }),
      rejectedLog('stale-gps', '2026-06-13T04:00:00.000Z', {
        reasonCode: 'CUSTOMER_CURRENT_LOCATION_STALE',
      }),
    ]);

    expect(
      review.rows.find(
        (row) => row.key === OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes,
      ),
    ).toEqual(
      expect.objectContaining({
        current: '15 min',
        defaultValue: '15 min',
        evidence: '2 historical rows',
        pillClass: 'pill-success',
      }),
    );
    expect(review.recentAttempts[0]).toEqual(
      expect.objectContaining({
        reason: 'Optional stale customer GPS',
      }),
    );
  });
});

function setting(key: string, value: string | number | boolean): AdminOperationalPolicySetting {
  return {
    category: 'Booking',
    enforced: true,
    key,
    label: key,
    value,
  } as AdminOperationalPolicySetting;
}

function rejectedLog(
  id: string,
  createdAt: string,
  metadata: Record<string, unknown>,
): AdminAuditLog {
  return {
    action: 'booking.create.rejected',
    createdAt,
    id,
    metadata,
    target: 'booking:create',
  };
}
