import {
  VIETNAM_REGION_BUCKETS,
  VietnamCoordinateInput,
  VietnamRegionCode,
  vietnamRegionCodeFromValues,
} from './admin-vietnam-region-overview';

export type AdminMarketingRange = 'today' | 'yesterday' | '7d' | '30d';
export type AdminMarketingPlatform = 'android' | 'ios' | 'web' | 'unknown';
export type AdminMarketingSource =
  | 'meta'
  | 'google'
  | 'tiktok'
  | 'organic'
  | 'referral'
  | 'direct'
  | 'unknown';

export type AdminMarketingWindow = {
  range: AdminMarketingRange;
  label: string;
  startAt: Date;
  endAt: Date;
};

export type AdminMarketingPreviousWindow = {
  label: string;
  startAt: Date;
  endAt: Date;
};

export type AdminMarketingFilters = {
  source?: AdminMarketingSource | null;
  platform?: AdminMarketingPlatform | null;
  regionCode?: VietnamRegionCode | null;
  campaignId?: string | null;
};

export type AdminMarketingStats = {
  firstOpens: number;
  signups: number;
  addressSaves: number;
  bookingCreated: number;
  bookingCompleted: number;
  bookingCancelled: number;
  firstBookingCompleted: number;
  repeatBookingCompleted: number;
  grossBookingValue: number;
  platformFeeRevenue: number;
  refundAmount: number;
  adSpend: number;
};

export type AdminMarketingRates = {
  signupRate: number;
  addressSaveRate: number;
  bookingCreateRate: number;
  bookingCompleteRate: number;
  cancellationRate: number;
  firstBookingRate: number;
  repeatBookingRate: number;
  cpi: number | null;
  cpa: number | null;
  cpaSignup: number | null;
  cpaBookingCreated: number | null;
  cpaBookingCompleted: number | null;
  roas: number | null;
  platformFeeRoas: number | null;
};

export type AdminMarketingStatsWithRates = AdminMarketingStats & {
  conversionRates: AdminMarketingRates;
};

export type AdminMarketingDimensionInput = {
  source?: AdminMarketingSource;
  platform?: AdminMarketingPlatform;
  regionCode?: VietnamRegionCode;
  regionName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
  stats: Partial<AdminMarketingStats>;
};

export type AdminMarketingDimensionRow = AdminMarketingStatsWithRates & {
  key: string;
  source?: AdminMarketingSource;
  platform?: AdminMarketingPlatform;
  regionCode?: VietnamRegionCode;
  regionName?: string;
  campaignId?: string | null;
  campaignName?: string | null;
};

export type AdminMarketingAttributionQuality = {
  attributedFirstOpens: number;
  unknownFirstOpens: number;
  firstOpenCoverageRate: number;
  attributedSignups: number;
  unknownSignups: number;
  signupCoverageRate: number;
};

export type AdminMarketingUnknownAttributionReason =
  | 'NO_CUSTOMER_SESSION'
  | 'NO_MARKETING_METADATA'
  | 'UNSUPPORTED_SOURCE';

export type AdminMarketingUnknownAttributionRow = {
  platform: AdminMarketingPlatform;
  appVersion: string | null;
  reason: AdminMarketingUnknownAttributionReason;
  signupCount: number;
};

export type AdminMarketingUnknownAttributionAccount = {
  customerUserId: string;
  customerProfileId: string;
  signupAt: string;
  platform: AdminMarketingPlatform;
  appVersion: string | null;
  reason: AdminMarketingUnknownAttributionReason;
};

export type AdminMarketingUnknownAttributionDiagnostics = {
  totalUnknownSignups: number;
  rows: AdminMarketingUnknownAttributionRow[];
  recentAccounts: AdminMarketingUnknownAttributionAccount[];
};

export type AdminMarketingComparisonMetric = {
  current: number;
  previous: number;
  delta: number;
  deltaPercent: number | null;
};

export type AdminMarketingComparison = {
  previousRangeLabel: string;
  firstOpens: AdminMarketingComparisonMetric;
  signups: AdminMarketingComparisonMetric;
  bookingCompleted: AdminMarketingComparisonMetric;
  adSpend: AdminMarketingComparisonMetric;
  platformFeeRevenue: AdminMarketingComparisonMetric;
};

