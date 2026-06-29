import type {
  AdminMarketingDimensionKey,
  AdminMarketingOverviewRange,
  AdminMarketingPlatform,
  AdminMarketingSource,
} from '../../lib/admin-api';

export type MarketingAnalyticsFilters = {
  range: AdminMarketingOverviewRange;
  source?: AdminMarketingSource | null;
  platform?: AdminMarketingPlatform | null;
  regionCode?: string | null;
  campaignId?: string | null;
};

export const MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE = 10;

export const marketingAnalyticsRangeOptions: Array<{ value: AdminMarketingOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export const marketingAnalyticsSourceOptions: Array<{ value: AdminMarketingSource | 'all'; label: string }> = [
  { value: 'all', label: 'All sources' },
  { value: 'referral', label: 'Referral' },
  { value: 'unknown', label: 'Unknown' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'organic', label: 'Organic' },
  { value: 'direct', label: 'Direct' },
];

export const marketingAnalyticsPlatformOptions: Array<{ value: AdminMarketingPlatform | 'all'; label: string }> = [
  { value: 'all', label: 'All platforms' },
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iOS' },
  { value: 'web', label: 'Web' },
  { value: 'unknown', label: 'Unknown' },
];

export const marketingAnalyticsRegionOptions = [
  { value: 'all', label: 'All regions' },
  { value: 'hanoi', label: 'Ha Noi' },
  { value: 'hcm', label: 'Ho Chi Minh City' },
  { value: 'da-nang', label: 'Da Nang' },
  { value: 'vung-tau', label: 'Vung Tau' },
  { value: 'nha-trang', label: 'Nha Trang' },
  { value: 'da-lat', label: 'Da Lat' },
  { value: 'can-tho', label: 'Can Tho' },
  { value: 'other-vietnam', label: 'Other Vietnam' },
];

const ranges = new Set(marketingAnalyticsRangeOptions.map((option) => option.value));
const sources = new Set(marketingAnalyticsSourceOptions.map((option) => option.value));
const platforms = new Set(marketingAnalyticsPlatformOptions.map((option) => option.value));
const regions = new Set(marketingAnalyticsRegionOptions.map((option) => option.value));

export function normalizeMarketingAnalyticsFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): MarketingAnalyticsFilters {
  const range = firstParam(params?.range);
  const source = firstParam(params?.source);
  const platform = firstParam(params?.platform);
  const regionCode = firstParam(params?.regionCode);
  const campaignId = firstParam(params?.campaignId);

  return {
    range: ranges.has(range as AdminMarketingOverviewRange) ? (range as AdminMarketingOverviewRange) : '7d',
    source:
      source && sources.has(source as AdminMarketingSource) && source !== 'all'
        ? (source as AdminMarketingSource)
        : null,
    platform:
      platform && platforms.has(platform as AdminMarketingPlatform) && platform !== 'all'
        ? (platform as AdminMarketingPlatform)
        : null,
    regionCode: regionCode && regions.has(regionCode) && regionCode !== 'all' ? regionCode : null,
    campaignId: campaignId?.trim() || null,
  };
}

export function marketingAnalyticsHref(next: Partial<MarketingAnalyticsFilters>) {
  const filters = { range: '7d', ...next } satisfies MarketingAnalyticsFilters;
  const params = marketingAnalyticsSearchParams(filters);

  return `/marketing-analytics?${params.toString()}`;
}

export function marketingAnalyticsApiPath(filters: MarketingAnalyticsFilters) {
  return marketingAnalyticsApiPathFor('/admin/marketing/overview', filters);
}

export function marketingAnalyticsSummaryApiPath(filters: MarketingAnalyticsFilters) {
  return marketingAnalyticsApiPathFor('/admin/marketing/summary', filters);
}

export function marketingAnalyticsDimensionApiPath(
  filters: MarketingAnalyticsFilters,
  dimension: AdminMarketingDimensionKey,
  paging: { take: number; skip: number },
) {
  const path = marketingAnalyticsApiPathFor(`/admin/marketing/dimensions/${dimension}`, filters);

  return `${path}&take=${paging.take}&skip=${paging.skip}`;
}

export function marketingAnalyticsDimensionPaging(
  params: Record<string, string | string[] | undefined> | undefined,
  dimension: AdminMarketingDimensionKey,
  pageSize = MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE,
) {
  const page = readPositivePage(firstParam(params?.[marketingAnalyticsDimensionPageParam(dimension)]));

  return {
    page,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function marketingAnalyticsDimensionPageHref(
  filters: MarketingAnalyticsFilters,
  dimension: AdminMarketingDimensionKey,
  page: number,
) {
  const params = marketingAnalyticsSearchParams(filters);
  const boundedPage = readPositivePage(String(page));
  params.set('breakdowns', '1');
  if (boundedPage > 1) {
    params.set(marketingAnalyticsDimensionPageParam(dimension), String(boundedPage));
  }

  return `/marketing-analytics?${params.toString()}`;
}

function marketingAnalyticsApiPathFor(basePath: string, filters: MarketingAnalyticsFilters) {
  const params = marketingAnalyticsSearchParams(filters);
  return `${basePath}?${params.toString()}`;
}

function marketingAnalyticsSearchParams(filters: MarketingAnalyticsFilters) {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.source) params.set('source', filters.source);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.regionCode) params.set('regionCode', filters.regionCode);
  if (filters.campaignId) params.set('campaignId', filters.campaignId);

  return params;
}

function marketingAnalyticsDimensionPageParam(dimension: AdminMarketingDimensionKey) {
  return `${dimension}Page`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readPositivePage(value: string | undefined) {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}
