import {
  backupProviderCandidateWhere,
  backupProvidersWithinRadius,
  nearestBackupProviders,
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
      bankAccounts: {
        some: {
          status: 'APPROVED',
          deletedAt: null,
        },
      },
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
});