export type AdminMarketingTrendPoint = {
  date: string;
  firstOpens: number;
  signups: number;
  bookingCreated: number;
  bookingCompleted: number;
  adSpend: number;
};

export type AdminMarketingRegionInput = {
  regionValues: readonly unknown[];
  coordinates?: VietnamCoordinateInput | null;
  stats: Partial<AdminMarketingStats>;
};

export type AdminMarketingFunnelStep = {
  key:
    | 'app_first_open'
    | 'signup_completed'
    | 'address_saved'
    | 'booking_created'
    | 'booking_completed'
    | 'first_booking_completed'
    | 'repeat_booking_completed';
  label: string;
  value: number;
  rateFromPrevious: number | null;
};

export type AdminMarketingCouponSummary = {
  appliedBookingCount: number;
  averageDiscountAmount: number;
  cancellationRate: number;
  cancelledBookingCount: number;
  completedBookingCount: number;
  completedBookingValue: number;
  completedConversionRate: number;
  realizedDiscountAmount: number;
  refundedBookingCount: number;
  refundRate: number;
};

const DEFAULT_MARKETING_RANGE: AdminMarketingRange = '7d';
const MARKETING_RANGE_LABELS: Record<AdminMarketingRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};
const SUPPORTED_MARKETING_RANGES = new Set<AdminMarketingRange>([
  'today',
  'yesterday',
  '7d',
  '30d',
]);
const SUPPORTED_MARKETING_PLATFORMS = new Set<AdminMarketingPlatform>([
  'android',
  'ios',
  'web',
  'unknown',
]);
const SUPPORTED_MARKETING_SOURCES = new Set<AdminMarketingSource>([
  'meta',
  'google',
  'tiktok',
  'organic',
  'referral',
  'direct',
  'unknown',
]);

export function normalizeAdminMarketingRange(value: unknown): AdminMarketingRange {
  if (typeof value !== 'string') {
    return DEFAULT_MARKETING_RANGE;
  }

  return SUPPORTED_MARKETING_RANGES.has(value as AdminMarketingRange)
    ? (value as AdminMarketingRange)
    : DEFAULT_MARKETING_RANGE;
}

export function adminMarketingRangeWindow(
  rangeInput: AdminMarketingRange,
  now = new Date(),
): AdminMarketingWindow {
  const range = normalizeAdminMarketingRange(rangeInput);
  const todayStart = startOfVietnamDay(now);

  if (range === 'today') {
    return {
      range,
      label: MARKETING_RANGE_LABELS[range],
      startAt: todayStart,
      endAt: addUtcDays(todayStart, 1),
    };
  }

  if (range === 'yesterday') {
    return {
      range,
      label: MARKETING_RANGE_LABELS[range],
      startAt: addUtcDays(todayStart, -1),
      endAt: todayStart,
    };
  }

  return {
    range,
    label: MARKETING_RANGE_LABELS[range],
    startAt: addUtcDays(todayStart, range === '7d' ? -6 : -29),
    endAt: addUtcDays(todayStart, 1),
  };
}

export function adminMarketingPreviousRangeWindow(
  window: AdminMarketingWindow,
  now = new Date(),
): AdminMarketingPreviousWindow {
  const windowDurationMs = Math.max(1, window.endAt.getTime() - window.startAt.getTime());
  const endAt = new Date(window.startAt);

  if (window.range === 'today') {
    const currentEndAt = new Date(
      Math.max(
        window.startAt.getTime(),
        Math.min(now.getTime(), window.endAt.getTime()),
      ),
    );
    const elapsedMs = Math.max(1, currentEndAt.getTime() - window.startAt.getTime());
    const startAt = addUtcDays(window.startAt, -1);

    return {
      label: 'Yesterday by now',
      startAt,
      endAt: new Date(startAt.getTime() + elapsedMs),
    };
  }

  return {
    label:
      window.range === 'yesterday'
        ? 'Previous day'
        : window.range === '7d'
          ? 'Previous 7 days'
          : 'Previous 30 days',
    startAt: new Date(endAt.getTime() - windowDurationMs),
    endAt,
  };
}

