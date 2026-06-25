import type {
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
  const params = new URLSearchParams();
  const filters = { range: '7d', ...next } satisfies MarketingAnalyticsFilters;

  params.set('range', filters.range);
  if (filters.source) params.set('source', filters.source);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.regionCode) params.set('regionCode', filters.regionCode);
  if (filters.campaignId) params.set('campaignId', filters.campaignId);

  return `/marketing-analytics?${params.toString()}`;
}

export function marketingAnalyticsApiPath(filters: MarketingAnalyticsFilters) {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.source) params.set('source', filters.source);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.regionCode) params.set('regionCode', filters.regionCode);
  if (filters.campaignId) params.set('campaignId', filters.campaignId);

  return `/admin/marketing/overview?${params.toString()}`;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
