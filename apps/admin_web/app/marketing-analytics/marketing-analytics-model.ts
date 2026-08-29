import type {
  AdminMarketingDimensionKey,
  AdminMarketingOverviewRange,
  AdminMarketingPlatform,
  AdminMarketingSource,
} from '../../lib/admin-api';
import { vietnamDateKey } from '../../lib/date-range';

export type MarketingAnalyticsFilters = {
  view: MarketingAnalyticsView;
  range: AdminMarketingOverviewRange;
  source?: AdminMarketingSource | null;
  platform?: AdminMarketingPlatform | null;
  regionCode?: string | null;
  campaignId?: string | null;
};

export type MarketingAnalyticsView = 'overview' | 'campaigns' | 'attribution' | 'coupons';

export const MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE = 10;
export const MARKETING_ANALYTICS_COUPON_PAGE_SIZE = 10;
export const MARKETING_ANALYTICS_SPEND_LEDGER_PAGE_SIZE = 25;
export type MarketingSpendDraft = {
  campaignId: string;
  campaignName: string;
  currency: 'VND';
  platform: AdminMarketingPlatform | '';
  preview: boolean;
  regionCode: string;
  source: AdminMarketingSource | '';
  spendAmount: number | null;
  spendDate: string;
};

export const marketingAnalyticsRangeOptions: Array<{ value: AdminMarketingOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export const marketingAnalyticsViewOptions: Array<{ value: MarketingAnalyticsView; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'campaigns', label: 'Campaigns & spend' },
  { value: 'attribution', label: 'Attribution quality' },
  { value: 'coupons', label: 'Coupons' },
];

export const marketingAnalyticsSourceOptions: Array<{ value: AdminMarketingSource | 'all'; label: string }> =
  [
    { value: 'all', label: 'All sources' },
    { value: 'referral', label: 'Referral' },
    { value: 'unknown', label: 'Unknown' },
    { value: 'meta', label: 'Meta' },
    { value: 'google', label: 'Google' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'organic', label: 'Organic' },
    { value: 'direct', label: 'Direct' },
  ];