export function adminMarketingDateWhere(window: AdminMarketingWindow) {
  return {
    gte: window.startAt,
    lt: window.endAt,
  };
}

export function normalizeMarketingPlatform(value: unknown): AdminMarketingPlatform {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes('android')) return 'android';
  if (normalized.includes('ios') || normalized.includes('iphone') || normalized.includes('ipad')) return 'ios';
  if (normalized.includes('web')) return 'web';

  return SUPPORTED_MARKETING_PLATFORMS.has(normalized as AdminMarketingPlatform)
    ? (normalized as AdminMarketingPlatform)
    : 'unknown';
}

export function normalizeMarketingPlatformFilter(value: unknown): AdminMarketingPlatform | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeMarketingPlatform(value);
  return normalized === 'unknown' && value.trim().toLowerCase() !== 'unknown' ? null : normalized;
}

export function normalizeMarketingUnknownAttributionReason(
  value: unknown,
): AdminMarketingUnknownAttributionReason {
  if (value === 'NO_CUSTOMER_SESSION' || value === 'UNSUPPORTED_SOURCE') {
    return value;
  }

  return 'NO_MARKETING_METADATA';
}

export function normalizeMarketingSource(value: unknown): AdminMarketingSource {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'unknown';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.includes('facebook') || normalized.includes('instagram')) return 'meta';
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('refer')) return 'referral';
  if (normalized.includes('organic')) return 'organic';
  if (normalized.includes('direct')) return 'direct';

  return SUPPORTED_MARKETING_SOURCES.has(normalized as AdminMarketingSource)
    ? (normalized as AdminMarketingSource)
    : 'unknown';
}

export function normalizeMarketingSourceFilter(value: unknown): AdminMarketingSource | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeMarketingSource(value);
  return normalized === 'unknown' && value.trim().toLowerCase() !== 'unknown' ? null : normalized;
}

export function emptyMarketingStats(): AdminMarketingStats {
  return {
    firstOpens: 0,
    signups: 0,
    addressSaves: 0,
    bookingCreated: 0,
    bookingCompleted: 0,
    bookingCancelled: 0,
    firstBookingCompleted: 0,
    repeatBookingCompleted: 0,
    grossBookingValue: 0,
    platformFeeRevenue: 0,
    refundAmount: 0,
    adSpend: 0,
  };
}

export function addMarketingStats(
  left: AdminMarketingStats,
  right: Partial<AdminMarketingStats>,
): AdminMarketingStats {
  return {
    firstOpens: left.firstOpens + positiveNumber(right.firstOpens),
    signups: left.signups + positiveNumber(right.signups),
    addressSaves: left.addressSaves + positiveNumber(right.addressSaves),
    bookingCreated: left.bookingCreated + positiveNumber(right.bookingCreated),
    bookingCompleted: left.bookingCompleted + positiveNumber(right.bookingCompleted),
    bookingCancelled: left.bookingCancelled + positiveNumber(right.bookingCancelled),
    firstBookingCompleted: left.firstBookingCompleted + positiveNumber(right.firstBookingCompleted),
    repeatBookingCompleted: left.repeatBookingCompleted + positiveNumber(right.repeatBookingCompleted),
    grossBookingValue: left.grossBookingValue + positiveNumber(right.grossBookingValue),
    platformFeeRevenue: left.platformFeeRevenue + positiveNumber(right.platformFeeRevenue),
    refundAmount: left.refundAmount + positiveNumber(right.refundAmount),
    adSpend: left.adSpend + positiveNumber(right.adSpend),
  };
}

