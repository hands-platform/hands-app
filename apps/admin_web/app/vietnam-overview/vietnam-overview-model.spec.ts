import {
  normalizeVietnamOverviewRange,
  type VietnamOverviewPointInput,
  vietnamOverviewMapMarkers,
  vietnamOverviewMapPoints,
  vietnamOverviewMetricPointCounts,
  vietnamOverviewRealtimeMapPoints,
  vietnamOverviewRealtimePointCounts,
  vietnamOverviewHref,
  vietnamOverviewRealtimePointsApiHref,
  vietnamOverviewMapTilerTileGrid,
  vietnamOverviewMapZoomLevels,
  vietnamOverviewRangeOptions,
  isVietnamOverviewMapTilerTile,
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

  it('keeps realtime map point feed independent from period range filters', () => {
    expect(vietnamOverviewRealtimePointsApiHref()).toBe(
      '/admin/vietnam-overview/realtime-points?take=50',
    );
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

  it('projects stored Vietnam event coordinates onto the map and drops out-of-country points', () => {
    const points = vietnamOverviewMapPoints([
      pointFixture({
        id: 'hcm-booking',
        kind: 'bookings',
        latitude: 10.7769,
        longitude: 106.7009,
        occurredAt: '2026-06-20T09:30:00.000Z',
      }),
      pointFixture({
        id: 'hanoi-done',
        kind: 'done',
        latitude: 21.0285,
        longitude: 105.8542,
        occurredAt: '2026-06-20T10:30:00.000Z',
      }),
      pointFixture({
        id: 'outside-vietnam',
        kind: 'cancel',
        latitude: 35.6895,
        longitude: 139.6917,
      }),
    ]);

    expect(points.map((point) => point.id)).toEqual(['hcm-booking', 'hanoi-done']);
    expect(points[0].mapYPercent).toBeGreaterThan(points[1].mapYPercent);
    expect(points[0].mapXPercent).toBeGreaterThan(points[1].mapXPercent);
    expect(vietnamOverviewMetricPointCounts(points)).toMatchObject({
      bookings: 1,
      done: 1,
      cancel: 0,
    });
  });

  it('keeps realtime map points limited to live operating signals', () => {
    const points = vietnamOverviewRealtimeMapPoints([
      pointFixture({ id: 'customer-saved-location', kind: 'customers' }),
      pointFixture({ id: 'active-customer', kind: 'active' }),
      pointFixture({ id: 'partner-profile-location', kind: 'partners' }),
      pointFixture({ id: 'online-partner', kind: 'online' }),
      pointFixture({ id: 'stale-partner', kind: 'stale-partners' }),
      pointFixture({ id: 'offline-partner', kind: 'offline-partners' }),
      pointFixture({ id: 'active-booking', kind: 'bookings' }),
      pointFixture({ id: 'completed-booking', kind: 'done' }),
      pointFixture({ id: 'cancelled-booking', kind: 'cancel' }),
    ]);

    expect(points.map((point) => point.id)).toEqual([
      'customer-saved-location',
      'active-customer',
      'online-partner',
      'stale-partner',
      'offline-partner',
      'active-booking',
    ]);
    expect(vietnamOverviewRealtimePointCounts(points)).toMatchObject({
      customers: 1,
      active: 1,
      online: 1,
      'stale-partners': 1,
      'offline-partners': 1,
      bookings: 1,
    });
  });

  it('builds a bounded MapTiler tile grid for the Vietnam overview map only', () => {
    const tileGrid = vietnamOverviewMapTilerTileGrid();

    expect(tileGrid.zoom).toBe(7);
    expect(tileGrid.style).toBe('streets-v2');
    expect(tileGrid.cols).toBe(4);
    expect(tileGrid.rows).toBe(7);
    expect(tileGrid.tiles).toHaveLength(28);
    expect(tileGrid.tiles[0].src).toBe('/api/admin/maptiler-tiles/7/100/55.png');
    expect(tileGrid.viewAspectRatio).toBeGreaterThan(0.49);
    expect(tileGrid.viewAspectRatio).toBeLessThan(0.5);
    expect(tileGrid.layerLeftPercent).toBeLessThan(0);
    expect(tileGrid.layerTopPercent).toBeLessThan(0);
    expect(tileGrid.layerWidthPercent).toBeGreaterThan(100);
    expect(tileGrid.layerHeightPercent).toBeGreaterThan(100);
    expect(tileGrid.tiles.every((tile) => isVietnamOverviewMapTilerTile(tile.z, tile.x, tile.y))).toBe(
      true,
    );
    expect(isVietnamOverviewMapTilerTile(5, 25, 14)).toBe(true);
    expect(isVietnamOverviewMapTilerTile(7, 99, 55)).toBe(false);
    expect(isVietnamOverviewMapTilerTile(4, 12, 7)).toBe(false);
    expect(isVietnamOverviewMapTilerTile(17, 3200, 1800)).toBe(false);
  });

  it('offers client-only map zoom steps without increasing tile requests', () => {
    expect(vietnamOverviewMapZoomLevels).toEqual([
      { label: '100%', scale: 1 },
      { label: '125%', scale: 1.25 },
      { label: '150%', scale: 1.5 },
      { label: '175%', scale: 1.75 },
      { label: '200%', scale: 2 },
    ]);
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

function pointFixture(input: Partial<VietnamOverviewPointInput> = {}): VietnamOverviewPointInput {
  return {
    id: 'point',
    kind: 'customers',
    label: 'Point',
    latitude: 10.7769,
    longitude: 106.7009,
    occurredAt: '2026-06-20T09:00:00.000Z',
    regionCode: 'hcm',
    source: 'test',
    addressText: 'Ho Chi Minh City',
    bookingId: null,
    customerProfileId: null,
    providerProfileId: null,
    ...input,
  };
}
