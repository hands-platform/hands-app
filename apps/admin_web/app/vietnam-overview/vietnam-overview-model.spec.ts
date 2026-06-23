import {
  normalizeVietnamOverviewRange,
  vietnamOverviewMapMarkers,
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

  it('builds ranked positioned map markers from stored region aggregates only', () => {
    const markers = vietnamOverviewMapMarkers([
      regionFixture({
        activeBookingCount: 1,
        completedBookingCount: 1,
        customerCount: 9,
        partnerCount: 7,
        regionCode: 'hanoi',
        regionName: 'Hà Nội',
        shortName: 'HAN',
      }),
      regionFixture({
        activeBookingCount: 6,
        activeCustomerCount: 12,
        cancellationCount: 3,
        completedBookingCount: 10,
        customerCount: 24,
        onlinePartnerCount: 5,
        partnerCount: 18,
        regionCode: 'hcm',
        regionName: 'Hồ Chí Minh',
        revenueAmount: 4500000,
        shortName: 'HCM',
      }),
    ]);

    expect(markers.map((marker) => marker.regionCode)).toEqual(['hcm', 'hanoi']);
    expect(markers[0]).toMatchObject({
      activeCustomerCount: 12,
      cancellationCount: 3,
      customerCount: 24,
      demandCount: 16,
      featured: true,
      intensity: 100,
      mapXPercent: 61,
      mapYPercent: 76,
      partnerSummary: '5 online / 18 Partners',
      revenueAmount: 4500000,
      tone: 'high',
    });
    expect(markers[0].metricDots.map((dot) => dot.key)).toEqual([
      'customers',
      'active',
      'partners',
      'online',
      'bookings',
      'done',
      'cancel',
    ]);
    expect(markers[0].metricDots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'customers', label: 'Customers', value: 24 }),
        expect.objectContaining({ key: 'active', label: 'Active', value: 12 }),
        expect.objectContaining({ key: 'partners', label: 'Partners', value: 18 }),
        expect.objectContaining({ key: 'online', label: 'Online', value: 5 }),
        expect.objectContaining({ key: 'bookings', label: 'Bookings', value: 6 }),
        expect.objectContaining({ key: 'done', label: 'Done', value: 10 }),
        expect.objectContaining({ key: 'cancel', label: 'Cancel', value: 3 }),
      ]),
    );
    expect(markers[0].metricDots[0].size).toBeGreaterThan(markers[0].metricDots[3].size);
    expect(markers[1]).toMatchObject({
      demandCount: 2,
      featured: false,
      mapXPercent: 54,
      mapYPercent: 20,
      tone: 'low',
    });
    expect(markers[1].intensity).toBeGreaterThanOrEqual(12);
    expect(markers[1].mapYPercent).toBeLessThan(markers[0].mapYPercent);
  });
});

function regionFixture(input: Partial<Parameters<typeof vietnamOverviewMapMarkers>[0][number]> = {}) {
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
