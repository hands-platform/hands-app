import {
  backupProviderCandidateWhere,
  backupProviderCandidateStageWheres,
  backupProvidersWithinRadius,
  finalizeBackupProviderDispatchCandidates,
  nearestBackupProviders,
  resolveBackupProviderDispatchCandidates,
} from './bookings.backup-providers';
import { REQUIRED_BOOKING_DOCUMENT_TYPES } from './bookings.provider-readiness';

describe('booking backup provider helpers', () => {
  it('builds backup provider candidate filters with readiness and service gates', () => {
    const freshLocationAfter = new Date('2026-06-11T00:00:00.000Z');

    expect(
      backupProviderCandidateWhere({
        bookingId: 'booking-1',
        serviceId: 'service-1',
        preferredProviderId: 'first-pick',
        freshLocationAfter,
      }),
    ).toEqual({
      id: { not: 'first-pick' },
      status: { in: ['ONLINE_AVAILABLE', 'ONLINE_AVAILABLE_SOON'] },
      blockedAt: null,
      currentLat: { not: null },
      currentLng: { not: null },
      currentLocationUpdatedAt: { gte: freshLocationAfter },
      verification: { status: 'APPROVED' },
      kyc: { status: 'APPROVED' },
      AND: REQUIRED_BOOKING_DOCUMENT_TYPES.map((type) => ({
        documents: {
          some: {
            type,
            status: 'APPROVED',
            deletedAt: null,
          },
        },
      })),
      participants: {
        none: {
          bookingId: 'booking-1',
          status: 'REJECTED',
        },
      },
      OR: [
        { services: { none: {} } },
        {
          services: {
            some: {
              serviceId: 'service-1',
              active: true,
              service: { active: true },
            },
          },
        },
      ],
    });
  });

  it('keeps only providers with valid coordinates inside the backup radius', () => {
    expect(
      backupProvidersWithinRadius(
        [
          { id: 'nearby', currentLat: 10.777, currentLng: 106.701 },
          { id: 'far-away', currentLat: 10.9, currentLng: 106.9 },
          { id: 'missing-location', currentLat: null, currentLng: 106.701 },
        ],
        { lat: 10.7769, lng: 106.7009, radiusMeters: 1000 },
      ),
    ).toEqual([{ id: 'nearby', currentLat: 10.777, currentLng: 106.701, distanceMeters: 0 }]);
  });

  it('includes the exact radius boundary and excludes the next smaller radius', () => {
    const providers = [{ id: 'boundary', currentLat: 10.7869, currentLng: 106.7009 }];
    const measured = backupProvidersWithinRadius(providers, {
      lat: 10.7769,
      lng: 106.7009,
      radiusMeters: 10_000,
    });
    const boundaryMeters = measured[0]?.distanceMeters;

    expect(boundaryMeters).toBeTypeOf('number');
    expect(
      backupProvidersWithinRadius(providers, {
        lat: 10.7769,
        lng: 106.7009,
        radiusMeters: boundaryMeters!,
      }).map((provider) => provider.id),
    ).toEqual(['boundary']);
    expect(
      backupProvidersWithinRadius(providers, {
        lat: 10.7769,
        lng: 106.7009,
        radiusMeters: boundaryMeters! - 1,
      }),
    ).toEqual([]);
  });

  it('returns nearest providers without mutating the original order', () => {
    const providers = [
      { id: 'third', distanceMeters: 900 },
      { id: 'first', distanceMeters: 100 },
      { id: 'second', distanceMeters: 500 },
    ];

    expect(nearestBackupProviders(providers, 2)).toEqual([
      { id: 'first', distanceMeters: 100 },
      { id: 'second', distanceMeters: 500 },
    ]);
    expect(providers.map((provider) => provider.id)).toEqual(['third', 'first', 'second']);
  });

  it('keeps production and preview dispatch resolution on the same candidate helpers', () => {
    const providers = [
      {
        id: 'near-enabled',
        currentLat: 10.777,
        currentLng: 106.701,
        bookingAlertPreferences: { enabled: true },
      },
      {
        id: 'near-alert-disabled',
        currentLat: 10.778,
        currentLng: 106.702,
        bookingAlertPreferences: { enabled: false },
      },
      {
        id: 'far-enabled',
        currentLat: 10.9,
        currentLng: 106.9,
        bookingAlertPreferences: { enabled: true },
      },
    ];
    const resolved = resolveBackupProviderDispatchCandidates(providers, {
      customerGender: 'female',
      customerNationality: 'VN',
      lat: 10.7769,
      lng: 106.7009,
      radiusMeters: 2_000,
      serviceId: 'service-1',
    });
    const finalized = finalizeBackupProviderDispatchCandidates(
      resolved.matchingAlerts,
      [{ providerProfileId: 'not-present', _sum: { amount: -1 } }],
      5,
    );

    expect(resolved.withinRadius.map((provider) => provider.id)).toEqual([
      'near-enabled',
      'near-alert-disabled',
    ]);
    expect(resolved.matchingAlerts.map((provider) => provider.id)).toEqual(['near-enabled']);
    expect(finalized.invited.map((provider) => provider.id)).toEqual(['near-enabled']);
  });

  it('uses the final production where as the last preview funnel stage', () => {
    const input = {
      bookingId: 'booking-1',
      freshLocationAfter: new Date('2026-06-11T00:00:00.000Z'),
      preferredProviderId: 'first-pick',
      serviceId: 'service-1',
    };

    expect(backupProviderCandidateStageWheres(input).freshLocation).toEqual(
      backupProviderCandidateWhere(input),
    );
  });

  it('excludes negative wallet candidates only at the shared final invitation gate', () => {
    const providers = [
      { id: 'clear', distanceMeters: 100 },
      { id: 'negative', distanceMeters: 50 },
    ];

    const result = finalizeBackupProviderDispatchCandidates(
      providers,
      [{ providerProfileId: 'negative', _sum: { amount: -1 } }],
      5,
    );

    expect(result.finalGateReady.map((provider) => provider.id)).toEqual(['clear']);
    expect(result.invited.map((provider) => provider.id)).toEqual(['clear']);
  });
});
