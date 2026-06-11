import { haversineMeters, roundTo100Meters } from './matching.distance';

describe('matching distance helpers', () => {
  it('rounds partner distance to 100 meters for customer-facing marketplace data', () => {
    const distance = haversineMeters(10.7769, 106.7009, 10.7814, 106.7051);

    expect(roundTo100Meters(distance)).toBe(700);
  });
});
