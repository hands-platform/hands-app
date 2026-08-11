import type {
  AdminMarketingAttributionQuality,
  AdminMarketingComparison,
  AdminMarketingDimensionKey,
  AdminMarketingDimensionRow,
  AdminMarketingOverviewRange,
  AdminMarketingPlatform,
  AdminMarketingSource,
  AdminMarketingStats,
} from '../../lib/admin-api';
import { vietnamDateKey } from '../../lib/date-range';

export type MarketingAnalyticsFilters = {
  range: AdminMarketingOverviewRange;
  source?: AdminMarketingSource | null;
  platform?: AdminMarketingPlatform | null;
  regionCode?: string | null;
  campaignId?: string | null;
};

export const MARKETING_ANALYTICS_DIMENSION_PAGE_SIZE = 10;
export const MARKETING_ANALYTICS_COUPON_PAGE_SIZE = 10;
export const MARKETING_ACTION_PRIORITY_LIMIT = 4;

export type MarketingActionPriority = {
  actionLabel: string;
  detail: string;
  href: string;
  key: string;
  scope: string;
  title: string;
  tone: 'danger' | 'warning';
  value: number;
  valueKind: 'count' | 'money' | 'multiplier' | 'percent';
};

export type MarketingSpendDraft = {
  campaignId: string;
  campaignName: string;
  currency: 'VND';
  platform: AdminMarketingPlatform;
  preview: boolean;
  regionCode: string;
  source: AdminMarketingSource;
  spendAmount: number | null;
  spendDate: string;
};

type MarketingActionPriorityInput = {
  attributionQuality: AdminMarketingAttributionQuality;
  campaignEfficiency: readonly AdminMarketingDimensionRow[];
  comparison: AdminMarketingComparison;
  filters: MarketingAnalyticsFilters;
  rangeLabel: string;
  totals: AdminMarketingStats;
};

const MARKETING_ACTION_THRESHOLDS = {
  attributionCoveragePercent: 80,
  cancellationRatePercent: 25,
  comparisonMinimumBaseline: 3,
  completedDeclinePercent: -25,
  feeBreakEvenRoas: 1,
  spendGrowthPercent: 25,
} as const;