export function withMarketingRates(stats: AdminMarketingStats): AdminMarketingStatsWithRates {
  const cohort = normalizeMarketingFunnelCohort(stats);
  const cpaBookingCompleted = costPer(stats.adSpend, stats.bookingCompleted);

  return {
    ...stats,
    conversionRates: {
      signupRate: percent(cohort.signups, cohort.firstOpens),
      addressSaveRate: percent(cohort.addressSaves, cohort.signups),
      bookingCreateRate: percent(cohort.bookingCreated, cohort.addressSaves),
      bookingCompleteRate: percent(cohort.bookingCompleted, cohort.bookingCreated),
      cancellationRate: percent(cohort.bookingCancelled, cohort.bookingCreated),
      firstBookingRate: percent(cohort.firstBookingCompleted, cohort.signups),
      repeatBookingRate: percent(cohort.repeatBookingCompleted, cohort.bookingCompleted),
      cpi: costPer(stats.adSpend, stats.firstOpens),
      cpa: cpaBookingCompleted,
      cpaSignup: costPer(stats.adSpend, stats.signups),
      cpaBookingCreated: costPer(stats.adSpend, stats.bookingCreated),
      cpaBookingCompleted,
      roas: ratio(stats.grossBookingValue, stats.adSpend),
      platformFeeRoas: ratio(stats.platformFeeRevenue, stats.adSpend),
    },
  };
}

export function buildMarketingComparison(
  current: AdminMarketingStats,
  previous: AdminMarketingStats,
  previousRangeLabel: string,
): AdminMarketingComparison {
  return {
    previousRangeLabel,
    firstOpens: marketingComparisonMetric(
      current.firstOpens,
      previous.firstOpens,
    ),
    signups: marketingComparisonMetric(current.signups, previous.signups),
    bookingCompleted: marketingComparisonMetric(
      current.bookingCompleted,
      previous.bookingCompleted,
    ),
    adSpend: marketingComparisonMetric(current.adSpend, previous.adSpend),
    platformFeeRevenue: marketingComparisonMetric(
      current.platformFeeRevenue,
      previous.platformFeeRevenue,
    ),
  };
}

export function buildMarketingDimensionRows(
  inputs: readonly AdminMarketingDimensionInput[],
  filters: AdminMarketingFilters = {},
): AdminMarketingDimensionRow[] {
  const rows = new Map<string, AdminMarketingDimensionRow>();

  for (const input of inputs) {
    if (filters.source && input.source !== filters.source) continue;
    if (filters.platform && input.platform !== filters.platform) continue;
    if (filters.campaignId && input.campaignId !== filters.campaignId) continue;

    const key = [
      input.source ?? 'all',
      input.platform ?? 'all',
      input.regionCode ?? 'all',
      input.campaignId ?? 'all',
    ].join(':');
    const existing = rows.get(key);
    const base = existing ?? {
      key,
      source: input.source,
      platform: input.platform,
      regionCode: input.regionCode,
      regionName: input.regionName,
      campaignId: input.campaignId ?? null,
      campaignName: input.campaignName ?? null,
      ...withMarketingRates(emptyMarketingStats()),
    };
    const stats = addMarketingStats(base, input.stats);
    rows.set(key, {
      ...base,
      ...withMarketingRates(stats),
    });
  }

  return Array.from(rows.values()).sort(marketingRowSort);
}

export function buildMarketingAttributionQuality(
  inputs: readonly AdminMarketingDimensionInput[],
): AdminMarketingAttributionQuality {
  const totals = inputs.reduce(
    (result, input) => {
      const firstOpens = positiveNumber(input.stats.firstOpens);
      const signups = positiveNumber(input.stats.signups);

      result.totalFirstOpens += firstOpens;
      result.totalSignups += signups;
      if (input.source === 'unknown' || !input.source) {
        result.unknownFirstOpens += firstOpens;
        result.unknownSignups += signups;
      }

      return result;
    },
    {
      totalFirstOpens: 0,
      totalSignups: 0,
      unknownFirstOpens: 0,
      unknownSignups: 0,
    },
  );
  const attributedFirstOpens = Math.max(0, totals.totalFirstOpens - totals.unknownFirstOpens);
  const attributedSignups = Math.max(0, totals.totalSignups - totals.unknownSignups);

  return {
    attributedFirstOpens,
    unknownFirstOpens: totals.unknownFirstOpens,
    firstOpenCoverageRate: percent(attributedFirstOpens, totals.totalFirstOpens),
    attributedSignups,
    unknownSignups: totals.unknownSignups,
    signupCoverageRate: percent(attributedSignups, totals.totalSignups),
  };
}

