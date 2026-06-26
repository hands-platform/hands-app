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
  const todayStart = startOfUtcDay(now);

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
  const cpaBookingCompleted = costPer(stats.adSpend, stats.bookingCompleted);

  return {
    ...stats,
    conversionRates: {
      signupRate: percent(stats.signups, stats.firstOpens),
      addressSaveRate: percent(stats.addressSaves, stats.signups),
      bookingCreateRate: percent(stats.bookingCreated, stats.addressSaves),
      bookingCompleteRate: percent(stats.bookingCompleted, stats.bookingCreated),
      cancellationRate: percent(stats.bookingCancelled, stats.bookingCreated),
      firstBookingRate: percent(stats.firstBookingCompleted, stats.signups),
      repeatBookingRate: percent(stats.repeatBookingCompleted, stats.bookingCompleted),
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
  const steps: AdminMarketingFunnelStep[] = [
    { key: 'app_first_open', label: 'App first open', value: stats.firstOpens, rateFromPrevious: null },
    {
      key: 'signup_completed',
      label: 'Signup completed',
      value: stats.signups,
      rateFromPrevious: percent(stats.signups, stats.firstOpens),
    },
    {
      key: 'address_saved',
      label: 'Address saved',
      value: stats.addressSaves,
      rateFromPrevious: percent(stats.addressSaves, stats.signups),
    },
    {
      key: 'booking_created',
      label: 'Booking created',
      value: stats.bookingCreated,
      rateFromPrevious: percent(stats.bookingCreated, stats.addressSaves),
    },
    {
      key: 'booking_completed',
      label: 'Booking completed',
      value: stats.bookingCompleted,
      rateFromPrevious: percent(stats.bookingCompleted, stats.bookingCreated),
    },
    {
      key: 'first_booking_completed',
      label: 'First booking completed',
      value: stats.firstBookingCompleted,
      rateFromPrevious: percent(stats.firstBookingCompleted, stats.bookingCompleted),
    },
    {
      key: 'repeat_booking_completed',
      label: 'Repeat booking completed',
      value: stats.repeatBookingCompleted,
      rateFromPrevious: percent(stats.repeatBookingCompleted, stats.bookingCompleted),
    },
  ];

  return steps;
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

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
