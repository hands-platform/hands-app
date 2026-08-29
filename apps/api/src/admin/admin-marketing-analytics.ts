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
  firstOpenCoverageRate: number | null;
  attributedSignups: number;
  unknownSignups: number;
  signupCoverageRate: number | null;
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

export type AdminMarketingDecisionReadinessStatus =
  | 'INSUFFICIENT'
  | 'PARTIAL'
  | 'READY'
  | 'STALE';

export type AdminMarketingDecisionReadinessReason =
  | 'NO_ACQUISITION_EVIDENCE'
  | 'NO_SPEND_EVIDENCE'
  | 'INCOMPLETE_SPEND_DAYS'
  | 'LOW_ATTRIBUTION_COVERAGE'
  | 'UNMATCHED_CAMPAIGN_SPEND'
  | 'UNMATCHED_CAMPAIGN_OUTCOMES'
  | 'STALE_AGGREGATE';

export type AdminMarketingSpendCoverage = {
  trackingExpected: boolean;
  expectedDayCount: number;
  recordedDayCount: number;
  missingDates: string[];
  lastRecordedDate: string | null;
  latestUpdatedAt: string | null;
  totalSpendAmount: number | null;
  hasExplicitZeroRows: boolean;
  unmatchedCampaignRowCount: number;
  unmatchedOutcomeCampaignCount: number;
  duplicateCanonicalCampaignCount: number;
  matchedCampaignCount: number;
  campaignKeyCount: number;
  status: 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'STALE';
};

export type AdminMarketingDecisionReadiness = {
  status: AdminMarketingDecisionReadinessStatus;
  reasons: AdminMarketingDecisionReadinessReason[];
  attributionCoveragePercent: number | null;
  spendCoveragePercent: number | null;
  campaignJoinCoveragePercent: number | null;
  lastCompleteDate: string | null;
};

export type AdminMarketingActionItem = {
  actionLabel: string;
  campaignKey: string | null;
  detail: string;
  evidenceReadiness: AdminMarketingDecisionReadinessStatus;
  key: string;
  observedValue: number;
  observedValueKind: 'count' | 'money' | 'multiplier' | 'percent';
  scope: string;
  severity: 'danger' | 'warning';
  threshold: string;
  title: string;
};

export type AdminMarketingActionSummary = {
  totalCount: number;
  visibleCount: number;
  hiddenCount: number;
  items: AdminMarketingActionItem[];
  generatedAt: string;
  thresholdVersion: string;
};

export type AdminMarketingSpendCoverageInput = {
  window: Pick<AdminMarketingWindow, 'startAt' | 'endAt'>;
  recordedDates: readonly string[];
  latestUpdatedAt?: Date | string | null;
  totalSpendAmount?: number | null;
  hasExplicitZeroRows?: boolean;
  attributionCampaignIds?: readonly (string | null | undefined)[];
  spendCampaignIds?: readonly (string | null | undefined)[];
  duplicateCanonicalCampaignCount?: number;
  paidScopeExpected?: boolean;
  now?: Date;
};

const MARKETING_ACTION_THRESHOLDS = {
  attributionCoveragePercent: 80,
  cancellationMinimumBookings: 3,
  cancellationRatePercent: 25,
  comparisonMinimumBaseline: 3,
  completedDeclinePercent: -25,
  feeBreakEvenRoas: 1,
  spendGrowthPercent: 25,
  version: 'marketing-risk-v2',
} as const;

const MARKETING_ACTION_VISIBLE_LIMIT = 4;

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
const PAID_MARKETING_SOURCES = new Set<AdminMarketingSource>(['meta', 'google', 'tiktok']);

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
    if (
      filters.campaignId &&
      canonicalMarketingCampaignKey(input.campaignId) !== canonicalMarketingCampaignKey(filters.campaignId)
    ) {
      continue;
    }

    const campaignKey = canonicalMarketingCampaignKey(input.campaignId);

    const key = [
      input.source ?? 'all',
      input.platform ?? 'all',
      input.regionCode ?? 'all',
      campaignKey ?? 'all',
    ].join(':');
    const existing = rows.get(key);
    const base = existing ?? {
      key,
      source: input.source,
      platform: input.platform,
      regionCode: input.regionCode,
      regionName: input.regionName,
      campaignId: campaignKey,
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
    firstOpenCoverageRate:
      totals.totalFirstOpens > 0 ? percent(attributedFirstOpens, totals.totalFirstOpens) : null,
    attributedSignups,
    unknownSignups: totals.unknownSignups,
    signupCoverageRate: totals.totalSignups > 0 ? percent(attributedSignups, totals.totalSignups) : null,
  };
}