export const marketingAnalyticsRangeOptions: Array<{ value: AdminMarketingOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
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
        : (filters.platform ?? 'android'),
    preview: firstParam(params?.spendPreview) === '1' && spendAmount !== null,
    regionCode: regionCode && regions.has(regionCode) ? regionCode : (filters.regionCode ?? 'all'),
    source:
      source && sources.has(source as AdminMarketingSource) && source !== 'all' && source !== 'unknown'
        ? (source as AdminMarketingSource)
        : filters.source && filters.source !== 'unknown'
          ? filters.source
          : 'google',
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
  const params = new URLSearchParams({ range: filters.range });
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

export function buildMarketingActionPriorities({
  attributionQuality,
  campaignEfficiency,
  comparison,
  filters,
  rangeLabel,
  totals,
}: MarketingActionPriorityInput): MarketingActionPriority[] {
  const actions: MarketingActionPriority[] = [];
  const campaignRows = [...campaignEfficiency]
    .filter((row) => row.adSpend > 0)
    .sort((left, right) => right.adSpend - left.adSpend);
  const campaignsWithoutCompletion = campaignRows.filter((row) => row.bookingCompleted === 0).slice(0, 2);

  for (const campaign of campaignsWithoutCompletion) {
    const campaignLabel = marketingCampaignLabel(campaign);
    actions.push({
      actionLabel: 'Review campaign',
      detail: `${campaignLabel} recorded spend but no completed first-booking customer in ${rangeLabel.toLowerCase()}.`,
      href: marketingCampaignEvidenceHref(filters, campaign),
      key: `campaign-no-completion:${campaign.key}`,
      scope: 'Spend risk',
      title: 'Spend with no completed customer',
      tone: 'danger',
      value: campaign.adSpend,
      valueKind: 'money',
    });
  }

  const belowBreakEvenCampaign = campaignRows
    .filter(
      (row) =>
        row.bookingCompleted > 0 &&
        row.conversionRates.platformFeeRoas !== null &&
        row.conversionRates.platformFeeRoas < MARKETING_ACTION_THRESHOLDS.feeBreakEvenRoas,
    )
    .sort(
      (left, right) =>
        (left.conversionRates.platformFeeRoas ?? 0) - (right.conversionRates.platformFeeRoas ?? 0),
    )[0];

  if (belowBreakEvenCampaign) {
    const feeRoas = belowBreakEvenCampaign.conversionRates.platformFeeRoas ?? 0;
    actions.push({
      actionLabel: 'Review efficiency',
      detail: `${marketingCampaignLabel(
        belowBreakEvenCampaign,
      )} recovered ${feeRoas.toFixed(2)}x of spend in platform fee revenue; 1.00x is break-even.`,
      href: marketingCampaignEvidenceHref(filters, belowBreakEvenCampaign),
      key: `campaign-below-break-even:${belowBreakEvenCampaign.key}`,
      scope: 'Below break-even',
      title: 'Campaign fee return needs review',
      tone: 'warning',
      value: feeRoas,
      valueKind: 'multiplier',
    });
  }

  if (
    totals.bookingCreated > 0 &&
    totals.conversionRates.cancellationRate >= MARKETING_ACTION_THRESHOLDS.cancellationRatePercent
  ) {
    actions.push({
      actionLabel: 'Review funnel evidence',
      detail: `${formatActionPercent(
        totals.conversionRates.cancellationRate,
      )} of first-booking attempts in this cohort were cancelled. Review the cohort before adding spend.`,
      href: `${marketingAnalyticsHref(filters)}#marketing-acquisition-funnel`,
      key: 'cohort-cancellation-rate',
      scope: 'Booking outcome',
      title: 'Cancellation rate needs review',
      tone: 'warning',
      value: totals.conversionRates.cancellationRate,
      valueKind: 'percent',
    });
  }

  const spendGrowth = comparison.adSpend.deltaPercent;
  if (
    campaignsWithoutCompletion.length === 0 &&
    comparison.adSpend.current > 0 &&
    spendGrowth !== null &&
    spendGrowth >= MARKETING_ACTION_THRESHOLDS.spendGrowthPercent &&
    comparison.bookingCompleted.delta <= 0
  ) {
    actions.push({
      actionLabel: 'Compare periods',
      detail: `Ad spend increased ${Math.round(
        spendGrowth,
      )}% while the completed new-customer cohort did not increase.`,
      href: `${marketingAnalyticsHref(filters)}#marketing-previous-period`,
      key: 'spend-growth-without-completion-growth',
      scope: 'Period risk',
      title: 'Spend rose without completion growth',
      tone: 'danger',
      value: comparison.adSpend.current,
      valueKind: 'money',
    });
  }

  const completionDeltaPercent = comparison.bookingCompleted.deltaPercent;
  if (
    comparison.bookingCompleted.previous >= MARKETING_ACTION_THRESHOLDS.comparisonMinimumBaseline &&
    completionDeltaPercent !== null &&
    completionDeltaPercent <= MARKETING_ACTION_THRESHOLDS.completedDeclinePercent
  ) {
    actions.push({
      actionLabel: 'Inspect trend',
      detail: `Completed new-customer cohorts declined ${Math.abs(
        Math.round(completionDeltaPercent),
      )}% against ${comparison.previousRangeLabel.toLowerCase()}.`,
      href: `${marketingAnalyticsHref(filters)}#marketing-acquisition-trend`,
      key: 'completed-cohort-decline',
      scope: 'Conversion decline',
      title: 'Completed acquisition declined',
      tone: 'warning',
      value: Math.abs(comparison.bookingCompleted.delta),
      valueKind: 'count',
    });
  }

  const signupTotal = attributionQuality.attributedSignups + attributionQuality.unknownSignups;
  if (
    signupTotal >= MARKETING_ACTION_THRESHOLDS.comparisonMinimumBaseline &&
    attributionQuality.signupCoverageRate < MARKETING_ACTION_THRESHOLDS.attributionCoveragePercent
  ) {
    actions.push({
      actionLabel: 'Review unknown source',
      detail: `${attributionQuality.unknownSignups} of ${signupTotal} new signups have no stored first-touch source.`,
      href: `${marketingAnalyticsHref({
        ...filters,
        campaignId: null,
        source: 'unknown',
      })}#marketing-attribution-quality`,
      key: 'signup-attribution-gap',
      scope: 'Tracking gap',
      title: 'Signup attribution is incomplete',
      tone: 'warning',
      value: attributionQuality.signupCoverageRate,
      valueKind: 'percent',
    });
  } else {
    const firstOpenTotal = attributionQuality.attributedFirstOpens + attributionQuality.unknownFirstOpens;
    if (
      firstOpenTotal >= MARKETING_ACTION_THRESHOLDS.comparisonMinimumBaseline &&
      attributionQuality.firstOpenCoverageRate < MARKETING_ACTION_THRESHOLDS.attributionCoveragePercent
    ) {
      actions.push({
        actionLabel: 'Review unknown source',
        detail: `${attributionQuality.unknownFirstOpens} of ${firstOpenTotal} tracked entrants have no stored first-touch source.`,
        href: `${marketingAnalyticsHref({
          ...filters,
          campaignId: null,
          source: 'unknown',
        })}#marketing-attribution-quality`,
        key: 'entry-attribution-gap',
        scope: 'Tracking gap',
        title: 'Entry attribution is incomplete',
        tone: 'warning',
        value: attributionQuality.firstOpenCoverageRate,
        valueKind: 'percent',
      });
    }
  }

  return actions.slice(0, MARKETING_ACTION_PRIORITY_LIMIT);
}

export function hasMarketingDecisionEvidence(totals: AdminMarketingStats) {
  return totals.firstOpens > 0 || totals.signups > 0 || totals.adSpend > 0;
}

function marketingAnalyticsApiPathFor(basePath: string, filters: MarketingAnalyticsFilters) {
  const params = marketingAnalyticsSearchParams(filters);
  return `${basePath}?${params.toString()}`;
}

function marketingCampaignEvidenceHref(
  filters: MarketingAnalyticsFilters,
  campaign: AdminMarketingDimensionRow,
) {
  return `${marketingAnalyticsHref({
    ...filters,
    campaignId: campaign.campaignId ?? filters.campaignId,
  })}#marketing-campaign-efficiency`;
}

function marketingCampaignLabel(campaign: AdminMarketingDimensionRow) {
  return campaign.campaignName ?? campaign.campaignId ?? 'Unknown campaign';
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

function formatActionPercent(value: number) {
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;
}
