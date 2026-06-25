import {
  adminMarketingDateWhere,
  adminMarketingRangeWindow,
  buildMarketingDimensionRows,
  buildMarketingFunnel,
  buildMarketingInsights,
  buildMarketingRegionRows,
  emptyMarketingStats,
  normalizeAdminMarketingRange,
  normalizeMarketingPlatform,
  normalizeMarketingSource,
  withMarketingRates,
} from './admin-marketing-analytics';

describe('admin marketing analytics helpers', () => {
  const now = new Date('2026-06-22T10:20:30.000Z');

  it('normalizes supported ranges and keeps marketing ranges bounded', () => {
    expect(normalizeAdminMarketingRange(undefined)).toBe('7d');
    expect(normalizeAdminMarketingRange('today')).toBe('today');
    expect(normalizeAdminMarketingRange('yesterday')).toBe('yesterday');
    expect(normalizeAdminMarketingRange('7d')).toBe('7d');
    expect(normalizeAdminMarketingRange('30d')).toBe('30d');
    expect(normalizeAdminMarketingRange('all')).toBe('7d');

    expect(adminMarketingRangeWindow('today', now)).toMatchObject({
      range: 'today',
      label: 'Today',
      startAt: new Date('2026-06-22T00:00:00.000Z'),
      endAt: new Date('2026-06-23T00:00:00.000Z'),
    });
    expect(adminMarketingRangeWindow('30d', now)).toMatchObject({
      range: '30d',
      label: 'Last 30 days',
      startAt: new Date('2026-05-24T00:00:00.000Z'),
      endAt: new Date('2026-06-23T00:00:00.000Z'),
    });
    expect(adminMarketingDateWhere(adminMarketingRangeWindow('yesterday', now))).toEqual({
      gte: new Date('2026-06-21T00:00:00.000Z'),
      lt: new Date('2026-06-22T00:00:00.000Z'),
    });
  });

  it('normalizes platform and source values without Android-only assumptions', () => {
    expect(normalizeMarketingPlatform('ANDROID')).toBe('android');
    expect(normalizeMarketingPlatform('ios-fcm')).toBe('ios');
    expect(normalizeMarketingPlatform('web')).toBe('web');
    expect(normalizeMarketingPlatform('random')).toBe('unknown');

    expect(normalizeMarketingSource('instagram-cpc')).toBe('meta');
    expect(normalizeMarketingSource('Google Ads')).toBe('google');
    expect(normalizeMarketingSource('referral_link')).toBe('referral');
    expect(normalizeMarketingSource('bad-channel')).toBe('unknown');
  });

  it('keeps conversion and cost metrics finite for empty data', () => {
    const stats = withMarketingRates(emptyMarketingStats());

    expect(stats.conversionRates.signupRate).toBe(0);
    expect(stats.conversionRates.cpi).toBeNull();
    expect(stats.conversionRates.cpa).toBeNull();
    expect(stats.conversionRates.roas).toBeNull();
  });

  it('aggregates source, campaign, and region rows without personal fields', () => {
    const bySource = buildMarketingDimensionRows([
      {
        source: 'unknown',
        platform: 'android',
        stats: { firstOpens: 10, signups: 3, bookingCompleted: 1, platformFeeRevenue: 100000 },
      },
      {
        source: 'referral',
        platform: 'ios',
        campaignId: 'ref-smoke',
        campaignName: 'Referral smoke',
        stats: { signups: 2, firstBookingCompleted: 1, platformFeeRevenue: 50000 },
      },
    ]);

    expect(bySource).toHaveLength(2);
    expect(bySource[0]).not.toHaveProperty('phone');
    expect(bySource.find((row) => row.source === 'unknown')).toMatchObject({
      firstOpens: 10,
      signups: 3,
      conversionRates: { signupRate: 30 },
    });

    const byRegion = buildMarketingRegionRows([
      {
        regionValues: ['Cầu Giấy, Hà Nội'],
        stats: { addressSaves: 1 },
      },
      {
        regionValues: ['22 Le Thanh Ton, District 1, Ho Chi Minh City'],
        coordinates: { latitude: 10.7769, longitude: 106.7009 },
        stats: { bookingCreated: 2 },
      },
    ]);

    expect(byRegion.find((row) => row.regionCode === 'hanoi')).toMatchObject({ addressSaves: 1 });
    expect(byRegion.find((row) => row.regionCode === 'hcm')).toMatchObject({ bookingCreated: 2 });
    expect(byRegion.find((row) => row.regionCode === 'hcm')).not.toHaveProperty('latitude');
  });

  it('builds funnel steps and operator insights from safe aggregate counts', () => {
    const stats = {
      ...emptyMarketingStats(),
      firstOpens: 20,
      signups: 10,
      addressSaves: 8,
      bookingCreated: 4,
      bookingCompleted: 2,
      firstBookingCompleted: 1,
    };
    const funnel = buildMarketingFunnel(stats);
    const insights = buildMarketingInsights(stats, [
      {
        key: 'unknown',
        source: 'unknown',
        ...withMarketingRates(stats),
      },
    ]);

    expect(funnel.map((step) => step.key)).toEqual([
      'app_first_open',
      'signup_completed',
      'address_saved',
      'booking_created',
      'booking_completed',
      'first_booking_completed',
      'repeat_booking_completed',
    ]);
    expect(funnel[1]).toMatchObject({ rateFromPrevious: 50 });
    expect(insights.some((insight) => insight.includes('un-attributed'))).toBe(true);
  });
});
