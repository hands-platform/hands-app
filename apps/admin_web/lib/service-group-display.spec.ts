import type { AdminServiceCatalogItem } from './admin-api';
import {
  formatDurationList,
  formatGroupPriceRange,
  missingStandardDurations,
  standardDurationCoverage,
} from './service-group-display';

describe('service group display', () => {
  it('formats durations in ascending order', () => {
    expect(
      formatDurationList([
        serviceFixture({ durationMin: 120 }),
        serviceFixture({ durationMin: 60 }),
        serviceFixture({ durationMin: 90 }),
      ]),
    ).toBe('60 min, 90 min, 120 min');
  });

  it('reports missing standard durations using active service options only', () => {
    expect(
      missingStandardDurations([
        serviceFixture({ active: true, durationMin: 60 }),
        serviceFixture({ active: false, durationMin: 90 }),
        serviceFixture({ active: true, durationMin: 120 }),
      ]),
    ).toEqual([90]);
  });

  it('builds standard duration coverage labels and tones', () => {
    expect(
      standardDurationCoverage([
        serviceFixture({ active: true, durationMin: 60 }),
        serviceFixture({ active: true, durationMin: 90 }),
        serviceFixture({ active: true, durationMin: 120 }),
      ]),
    ).toEqual({
      label: '60/90/120 ready',
      missingDurations: [],
      tone: 'pill-success',
    });
    expect(standardDurationCoverage([serviceFixture({ active: true, durationMin: 60 })])).toEqual({
      label: 'Missing 90/120',
      missingDurations: [90, 120],
      tone: 'pill-warn',
    });
  });

  it('formats active group price ranges and handles groups without active prices', () => {
    expect(
      formatGroupPriceRange([
        serviceFixture({ active: false, basePrice: 200000 }),
        serviceFixture({ active: true, basePrice: 300000 }),
        serviceFixture({ active: true, basePrice: 500000 }),
      ]),
    ).toBe('300.000 VND - 500.000 VND');
    expect(formatGroupPriceRange([serviceFixture({ active: false, basePrice: 200000 })])).toBe(
      'no active price',
    );
    expect(formatGroupPriceRange([serviceFixture({ active: true, basePrice: 400000 })])).toBe('400.000 VND');
  });
});

function serviceFixture({
  active = true,
  basePrice = 300000,
  durationMin = 60,
}: {
  readonly active?: boolean;
  readonly basePrice?: number;
  readonly durationMin?: number;
}): AdminServiceCatalogItem {
  return {
    active,
    basePrice,
    displayOrder: 0,
    durationMin,
    id: `service-${durationMin}-${basePrice}`,
    name: 'Foot massage',
    priceStep: 100000,
  };
}
