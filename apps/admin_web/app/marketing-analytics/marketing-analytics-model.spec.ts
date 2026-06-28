import {
  marketingAnalyticsApiPath,
  marketingAnalyticsDimensionApiPath,
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
});
