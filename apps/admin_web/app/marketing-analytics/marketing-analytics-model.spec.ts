import {
  marketingAnalyticsApiPath,
  marketingAnalyticsDimensionApiPath,
  marketingAnalyticsDimensionPageHref,
  marketingAnalyticsDimensionPaging,
  marketingAnalyticsHref,
  marketingAnalyticsSummaryApiPath,
  normalizeMarketingAnalyticsFilters,
} from './marketing-analytics-model';

describe('marketing analytics model', () => {
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
    ).toBe('/marketing-analytics?range=7d&source=referral&platform=android&regionCode=hanoi&campaignId=ref-1');

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
        platform: null,
        regionCode: null,
        campaignId: null,
      }),
    ).toBe('/admin/marketing/summary?range=7d&source=referral');
    expect(
      marketingAnalyticsDimensionApiPath(
        {
          range: '7d',
          source: 'referral',
          platform: null,
          regionCode: null,
          campaignId: null,
        },
        'source',
        { skip: 10, take: 10 },
      ),
    ).toBe('/admin/marketing/dimensions/source?range=7d&source=referral&take=10&skip=10');
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
});
