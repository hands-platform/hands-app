import {
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
  marketingAnalyticsSpendLedgerApiPath,
  marketingAnalyticsSpendLedgerPageHref,
  marketingAnalyticsSpendLedgerPaging,
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
      view: 'overview',
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
      view: 'overview',
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
      view: 'overview',
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
        view: 'overview',
        range: '7d',
        source: 'referral',
        platform: null,
        regionCode: null,
        campaignId: null,
      }),
    ).toBe('/admin/marketing/overview?range=7d&source=referral');
    expect(
      marketingAnalyticsSummaryApiPath({
        view: 'attribution',
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
          view: 'attribution',
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
          view: 'campaigns',
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
          view: 'campaigns',
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
      '/marketing-analytics?range=30d&view=campaigns&source=google&platform=ios&regionCode=hcm&campaignId=summer-launch&breakdowns=1&campaignPage=4',
    );

    expect(
      marketingAnalyticsDimensionPageHref(
        {
          view: 'attribution',
          range: '7d',
          source: null,
          platform: null,
          regionCode: null,
          campaignId: null,
        },
        'source',
        1,
      ),
    ).toBe('/marketing-analytics?range=7d&view=attribution&breakdowns=1');
  });

  it('keeps coupon summary lightweight and coupon rows server-paged by range', () => {
    const filters = {
      view: 'coupons' as const,
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
      '/marketing-analytics?range=30d&view=coupons&couponPerformance=1&couponPage=3',
    );
  });

  it('keeps campaign workspace and filters while paging the spend ledger', () => {
    const filters = {
      campaignId: 'launch-hcm',
      platform: 'android' as const,
      range: '30d' as const,
      regionCode: 'hcm',
      source: 'google' as const,
      view: 'campaigns' as const,
    };

    expect(marketingAnalyticsSpendLedgerApiPath(filters, { skip: 25, take: 25 })).toBe(
      '/admin/marketing/spend-ledger?range=30d&source=google&platform=android&regionCode=hcm&campaignId=launch-hcm&take=25&skip=25',
    );
    expect(marketingAnalyticsSpendLedgerPaging({ spendPage: '2' })).toEqual({
      page: 2,
      skip: 25,
      take: 25,
    });
    expect(marketingAnalyticsSpendLedgerPageHref(filters, 2)).toBe(
      '/marketing-analytics?range=30d&view=campaigns&source=google&platform=android&regionCode=hcm&campaignId=launch-hcm&spendPage=2#marketing-spend-ledger',
    );
  });

  it('moves an opened spend editor into the campaigns workspace', () => {
    expect(normalizeMarketingAnalyticsFilters({ spend: 'add', view: 'overview' }).view).toBe('campaigns');
    expect(normalizeMarketingAnalyticsFilters({ view: 'attribution' }).view).toBe('attribution');
    expect(normalizeMarketingAnalyticsFilters({ view: 'invalid' }).view).toBe('overview');
  });
});