export function buildMarketingCampaignEfficiency(
  attributionInputs: readonly AdminMarketingDimensionInput[],
  spendInputs: readonly AdminMarketingDimensionInput[],
  limit = 5,
): AdminMarketingDimensionRow[] {
  const campaigns = new Map<string, AdminMarketingDimensionRow>();

  for (const input of [...attributionInputs, ...spendInputs]) {
    const campaignId = input.campaignId?.trim();
    if (!campaignId) continue;

    const key = campaignId.toLowerCase();
    const current = campaigns.get(key);
    const source =
      current && current.source !== input.source
        ? undefined
        : (current?.source ?? input.source);
    const platform =
      current && current.platform !== input.platform
        ? undefined
        : (current?.platform ?? input.platform);
    const stats = addMarketingStats(current ?? emptyMarketingStats(), input.stats);

    campaigns.set(key, {
      key,
      campaignId: current?.campaignId ?? campaignId,
      campaignName: current?.campaignName ?? input.campaignName ?? campaignId,
      source,
      platform,
      ...withMarketingRates(stats),
    });
  }

  return Array.from(campaigns.values())
    .sort(marketingRowSort)
    .slice(0, Math.max(0, limit));
}

export function buildMarketingRegionRows(
  inputs: readonly AdminMarketingRegionInput[],
  filters: AdminMarketingFilters = {},
): AdminMarketingDimensionRow[] {
  const rows = new Map<VietnamRegionCode, AdminMarketingDimensionRow>(
    VIETNAM_REGION_BUCKETS.map((bucket) => [
      bucket.code,
      {
        key: bucket.code,
        regionCode: bucket.code,
        regionName: bucket.name,
        ...withMarketingRates(emptyMarketingStats()),
      },
    ]),
  );

  for (const input of inputs) {
    const regionCode = vietnamRegionCodeFromValues(input.regionValues, input.coordinates);
    if (filters.regionCode && regionCode !== filters.regionCode) continue;

    const current = rows.get(regionCode) ?? rows.get('other-vietnam');
    if (!current) continue;

    const stats = addMarketingStats(current, input.stats);
    rows.set(regionCode, {
      ...current,
      ...withMarketingRates(stats),
    });
  }

  return Array.from(rows.values()).filter((row) => !filters.regionCode || row.regionCode === filters.regionCode);
}

export function buildMarketingFunnel(stats: AdminMarketingStats): AdminMarketingFunnelStep[] {
  const cohort = normalizeMarketingFunnelCohort(stats);
  const steps: AdminMarketingFunnelStep[] = [
    {
      key: 'app_first_open',
      label: 'Tracked customer entry',
      value: cohort.firstOpens,
      rateFromPrevious: null,
    },
    {
      key: 'signup_completed',
      label: 'New customer signup',
      value: cohort.signups,
      rateFromPrevious: percent(cohort.signups, cohort.firstOpens),
    },
    {
      key: 'address_saved',
      label: 'Address ready',
      value: cohort.addressSaves,
      rateFromPrevious: percent(cohort.addressSaves, cohort.signups),
    },
    {
      key: 'booking_created',
      label: 'First booking created',
      value: cohort.bookingCreated,
      rateFromPrevious: percent(cohort.bookingCreated, cohort.addressSaves),
    },
    {
      key: 'booking_completed',
      label: 'First booking completed',
      value: cohort.bookingCompleted,
      rateFromPrevious: percent(cohort.bookingCompleted, cohort.bookingCreated),
    },
    {
      key: 'repeat_booking_completed',
      label: 'Repeat booking completed',
      value: cohort.repeatBookingCompleted,
      rateFromPrevious: percent(cohort.repeatBookingCompleted, cohort.bookingCompleted),
    },
  ];

  return steps;
}

export function normalizeMarketingFunnelCohort(
  stats: AdminMarketingStats,
): AdminMarketingStats {
  const firstOpens = positiveNumber(stats.firstOpens);
  const signups = Math.min(positiveNumber(stats.signups), firstOpens);
  const addressSaves = Math.min(positiveNumber(stats.addressSaves), signups);
  const bookingCreated = Math.min(positiveNumber(stats.bookingCreated), addressSaves);
  const bookingCompleted = Math.min(positiveNumber(stats.bookingCompleted), bookingCreated);

  return {
    ...stats,
    firstOpens,
    signups,
    addressSaves,
    bookingCreated,
    bookingCompleted,
    bookingCancelled: Math.min(positiveNumber(stats.bookingCancelled), bookingCreated),
    firstBookingCompleted: bookingCompleted,
    repeatBookingCompleted: Math.min(
      positiveNumber(stats.repeatBookingCompleted),
      bookingCompleted,
    ),
  };
}