export function buildMarketingCampaignEfficiency(
  attributionInputs: readonly AdminMarketingDimensionInput[],
  spendInputs: readonly AdminMarketingDimensionInput[],
  limit: number | null = 5,
): AdminMarketingDimensionRow[] {
  const campaigns = new Map<string, AdminMarketingDimensionRow>();

  for (const input of [...attributionInputs, ...spendInputs]) {
    const campaignId = canonicalMarketingCampaignKey(input.campaignId);
    if (!campaignId) continue;

    const key = campaignId;
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

  const rows = Array.from(campaigns.values()).sort(marketingRowSort);
  return limit === null ? rows : rows.slice(0, Math.max(0, limit));
}

export function canonicalMarketingCampaignKey(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function marketingPaidScopeExpected(input: {
  attributionRows: readonly Pick<AdminMarketingDimensionInput, 'campaignId' | 'source'>[];
  campaignIdFilter?: string | null;
  sourceFilter?: AdminMarketingSource | null;
  spendRowCount: number;
}) {
  return (
    Boolean(canonicalMarketingCampaignKey(input.campaignIdFilter)) ||
    Boolean(input.sourceFilter && PAID_MARKETING_SOURCES.has(input.sourceFilter)) ||
    input.spendRowCount > 0 ||
    input.attributionRows.some(
      (row) =>
        Boolean(row.source && PAID_MARKETING_SOURCES.has(row.source)) ||
        Boolean(canonicalMarketingCampaignKey(row.campaignId)),
    )
  );
}

export function buildMarketingSpendCoverage({
  attributionCampaignIds = [],
  duplicateCanonicalCampaignCount = 0,
  hasExplicitZeroRows = false,
  latestUpdatedAt = null,
  now = new Date(),
  paidScopeExpected = true,
  recordedDates,
  spendCampaignIds = [],
  totalSpendAmount = null,
  window,
}: AdminMarketingSpendCoverageInput): AdminMarketingSpendCoverage {
  const expectedDates = paidScopeExpected ? marketingWindowDateKeys(window, now) : [];
  const recorded = new Set(recordedDates.filter((date) => /^\d{4}-\d{2}-\d{2}$/u.test(date)));
  const missingDates = expectedDates.filter((date) => !recorded.has(date));
  const recordedExpectedDates = expectedDates.filter((date) => recorded.has(date));
  const attributionKeys = new Set(
    attributionCampaignIds.map(canonicalMarketingCampaignKey).filter((value): value is string => Boolean(value)),
  );
  const spendKeys = new Set(
    spendCampaignIds.map(canonicalMarketingCampaignKey).filter((value): value is string => Boolean(value)),
  );
  const unmatchedCampaignRowCount = [...spendKeys].filter((key) => !attributionKeys.has(key)).length;
  const unmatchedOutcomeCampaignCount = [...attributionKeys].filter((key) => !spendKeys.has(key)).length;
  const campaignKeys = new Set([...attributionKeys, ...spendKeys]);
  const matchedCampaignCount = [...campaignKeys].filter(
    (key) => attributionKeys.has(key) && spendKeys.has(key),
  ).length;
  const lastRecordedDate = [...recorded].sort().at(-1) ?? null;
  const latestUpdatedAtValue = normalizeIsoDate(latestUpdatedAt);
  const stale =
    expectedDates.length > 1 &&
    recordedExpectedDates.length > 0 &&
    expectedDates.slice(-2).every((date) => !recorded.has(date));
  const status: AdminMarketingSpendCoverage['status'] =
    expectedDates.length === 0
      ? 'COMPLETE'
      : recordedExpectedDates.length === 0
        ? 'MISSING'
        : stale
          ? 'STALE'
          : missingDates.length > 0
            ? 'PARTIAL'
            : 'COMPLETE';

  return {
    trackingExpected: paidScopeExpected,
    expectedDayCount: expectedDates.length,
    recordedDayCount: recordedExpectedDates.length,
    missingDates,
    lastRecordedDate,
    latestUpdatedAt: latestUpdatedAtValue,
    totalSpendAmount,
    hasExplicitZeroRows,
    unmatchedCampaignRowCount,
    unmatchedOutcomeCampaignCount,
    duplicateCanonicalCampaignCount: Math.max(0, Math.trunc(duplicateCanonicalCampaignCount)),
    matchedCampaignCount,
    campaignKeyCount: campaignKeys.size,
    status,
  };
}

export function buildMarketingDecisionReadiness(input: {
  attributionQuality: AdminMarketingAttributionQuality;
  spendCoverage: AdminMarketingSpendCoverage;
  totals: AdminMarketingStats;
}): AdminMarketingDecisionReadiness {
  const { attributionQuality, spendCoverage, totals } = input;
  const reasons: AdminMarketingDecisionReadinessReason[] = [];
  const acquisitionEvidence =
    totals.firstOpens + totals.signups + totals.bookingCreated + totals.bookingCompleted + totals.bookingCancelled > 0;
  const outcomeEvidence = totals.bookingCreated + totals.bookingCompleted + totals.bookingCancelled > 0;
  const spendEvidence = spendCoverage.totalSpendAmount !== null;
  const spendRequired = spendCoverage.trackingExpected;
  const signupTotal = attributionQuality.attributedSignups + attributionQuality.unknownSignups;
  const attributionCoveragePercent = signupTotal > 0 ? attributionQuality.signupCoverageRate : null;

  if (!acquisitionEvidence) reasons.push('NO_ACQUISITION_EVIDENCE');
  if (spendRequired && !spendEvidence) reasons.push('NO_SPEND_EVIDENCE');
  if (spendRequired && (spendCoverage.status === 'PARTIAL' || spendCoverage.status === 'MISSING')) {
    reasons.push('INCOMPLETE_SPEND_DAYS');
  }
  if (spendCoverage.status === 'STALE') reasons.push('STALE_AGGREGATE');
  if (
    attributionCoveragePercent !== null &&
    attributionCoveragePercent < MARKETING_ACTION_THRESHOLDS.attributionCoveragePercent
  ) {
    reasons.push('LOW_ATTRIBUTION_COVERAGE');
  }
  if (spendCoverage.unmatchedCampaignRowCount > 0) reasons.push('UNMATCHED_CAMPAIGN_SPEND');
  if (spendCoverage.unmatchedOutcomeCampaignCount > 0) reasons.push('UNMATCHED_CAMPAIGN_OUTCOMES');

  const campaignJoinCoveragePercent =
    spendCoverage.campaignKeyCount > 0
      ? percent(spendCoverage.matchedCampaignCount, spendCoverage.campaignKeyCount)
      : null;
  const spendCoveragePercent =
    spendCoverage.expectedDayCount > 0
      ? percent(spendCoverage.recordedDayCount, spendCoverage.expectedDayCount)
      : null;
  const status: AdminMarketingDecisionReadinessStatus =
    spendCoverage.status === 'STALE'
      ? 'STALE'
      : !acquisitionEvidence || (spendRequired && !spendEvidence) || (spendEvidence && !outcomeEvidence)
        ? 'INSUFFICIENT'
        : reasons.length > 0
          ? 'PARTIAL'
          : 'READY';

  return {
    status,
    reasons: [...new Set(reasons)],
    attributionCoveragePercent,
    spendCoveragePercent,
    campaignJoinCoveragePercent,
    lastCompleteDate: lastCompleteMarketingDate(spendCoverage),
  };
}

export function buildMarketingActionSummary(input: {
  attributionQuality: AdminMarketingAttributionQuality;
  campaignEfficiency: readonly AdminMarketingDimensionRow[];
  comparison: AdminMarketingComparison;
  generatedAt?: Date | string;
  readiness: AdminMarketingDecisionReadiness;
  spendCoverage: AdminMarketingSpendCoverage;
  totals: AdminMarketingStatsWithRates;
  visibleLimit?: number;
}): AdminMarketingActionSummary {
  const actions: AdminMarketingActionItem[] = [];
  const campaignRows = [...input.campaignEfficiency]
    .filter((row) => row.adSpend > 0)
    .sort((left, right) => right.adSpend - left.adSpend);

  for (const campaign of campaignRows.filter((row) => row.bookingCompleted === 0)) {
    actions.push(marketingAction({
      actionLabel: 'Review campaign',
      campaignKey: canonicalMarketingCampaignKey(campaign.campaignId),
      detail: 'Recorded spend has no completed new customer in the selected cohort.',
      evidenceReadiness: input.readiness.status,
      key: `campaign-no-completion:${campaign.key}`,
      observedValue: campaign.adSpend,
      observedValueKind: 'money',
      scope: campaign.campaignName ?? campaign.campaignId ?? 'Unknown campaign',
      severity: 'danger',
      threshold: 'Spend > 0 VND and completed new customers = 0',
      title: 'Spend with no completed customer',
    }));
  }

  for (const campaign of campaignRows.filter(
    (row) =>
      row.bookingCompleted > 0 &&
      row.conversionRates.platformFeeRoas !== null &&
      row.conversionRates.platformFeeRoas < MARKETING_ACTION_THRESHOLDS.feeBreakEvenRoas,
  )) {
    actions.push(marketingAction({
      actionLabel: 'Review efficiency',
      campaignKey: canonicalMarketingCampaignKey(campaign.campaignId),
      detail: 'Platform fee revenue is below recorded spend. Verify evidence before changing budget.',
      evidenceReadiness: input.readiness.status,
      key: `campaign-below-break-even:${campaign.key}`,
      observedValue: campaign.conversionRates.platformFeeRoas ?? 0,
      observedValueKind: 'multiplier',
      scope: campaign.campaignName ?? campaign.campaignId ?? 'Unknown campaign',
      severity: 'warning',
      threshold: `Fee ROAS < ${MARKETING_ACTION_THRESHOLDS.feeBreakEvenRoas.toFixed(2)}x`,
      title: 'Campaign fee return needs review',
    }));
  }

  if (
    input.totals.bookingCreated >= MARKETING_ACTION_THRESHOLDS.cancellationMinimumBookings &&
    input.totals.conversionRates.cancellationRate >= MARKETING_ACTION_THRESHOLDS.cancellationRatePercent
  ) {
    actions.push(marketingAction({
      actionLabel: 'Review funnel evidence',
      campaignKey: null,
      detail: `${input.totals.bookingCancelled} cancelled of ${input.totals.bookingCreated} created bookings · Cancellation rate ${input.totals.conversionRates.cancellationRate}%`,
      evidenceReadiness: input.readiness.status,
      key: 'cohort-cancellation-rate',
      observedValue: input.totals.conversionRates.cancellationRate,
      observedValueKind: 'percent',
      scope: 'Selected cohort',
      severity: 'warning',
      threshold: `Created bookings >= ${MARKETING_ACTION_THRESHOLDS.cancellationMinimumBookings} and cancellation rate >= ${MARKETING_ACTION_THRESHOLDS.cancellationRatePercent}%`,
      title: 'Cancellation rate needs review',
    }));
  }

  if (input.spendCoverage.status !== 'COMPLETE') {
    actions.push(marketingAction({
      actionLabel: 'Review spend ledger',
      campaignKey: null,
      detail: `${input.spendCoverage.missingDates.length} ${input.spendCoverage.missingDates.length === 1 ? 'spend date is' : 'spend dates are'} missing from the ledger. Missing is not zero.`,
      evidenceReadiness: input.readiness.status,
      key: 'spend-coverage-gap',
      observedValue: input.spendCoverage.missingDates.length,
      observedValueKind: 'count',
      scope: 'Manual spend ledger',
      severity: input.spendCoverage.status === 'MISSING' || input.spendCoverage.status === 'STALE' ? 'danger' : 'warning',
      threshold: 'Every tracked paid-spend date has an explicit ledger row',
      title: 'Spend coverage is incomplete',
    }));
  }

  if (input.spendCoverage.unmatchedCampaignRowCount > 0) {
    actions.push(marketingAction({
      actionLabel: 'Match campaign evidence',
      campaignKey: null,
      detail: 'Spend campaign keys exist without matching attributed outcomes.',
      evidenceReadiness: input.readiness.status,
      key: 'unmatched-campaign-spend',
      observedValue: input.spendCoverage.unmatchedCampaignRowCount,
      observedValueKind: 'count',
      scope: 'Campaign identity',
      severity: 'warning',
      threshold: 'Unmatched spend campaign rows = 0',
      title: 'Campaign spend is unmatched',
    }));
  }

  const signupTotal = input.attributionQuality.attributedSignups + input.attributionQuality.unknownSignups;
  if (
    signupTotal >= MARKETING_ACTION_THRESHOLDS.comparisonMinimumBaseline &&
    input.attributionQuality.signupCoverageRate !== null &&
    input.attributionQuality.signupCoverageRate < MARKETING_ACTION_THRESHOLDS.attributionCoveragePercent
  ) {
    actions.push(marketingAction({
      actionLabel: 'Review unknown source',
      campaignKey: null,
      detail: `${input.attributionQuality.unknownSignups} of ${signupTotal} signups have no supported first-touch source.`,
      evidenceReadiness: input.readiness.status,
      key: 'signup-attribution-gap',
      observedValue: input.attributionQuality.signupCoverageRate,
      observedValueKind: 'percent',
      scope: 'Attribution quality',
      severity: 'warning',
      threshold: `Coverage < ${MARKETING_ACTION_THRESHOLDS.attributionCoveragePercent}%`,
      title: 'Signup attribution is incomplete',
    }));
  }

  const spendGrowth = input.comparison.adSpend.deltaPercent;
  if (
    input.comparison.adSpend.current > 0 &&
    spendGrowth !== null &&
    spendGrowth >= MARKETING_ACTION_THRESHOLDS.spendGrowthPercent &&
    input.comparison.bookingCompleted.delta <= 0
  ) {
    actions.push(marketingAction({
      actionLabel: 'Compare periods',
      campaignKey: null,
      detail: 'Recorded spend increased while completed new-customer outcomes did not.',
      evidenceReadiness: input.readiness.status,
      key: 'spend-growth-without-completion-growth',
      observedValue: spendGrowth,
      observedValueKind: 'percent',
      scope: 'Previous-period comparison',
      severity: 'danger',
      threshold: `Spend growth >= ${MARKETING_ACTION_THRESHOLDS.spendGrowthPercent}% with no completion growth`,
      title: 'Spend rose without completion growth',
    }));
  }

  const completionDelta = input.comparison.bookingCompleted.deltaPercent;
  if (
    input.comparison.bookingCompleted.previous >= MARKETING_ACTION_THRESHOLDS.comparisonMinimumBaseline &&
    completionDelta !== null &&
    completionDelta <= MARKETING_ACTION_THRESHOLDS.completedDeclinePercent
  ) {
    actions.push(marketingAction({
      actionLabel: 'Inspect trend',
      campaignKey: null,
      detail: 'Completed new-customer outcomes declined against the comparable previous period.',
      evidenceReadiness: input.readiness.status,
      key: 'completed-cohort-decline',
      observedValue: Math.abs(completionDelta),
      observedValueKind: 'percent',
      scope: 'Previous-period comparison',
      severity: 'warning',
      threshold: `Completed outcome change <= ${MARKETING_ACTION_THRESHOLDS.completedDeclinePercent}%`,
      title: 'Completed acquisition declined',
    }));
  }

  const sorted = actions.sort((left, right) =>
    Number(right.severity === 'danger') - Number(left.severity === 'danger') ||
    right.observedValue - left.observedValue ||
    left.key.localeCompare(right.key),
  );
  const visibleLimit = Math.max(0, Math.trunc(input.visibleLimit ?? MARKETING_ACTION_VISIBLE_LIMIT));
  const items = sorted.slice(0, visibleLimit);

  return {
    totalCount: sorted.length,
    visibleCount: items.length,
    hiddenCount: Math.max(0, sorted.length - items.length),
    items,
    generatedAt: normalizeIsoDate(input.generatedAt ?? new Date()) ?? new Date().toISOString(),
    thresholdVersion: MARKETING_ACTION_THRESHOLDS.version,
  };
}

function marketingAction(item: AdminMarketingActionItem) {
  return item;
}

function marketingWindowDateKeys(
  window: Pick<AdminMarketingWindow, 'startAt' | 'endAt'>,
  now: Date,
) {
  const effectiveEnd = new Date(Math.min(window.endAt.getTime(), addUtcDays(startOfVietnamDay(now), 1).getTime()));
  const dates: string[] = [];
  for (let date = new Date(window.startAt); date < effectiveEnd; date = addUtcDays(date, 1)) {
    dates.push(vietnamDateKey(date));
  }
  return dates;
}

function vietnamDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function normalizeIsoDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function lastCompleteMarketingDate(coverage: AdminMarketingSpendCoverage) {
  if (coverage.expectedDayCount === 0 || coverage.recordedDayCount === 0) return null;
  const missing = new Set(coverage.missingDates);
  if (missing.size === 0) return coverage.lastRecordedDate;
  return coverage.lastRecordedDate && !missing.has(coverage.lastRecordedDate) ? coverage.lastRecordedDate : null;
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

  if (
    stats.bookingCreated >= MARKETING_ACTION_THRESHOLDS.cancellationMinimumBookings &&
    percent(stats.bookingCancelled, stats.bookingCreated) >= MARKETING_ACTION_THRESHOLDS.cancellationRatePercent
  ) {
    insights.push('Booking cancellation rate is above 25%; review source quality before adding spend.');
  } else if (stats.bookingCreated > 0 && stats.bookingCreated < MARKETING_ACTION_THRESHOLDS.cancellationMinimumBookings) {
    insights.push(
      `Insufficient sample: ${stats.bookingCreated} ${stats.bookingCreated === 1 ? 'booking' : 'bookings'}. Cancellation evidence is not promoted to an action.`,
    );
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