export const marketingAnalyticsPlatformOptions: Array<{
  value: AdminMarketingPlatform | 'all';
  label: string;
}> = [
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
const views = new Set(marketingAnalyticsViewOptions.map((option) => option.value));

export function normalizeMarketingAnalyticsFilters(
  params: Record<string, string | string[] | undefined> | undefined,
): MarketingAnalyticsFilters {
  const range = firstParam(params?.range);
  const source = firstParam(params?.source);
  const platform = firstParam(params?.platform);
  const regionCode = firstParam(params?.regionCode);
  const campaignId = firstParam(params?.campaignId);
  const requestedView = firstParam(params?.view);
  const view = firstParam(params?.spend) === 'add'
    ? 'campaigns'
    : views.has(requestedView as MarketingAnalyticsView)
      ? (requestedView as MarketingAnalyticsView)
      : 'overview';

  return {
    view,
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
  const filters = { range: '7d', view: 'overview', ...next } satisfies MarketingAnalyticsFilters;
  const params = marketingAnalyticsSearchParams(filters);

  return `/marketing-analytics?${params.toString()}`;
}

export function normalizeMarketingSpendDraft(
  params: Record<string, string | string[] | undefined> | undefined,
  filters: MarketingAnalyticsFilters,
  now = new Date(),
): MarketingSpendDraft | null {
  if (firstParam(params?.spend) !== 'add') return null;

  const source = firstParam(params?.spendSource);
  const platform = firstParam(params?.spendPlatform);
  const regionCode = firstParam(params?.spendRegionCode);
  const spendAmount = readNonNegativeInteger(firstParam(params?.spendAmount));

  return {
    campaignId: firstParam(params?.spendCampaignId)?.trim() || filters.campaignId || '',
    campaignName: firstParam(params?.spendCampaignName)?.trim() || '',
    currency: 'VND',
    platform:
      platform && platforms.has(platform as AdminMarketingPlatform) && platform !== 'all'
        ? (platform as AdminMarketingPlatform)
        : '',
    preview:
      firstParam(params?.spendPreview) === '1' &&
      spendAmount !== null &&
      Boolean(source) &&
      Boolean(platform),
    regionCode: regionCode && regions.has(regionCode) ? regionCode : (filters.regionCode ?? 'all'),
    source:
      source && sources.has(source as AdminMarketingSource) && source !== 'all'
        ? (source as AdminMarketingSource)
        : '',
    spendAmount,
    spendDate: validDateInput(firstParam(params?.spendDate)) ?? vietnamDateKey(now),
  };
}

export function marketingSpendPanelHref(
  filters: MarketingAnalyticsFilters,
  draft?: MarketingSpendDraft,
  preview = false,
) {
  const params = marketingAnalyticsSearchParams(filters);
  params.set('spend', 'add');
  if (draft) {
    params.set('spendDate', draft.spendDate);
    params.set('spendSource', draft.source);
    params.set('spendPlatform', draft.platform);
    params.set('spendRegionCode', draft.regionCode);
    if (draft.campaignId) params.set('spendCampaignId', draft.campaignId);
    if (draft.campaignName) params.set('spendCampaignName', draft.campaignName);
    if (draft.spendAmount !== null) params.set('spendAmount', String(draft.spendAmount));
  }
  if (preview) params.set('spendPreview', '1');
  return `/marketing-analytics?${params.toString()}#marketing-spend-panel`;
}

export function marketingSpendMissingDateHref(filters: MarketingAnalyticsFilters, spendDate: string) {
  const params = marketingAnalyticsSearchParams({ ...filters, view: 'campaigns' });
  params.set('spend', 'add');
  params.set('spendDate', spendDate);
  return `/marketing-analytics?${params.toString()}#marketing-spend-panel`;
}

export function marketingSpendDailyApiPath(draft: MarketingSpendDraft) {
  const params = new URLSearchParams({
    campaignId: draft.campaignId,
    platform: draft.platform,
    regionCode: draft.regionCode,
    source: draft.source,
    spendDate: draft.spendDate,
  });
  return `/admin/marketing/spend-daily?${params.toString()}`;
}

export function marketingAnalyticsApiPath(filters: MarketingAnalyticsFilters) {
  return marketingAnalyticsApiPathFor('/admin/marketing/overview', filters);
}

export function marketingAnalyticsSummaryApiPath(filters: MarketingAnalyticsFilters) {
  return marketingAnalyticsApiPathFor('/admin/marketing/summary', {
    ...filters,
    regionCode: null,
  });
}

export function marketingAnalyticsCouponSummaryApiPath(filters: MarketingAnalyticsFilters) {
  return `/admin/marketing/coupons/summary?range=${filters.range}`;
}

export function marketingAnalyticsCouponPerformanceApiPath(
  filters: MarketingAnalyticsFilters,
  paging: { take: number; skip: number },
) {
  return `/admin/marketing/coupons?range=${filters.range}&take=${paging.take}&skip=${paging.skip}`;
}

export function marketingAnalyticsCouponPerformanceEnabled(
  params: Record<string, string | string[] | undefined> | undefined,
) {
  return firstParam(params?.couponPerformance) === '1';
}

export function marketingAnalyticsCouponPaging(
  params: Record<string, string | string[] | undefined> | undefined,
  pageSize = MARKETING_ANALYTICS_COUPON_PAGE_SIZE,
) {
  const page = readPositivePage(firstParam(params?.couponPage));

  return {
    page,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function marketingAnalyticsCouponPageHref(filters: MarketingAnalyticsFilters, page = 1) {
  const params = new URLSearchParams({ range: filters.range, view: 'coupons' });
  const boundedPage = readPositivePage(String(page));
  params.set('couponPerformance', '1');
  if (boundedPage > 1) {
    params.set('couponPage', String(boundedPage));
  }

  return `/marketing-analytics?${params.toString()}`;
}

export function marketingAnalyticsDimensionApiPath(
  filters: MarketingAnalyticsFilters,
  dimension: AdminMarketingDimensionKey,
  paging: { take: number; skip: number },
) {
  const path = marketingAnalyticsApiPathFor(`/admin/marketing/dimensions/${dimension}`, {
    ...filters,
    regionCode: dimension === 'region' ? filters.regionCode : null,
  });

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

export function marketingAnalyticsSpendLedgerApiPath(
  filters: MarketingAnalyticsFilters,
  paging: { take: number; skip: number },
) {
  const path = marketingAnalyticsApiPathFor('/admin/marketing/spend-ledger', filters);
  return `${path}&take=${paging.take}&skip=${paging.skip}`;
}

export function marketingAnalyticsSpendLedgerPaging(
  params: Record<string, string | string[] | undefined> | undefined,
  pageSize = MARKETING_ANALYTICS_SPEND_LEDGER_PAGE_SIZE,
) {
  const page = readPositivePage(firstParam(params?.spendPage));
  return { page, skip: (page - 1) * pageSize, take: pageSize };
}

export function marketingAnalyticsSpendLedgerPageHref(filters: MarketingAnalyticsFilters, page: number) {
  const params = marketingAnalyticsSearchParams({ ...filters, view: 'campaigns' });
  const boundedPage = readPositivePage(String(page));
  if (boundedPage > 1) params.set('spendPage', String(boundedPage));
  return `/marketing-analytics?${params.toString()}#marketing-spend-ledger`;
}

function marketingAnalyticsApiPathFor(basePath: string, filters: MarketingAnalyticsFilters) {
  const params = marketingAnalyticsSearchParams(filters);
  params.delete('view');
  return `${basePath}?${params.toString()}`;
}

function marketingAnalyticsSearchParams(filters: MarketingAnalyticsFilters) {
  const params = new URLSearchParams();
  params.set('range', filters.range);
  if (filters.view !== 'overview') params.set('view', filters.view);
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

function readNonNegativeInteger(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function validDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