export function withMarketingCouponRates(
  input: Omit<
    AdminMarketingCouponSummary,
    'averageDiscountAmount' | 'cancellationRate' | 'completedConversionRate' | 'refundRate'
  >,
): AdminMarketingCouponSummary {
  return {
    ...input,
    averageDiscountAmount:
      input.completedBookingCount > 0
        ? Math.round(input.realizedDiscountAmount / input.completedBookingCount)
        : 0,
    cancellationRate: percent(input.cancelledBookingCount, input.appliedBookingCount),
    completedConversionRate: percent(input.completedBookingCount, input.appliedBookingCount),
    refundRate: percent(input.refundedBookingCount, input.appliedBookingCount),
  };
}

export function buildMarketingInsights(stats: AdminMarketingStats, bySource: readonly AdminMarketingDimensionRow[]) {
  const insights: string[] = [];
  const bestSource = bySource
    .filter((row) => row.bookingCompleted > 0 || row.signups > 0)
    .sort(marketingRowSort)[0];

  if (bestSource?.source) {
    insights.push(
      `${sourceLabel(bestSource.source)} is the strongest tracked source in this range with ${bestSource.signups} signups and ${bestSource.bookingCompleted} completed bookings.`,
    );
  }

  if (stats.firstOpens > 0 && stats.signups === 0) {
    insights.push('First opens are present but no signup completion is attributed in this range.');
  }

  if (stats.bookingCreated > 0 && percent(stats.bookingCancelled, stats.bookingCreated) >= 25) {
    insights.push('Booking cancellation rate is above 25%; review source quality before adding spend.');
  }

  if (bySource.some((row) => row.source === 'unknown' && row.signups > 0)) {
    insights.push('Some signup and booking demand is still un-attributed; persist install/campaign attribution before paid scaling.');
  }

  return insights.slice(0, 4);
}

export function sourceLabel(source: AdminMarketingSource | undefined) {
  if (!source) return 'All sources';
  if (source === 'meta') return 'Meta';
  if (source === 'google') return 'Google';
  if (source === 'tiktok') return 'TikTok';
  if (source === 'organic') return 'Organic';
  if (source === 'referral') return 'Referral';
  if (source === 'direct') return 'Direct';
  return 'Unknown';
}

function marketingRowSort(left: AdminMarketingDimensionRow, right: AdminMarketingDimensionRow) {
  return (
    right.platformFeeRevenue - left.platformFeeRevenue ||
    right.bookingCompleted - left.bookingCompleted ||
    right.signups - left.signups ||
    left.key.localeCompare(right.key)
  );
}

function percent(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }

  return Math.round((numerator / denominator) * 10000) / 100;
}

function costPer(cost: number, count: number) {
  if (!Number.isFinite(cost) || !Number.isFinite(count) || cost <= 0 || count <= 0) {
    return null;
  }

  return Math.round(cost / count);
}

function ratio(value: number, cost: number) {
  if (!Number.isFinite(value) || !Number.isFinite(cost) || cost <= 0) {
    return null;
  }

  return Math.round((value / cost) * 100) / 100;
}

function positiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function marketingComparisonMetric(
  currentValue: number,
  previousValue: number,
): AdminMarketingComparisonMetric {
  const current = positiveNumber(currentValue);
  const previous = positiveNumber(previousValue);
  const delta = current - previous;

  return {
    current,
    previous,
    delta,
    deltaPercent:
      previous === 0
        ? null
        : Math.round((delta / previous) * 1000) / 10,
  };
}

function startOfVietnamDay(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(
    Date.UTC(
      numberPart('year'),
      numberPart('month') - 1,
      numberPart('day'),
      -7,
    ),
  );
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
