import {
  isVietnamOverviewMapTilerTile,
  normalizeVietnamOverviewRange,
  type VietnamOverviewPointInput,
  vietnamOverviewMappedSignalScope,
  vietnamOverviewMapPoints,
  vietnamOverviewRangeOptions,
  vietnamOverviewRealtimeMapPoints,
  vietnamOverviewRealtimePointCounts,
  vietnamOverviewRealtimePointsApiHref,
} from './vietnam-overview-model';

describe('Vietnam overview page model', () => {
  it('offers the supported report ranges in operator order', () => {
    expect(vietnamOverviewRangeOptions.map((option) => option.value)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'all',
    ]);
    expect(normalizeVietnamOverviewRange('month')).toBe('today');
  });

  it('keeps the live point feed independent from period filters', () => {
    expect(vietnamOverviewRealtimePointsApiHref()).toBe(
      '/admin/vietnam-overview/realtime-points?take=50',
    );
  });

  it('projects only stored Vietnam coordinates and keeps unknown age unknown', () => {
    const points = vietnamOverviewMapPoints([
      pointFixture({ id: 'unknown-age', occurredAt: null }),
      pointFixture({ id: 'known-age', occurredAt: '2026-06-20T09:30:00.000Z' }),
      pointFixture({ id: 'outside-vietnam', latitude: 35.6895, longitude: 139.6917 }),
    ]);

    expect(points.map((point) => point.id)).toEqual(['known-age', 'unknown-age']);
    expect(points[1]?.occurredAt).toBeNull();
  });

  it('keeps live points to operational and explicitly separated Partner states', () => {
    const points = vietnamOverviewRealtimeMapPoints([
      pointFixture({ id: 'customer-saved-location', kind: 'customers' }),
      pointFixture({ id: 'customer-seen', kind: 'active' }),
      pointFixture({ id: 'legacy-partner', kind: 'partners' }),
      pointFixture({ id: 'ready-partner', kind: 'online' }),
      pointFixture({ id: 'busy-partner', kind: 'busy-partners' }),
      pointFixture({ id: 'stale-partner', kind: 'stale-partners' }),
      pointFixture({ id: 'offline-partner', kind: 'offline-partners' }),
      pointFixture({ id: 'needs-supply', kind: 'needs-supply' }),
      pointFixture({ id: 'assigned-booking', kind: 'assigned-bookings' }),
      pointFixture({ id: 'stale-booking', kind: 'stale-bookings' }),
      pointFixture({ id: 'legacy-booking', kind: 'bookings' as never }),
      pointFixture({ id: 'completed-booking', kind: 'done' }),
    ]);

    expect(points.map((point) => point.id)).toEqual([
      'customer-saved-location',
      'customer-seen',
      'ready-partner',
      'busy-partner',
      'stale-partner',
      'offline-partner',
      'needs-supply',
      'assigned-booking',
      'stale-booking',
    ]);
    expect(vietnamOverviewRealtimePointCounts(points)).toMatchObject({
      customers: 1,
      active: 1,
      online: 1,
      'busy-partners': 1,
      'stale-partners': 1,
      'offline-partners': 1,
      'needs-supply': 1,
      'assigned-bookings': 1,
      'stale-bookings': 1,
    });
  });

  it('describes mapped signal totals exactly only when every source total is known', () => {
    expect(vietnamOverviewMappedSignalScope()).toEqual({
      returned: 0,
      total: null,
      truncated: false,
      copy: 'Showing up to 0 recent mapped signals. This is not a complete regional total.',
    });

    expect(
      vietnamOverviewMappedSignalScope({
        sources: [
          { mappedPointCount: 4, total: 6, totalUnavailable: false, truncated: true },
          { mappedPointCount: 2, total: 2, totalUnavailable: false, truncated: false },
        ],
      }),
    ).toEqual({ returned: 6, total: 8, truncated: true, copy: 'Showing 6 of 8 mapped signals.' });

    expect(
      vietnamOverviewMappedSignalScope({
        sources: [{ mappedPointCount: 5, total: null, totalUnavailable: true, truncated: true }],
      }),
    ).toEqual({
      returned: 5,
      total: null,
      truncated: true,
      copy: 'Showing up to 5 recent mapped signals. This is not a complete regional total.',
    });
  });

  it('keeps the existing Vietnam-only tile proxy boundary', () => {
    expect(isVietnamOverviewMapTilerTile(5, 25, 14)).toBe(true);
    expect(isVietnamOverviewMapTilerTile(7, 99, 55)).toBe(false);
    expect(isVietnamOverviewMapTilerTile(4, 12, 7)).toBe(false);
    expect(isVietnamOverviewMapTilerTile(17, 3200, 1800)).toBe(false);
  });
});

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
    status: null,
    ...input,
  };
}
