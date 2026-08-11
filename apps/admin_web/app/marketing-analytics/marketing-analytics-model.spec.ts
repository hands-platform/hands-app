import type {
  AdminMarketingComparison,
  AdminMarketingDimensionRow,
  AdminMarketingStats,
} from '../../lib/admin-api';
import {
  buildMarketingActionPriorities,
  hasMarketingDecisionEvidence,
  marketingAnalyticsApiPath,
  marketingAnalyticsCouponPageHref,
  marketingAnalyticsCouponPaging,
  marketingAnalyticsCouponPerformanceApiPath,
  marketingAnalyticsCouponPerformanceEnabled,
  marketingAnalyticsCouponSummaryApiPath,
  marketingAnalyticsDimensionApiPath,
  marketingAnalyticsDimensionPageHref,
  marketingAnalyticsDimensionPaging,
  marketingAnalyticsHref,
  marketingAnalyticsSummaryApiPath,
  marketingSpendDailyApiPath,
  marketingSpendPanelHref,
  normalizeMarketingSpendDraft,
  normalizeMarketingAnalyticsFilters,
} from './marketing-analytics-model';

describe('marketing analytics model', () => {
  it('keeps manual spend closed by default and normalizes one review draft', () => {
    const filters = normalizeMarketingAnalyticsFilters({
      campaignId: 'campaign-filter',
      platform: 'android',
      range: '30d',
      regionCode: 'hcm',
      source: 'google',
    });

    expect(normalizeMarketingSpendDraft({}, filters)).toBeNull();
    const draft = normalizeMarketingSpendDraft(
      {
        spend: 'add',
        spendAmount: '600000',
        spendCampaignId: 'launch-hcm',
        spendCampaignName: 'Launch HCMC',
        spendDate: '2026-06-20',
        spendPlatform: 'ios',
        spendPreview: '1',
        spendRegionCode: 'hcm',
        spendSource: 'google',
      },
      filters,
      new Date('2026-06-21T20:00:00.000Z'),
    );

    expect(draft).toEqual({
      campaignId: 'launch-hcm',
      campaignName: 'Launch HCMC',
      currency: 'VND',
      platform: 'ios',
      preview: true,
      regionCode: 'hcm',
      source: 'google',
      spendAmount: 600000,
      spendDate: '2026-06-20',
    });
    expect(marketingSpendPanelHref(filters, draft ?? undefined, true)).toContain(
      'spendPreview=1#marketing-spend-panel',
    );
    expect(marketingSpendDailyApiPath(draft!)).toBe(
      '/admin/marketing/spend-daily?campaignId=launch-hcm&platform=ios&regionCode=hcm&source=google&spendDate=2026-06-20',
    );
  });

  it('normalizes bounded range and optional dimension filters', () => {
    expect(normalizeMarketingAnalyticsFilters(undefined)).toEqual({
      range: '7d',
      source: null,
      platform: null,
      regionCode: null,
      campaignId: null,
    });

    expect(
      normalizeMarketingAnalyticsFilters({
        range: '30d',
        source: 'referral',
        platform: 'ios',
        regionCode: 'hcm',
        campaignId: 'ref-smoke',
      }),
    ).toEqual({
      range: '30d',
      source: 'referral',
      platform: 'ios',
      regionCode: 'hcm',
      campaignId: 'ref-smoke',
    });

    expect(
      normalizeMarketingAnalyticsFilters({
        range: 'all',
        source: 'bad',
        platform: 'bad',
        regionCode: 'bad',
      }),
    ).toMatchObject({
      range: '7d',
      source: null,
      platform: null,
      regionCode: null,
    });
  });

  it('builds stable Admin and API links without empty filters', () => {
    expect(marketingAnalyticsHref({ range: 'today' })).toBe('/marketing-analytics?range=today');
    expect(
      marketingAnalyticsHref({
        range: '7d',
        source: 'referral',
        platform: 'android',
        regionCode: 'hanoi',
        campaignId: 'ref-1',
      }),
    ).toBe(
      '/marketing-analytics?range=7d&source=referral&platform=android&regionCode=hanoi&campaignId=ref-1',
    );

    expect(
      marketingAnalyticsApiPath({
        range: '7d',
        source: 'referral',
        platform: null,
        regionCode: null,
        campaignId: null,
      }),
    ).toBe('/admin/marketing/overview?range=7d&source=referral');
    expect(
      marketingAnalyticsSummaryApiPath({
        range: '7d',
        source: 'referral',
        platform: 'android',
        regionCode: 'hcm',
        campaignId: null,
      }),
    ).toBe('/admin/marketing/summary?range=7d&source=referral&platform=android');
    expect(
      marketingAnalyticsDimensionApiPath(
        {
          range: '7d',
          source: 'referral',
          platform: null,
          regionCode: 'hcm',
          campaignId: null,
        },
        'source',
        { skip: 10, take: 10 },
      ),
    ).toBe('/admin/marketing/dimensions/source?range=7d&source=referral&take=10&skip=10');
    expect(
      marketingAnalyticsDimensionApiPath(
        {
          range: '7d',
          source: 'referral',
          platform: null,
          regionCode: 'hcm',
          campaignId: null,
        },
        'region',
        { skip: 0, take: 10 },
      ),
    ).toBe('/admin/marketing/dimensions/region?range=7d&source=referral&regionCode=hcm&take=10&skip=0');
  });

  it('builds bounded dimension paging params for server-backed breakdown tables', () => {
    expect(
      marketingAnalyticsDimensionPaging(
        {
          sourcePage: '3',
          regionPage: '0',
          campaignPage: 'bad',
        },
        'source',
      ),
    ).toEqual({ page: 3, skip: 20, take: 10 });

    expect(marketingAnalyticsDimensionPaging({ regionPage: '0' }, 'region')).toEqual({
      page: 1,
      skip: 0,
      take: 10,
    });
    expect(marketingAnalyticsDimensionPaging({ campaignPage: 'bad' }, 'campaign')).toEqual({
      page: 1,
      skip: 0,
      take: 10,
    });
  });

  it('keeps breakdown mode and filters when linking a dimension page', () => {
    expect(
      marketingAnalyticsDimensionPageHref(
        {
          range: '30d',
          source: 'google',
          platform: 'ios',
          regionCode: 'hcm',
          campaignId: 'summer-launch',
        },
        'campaign',
        4,
      ),
    ).toBe(
      '/marketing-analytics?range=30d&source=google&platform=ios&regionCode=hcm&campaignId=summer-launch&breakdowns=1&campaignPage=4',
    );

    expect(
      marketingAnalyticsDimensionPageHref(
        {
          range: '7d',
          source: null,
          platform: null,
          regionCode: null,
          campaignId: null,
        },
        'source',
        1,
      ),
    ).toBe('/marketing-analytics?range=7d&breakdowns=1');
  });

  it('keeps coupon summary lightweight and coupon rows server-paged by range', () => {
    const filters = {
      range: '30d' as const,
      source: 'google' as const,
      platform: 'android' as const,
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
    };

    expect(marketingAnalyticsCouponSummaryApiPath(filters)).toBe(
      '/admin/marketing/coupons/summary?range=30d',
    );
    expect(marketingAnalyticsCouponPerformanceApiPath(filters, { skip: 20, take: 10 })).toBe(
      '/admin/marketing/coupons?range=30d&take=10&skip=20',
    );
    expect(marketingAnalyticsCouponPerformanceEnabled({ couponPerformance: '1' })).toBe(true);
    expect(marketingAnalyticsCouponPerformanceEnabled({ couponPerformance: '0' })).toBe(false);
    expect(marketingAnalyticsCouponPaging({ couponPage: '3' })).toEqual({
      page: 3,
      skip: 20,
      take: 10,
    });
    expect(marketingAnalyticsCouponPageHref(filters, 3)).toBe(
      '/marketing-analytics?range=30d&couponPerformance=1&couponPage=3',
    );
  });

  it('prioritizes campaign spend, break-even, conversion decline, and attribution gaps', () => {
    const actions = buildMarketingActionPriorities({
      attributionQuality: {
        attributedFirstOpens: 12,
        unknownFirstOpens: 3,
        firstOpenCoverageRate: 80,
        attributedSignups: 4,
        unknownSignups: 2,
        signupCoverageRate: 66.67,
      },
      campaignEfficiency: [
        marketingDimensionRow({
          adSpend: 500_000,
          bookingCompleted: 0,
          campaignId: 'no-completion',
          campaignName: 'No Completion',
          key: 'no-completion',
        }),
        marketingDimensionRow({
          adSpend: 300_000,
          bookingCompleted: 2,
          campaignId: 'below-break-even',
          campaignName: 'Below Break Even',
          conversionRates: {
            ...marketingStats().conversionRates,
            cpaBookingCompleted: 150_000,
            platformFeeRoas: 0.6,
          },
          key: 'below-break-even',
        }),
      ],
      comparison: marketingComparison({
        bookingCompleted: { current: 2, previous: 4, delta: -2, deltaPercent: -50 },
      }),
      filters: {
        campaignId: null,
        platform: 'android',
        range: '7d',
        regionCode: 'hcm',
        source: 'google',
      },
      rangeLabel: 'Last 7 days',
      totals: marketingStats(),
    });

    expect(actions.map((action) => action.key)).toEqual([
      'campaign-no-completion:no-completion',
      'campaign-below-break-even:below-break-even',
      'completed-cohort-decline',
      'signup-attribution-gap',
    ]);
    expect(actions[0]).toMatchObject({
      href: '/marketing-analytics?range=7d&source=google&platform=android&regionCode=hcm&campaignId=no-completion#marketing-campaign-efficiency',
      tone: 'danger',
      value: 500_000,
      valueKind: 'money',
    });
    expect(actions[1]?.detail).toContain('1.00x is break-even');
    expect(actions[1]).toMatchObject({ value: 0.6, valueKind: 'multiplier' });
    expect(actions[2]?.href).toContain('#marketing-acquisition-trend');
    expect(actions[3]?.href).toContain('source=unknown');
  });

  it('flags spend growth without completion growth and keeps no-evidence state honest', () => {
    const actions = buildMarketingActionPriorities({
      attributionQuality: {
        attributedFirstOpens: 0,
        unknownFirstOpens: 0,
        firstOpenCoverageRate: 0,
        attributedSignups: 0,
        unknownSignups: 0,
        signupCoverageRate: 0,
      },
      campaignEfficiency: [],
      comparison: marketingComparison({
        adSpend: {
          current: 400_000,
          previous: 200_000,
          delta: 200_000,
          deltaPercent: 100,
        },
        bookingCompleted: { current: 1, previous: 1, delta: 0, deltaPercent: 0 },
      }),
      filters: {
        campaignId: null,
        platform: null,
        range: '7d',
        regionCode: null,
        source: null,
      },
      rangeLabel: 'Last 7 days',
      totals: marketingStats(),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      key: 'spend-growth-without-completion-growth',
      tone: 'danger',
      valueKind: 'money',
    });
    expect(hasMarketingDecisionEvidence(marketingStats())).toBe(false);
    expect(hasMarketingDecisionEvidence(marketingStats({ adSpend: 1 }))).toBe(true);
  });

  it('promotes a high cancellation rate to a direct funnel action', () => {
    const actions = buildMarketingActionPriorities({
      attributionQuality: {
        attributedFirstOpens: 10,
        unknownFirstOpens: 0,
        firstOpenCoverageRate: 100,
        attributedSignups: 5,
        unknownSignups: 0,
        signupCoverageRate: 100,
      },
      campaignEfficiency: [],
      comparison: marketingComparison(),
      filters: {
        campaignId: null,
        platform: null,
        range: '7d',
        regionCode: 'hcm',
        source: null,
      },
      rangeLabel: 'Last 7 days',
      totals: marketingStats({
        bookingCreated: 4,
        conversionRates: {
          ...marketingStats().conversionRates,
          cancellationRate: 25,
        },
      }),
    });

    expect(actions[0]).toMatchObject({
      href: '/marketing-analytics?range=7d&regionCode=hcm#marketing-acquisition-funnel',
      key: 'cohort-cancellation-rate',
      value: 25,
      valueKind: 'percent',
    });
  });
});

