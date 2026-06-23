import {
  normalizeVietnamOverviewRange,
  vietnamOverviewMapTiles,
  vietnamOverviewHref,
  vietnamOverviewRangeOptions,
} from './vietnam-overview-model';

describe('Vietnam overview page model', () => {
  it('offers bounded low-cost map ranges in operations-filter order', () => {
    expect(vietnamOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'all',
    ]);
  });

  it('defaults unknown ranges to today without adding GPS parameters', () => {
    expect(normalizeVietnamOverviewRange(undefined)).toBe('today');
    expect(normalizeVietnamOverviewRange('30d')).toBe('30d');
    expect(normalizeVietnamOverviewRange('month')).toBe('today');
    expect(vietnamOverviewHref('today')).toBe('/vietnam-overview?range=today');
    expect(vietnamOverviewHref('all')).toBe('/vietnam-overview?range=all');
  });

  it('builds ranked map tiles from stored region aggregates only', () => {
    const tiles = vietnamOverviewMapTiles([
      regionFixture({
        activeBookingCount: 1,
        completedBookingCount: 1,
        partnerCount: 7,
        regionCode: 'hanoi',
        regionName: 'Hà Nội',
        shortName: 'HAN',
      }),
      regionFixture({
        activeBookingCount: 6,
        completedBookingCount: 10,
        onlinePartnerCount: 5,
        partnerCount: 18,
        regionCode: 'hcm',
        regionName: 'Hồ Chí Minh',
        shortName: 'HCM',
      }),
    ]);

    expect(tiles.map((tile) => tile.regionCode)).toEqual(['hcm', 'hanoi']);
    expect(tiles[0]).toMatchObject({
      demandCount: 16,
      featured: true,
      intensity: 100,
      partnerSummary: '5 online / 18 Partners',
      tone: 'high',
    });
    expect(tiles[1]).toMatchObject({
      demandCount: 2,
      featured: false,
      tone: 'low',
    });
    expect(tiles[1].intensity).toBeGreaterThanOrEqual(12);
  });
});

function regionFixture(input: Partial<Parameters<typeof vietnamOverviewMapTiles>[0][number]> = {}) {
  return {
    activeBookingCount: 0,
    activeCustomerCount: 0,
    cancellationCount: 0,
    completedBookingCount: 0,
    currency: 'VND',
    customerCount: 0,
    onlinePartnerCount: 0,
    partnerCount: 0,
    regionCode: 'region',
    regionName: 'Region',
    revenueAmount: 0,
    shortName: 'RG',
    ...input,
  };
}
