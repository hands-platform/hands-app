import { backupProvidersWithinRadius, nearestBackupProviders } from './bookings.backup-providers';

describe('booking backup provider helpers', () => {
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