function marketingStats(overrides: Partial<AdminMarketingStats> = {}): AdminMarketingStats {
  return {
    adSpend: 0,
    addressSaves: 0,
    bookingCancelled: 0,
    bookingCompleted: 0,
    bookingCreated: 0,
    conversionRates: {
      addressSaveRate: 0,
      bookingCompleteRate: 0,
      bookingCreateRate: 0,
      cancellationRate: 0,
      cpa: null,
      cpaBookingCompleted: null,
      cpaBookingCreated: null,
      cpaSignup: null,
      cpi: null,
      firstBookingRate: 0,
      platformFeeRoas: null,
      repeatBookingRate: 0,
      roas: null,
      signupRate: 0,
    },
    firstBookingCompleted: 0,
    firstOpens: 0,
    grossBookingValue: 0,
    platformFeeRevenue: 0,
    refundAmount: 0,
    repeatBookingCompleted: 0,
    signups: 0,
    ...overrides,
  };
}

function marketingDimensionRow(overrides: Partial<AdminMarketingDimensionRow>): AdminMarketingDimensionRow {
  return {
    ...marketingStats(),
    key: 'campaign',
    ...overrides,
  };
}

function marketingComparison(overrides: Partial<AdminMarketingComparison> = {}): AdminMarketingComparison {
  const emptyMetric = { current: 0, previous: 0, delta: 0, deltaPercent: null };

  return {
    adSpend: emptyMetric,
    bookingCompleted: emptyMetric,
    firstOpens: emptyMetric,
    platformFeeRevenue: emptyMetric,
    previousRangeLabel: 'Previous 7 days',
    signups: emptyMetric,
    ...overrides,
  };
}
