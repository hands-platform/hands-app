import { haversineMeters, roundTo100Meters, safeDistanceMeters } from './matching.distance';

describe('matching distance helpers', () => {
  it('rounds partner distance to 100 meters for customer-facing marketplace data', () => {
    const distance = haversineMeters(10.7769, 106.7009, 10.7814, 106.7051);

    expect(roundTo100Meters(distance)).toBe(700);
  });

  it('returns rounded distances only when all coordinates are finite', () => {
    expect(safeDistanceMeters(10.7769, 106.7009, '10.7814', '106.7051')).toBe(700);
    expect(safeDistanceMeters(10.7769, 106.7009, 'not-a-coordinate', 106.7051)).toBeNull();
    expect(safeDistanceMeters(Number.NaN, 106.7009, 10.7814, 106.7051)).toBeNull();
  });
});
