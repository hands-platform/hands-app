import { type AdminUsageOverview } from '../../lib/admin-api';
import { buildCustomerFilters, buildCustomerListHref } from '../customers/customer-filters';
import { buildBookingListHref } from '../bookings/booking-page-params';

export type UsageOverviewRange = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'custom';

export const usageOverviewRangeOptions: Array<{ value: UsageOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export type UsageActionPriorityTone = 'danger' | 'warning' | 'info' | 'success';

export type UsageActionPriority = {
  key: string;
  label: string;
  detail: string;
  tone: UsageActionPriorityTone;
  value: number;
  valueLabel: string;
  href: string;
};

const usageOverviewRanges = new Set<UsageOverviewRange>(usageOverviewRangeOptions.map((option) => option.value));

const usageOverviewFallbackRangeLabels: Record<UsageOverviewRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  custom: 'Custom period',
};

function emptyHourlyActivity(): AdminUsageOverview['behavior']['hourlyActivity'] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    customerSessionCount: 0,
    bookingRequestCount: 0,
    totalActivityCount: 0,
  }));
}

export function normalizeUsageOverviewRange(value: string | string[] | undefined): UsageOverviewRange {
  const candidate = Array.isArray(value) ? value[0] : value;

  return usageOverviewRanges.has(candidate as UsageOverviewRange)
    ? (candidate as UsageOverviewRange)
    : 'today';
}

export function usageOverviewHref(range: UsageOverviewRange) {
  return `/usage-overview?range=${range}`;
}

export function usageOverviewCustomHref(today: string) {
  const to = new Date(`${today}T00:00:00.000Z`);
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 6);
  return `/usage-overview?range=custom&from=${from.toISOString().slice(0, 10)}&to=${today}`;
}

export function emptyUsageOverview(range: UsageOverviewRange): AdminUsageOverview {
  return {
    generatedAt: new Date(0).toISOString(),
    dataThroughAt: null,
    freshness: {
      bookingActivityThroughAt: null,
      reportGeneratedAt: new Date(0).toISOString(),
      reviewActivityThroughAt: null,
      refundActivityThroughAt: null,
      usageAggregatedThroughAt: null,
      usageStatus: 'unknown',
    },
    source: 'stored-usage-aggregates',
    timeZone: 'Asia/Ho_Chi_Minh',
    range,
    rangeLabel: usageOverviewFallbackRangeLabels[range],
    windowStartAt: null,
    windowEndAt: null,
    appliedRange: {
      dayCount: 1,
      fromDate: null,
      granularity: 'hourly',
      toDate: null,
    },
    totals: {
      activeCustomerCount: 0,
      appOpenCount: 0,
      bookingCustomerCount: 0,
      customerSessionCount: 0,
      completedBookingCount: 0,
      completedCustomerCount: 0,
      partnerProfileViewCount: 0,
      partnerBookingRequestCount: 0,
      totalEventCount: 0,
    },
    comparison: {
      fromDate: null,
      rangeLabel: 'Previous period',
      toDate: null,
      totals: {
        activeCustomerCount: 0,
        appOpenCount: 0,
        cancellationCount: 0,
        completedBookingCount: 0,
        createdBookingCount: 0,
        newCustomerCount: 0,
        partnerBookingRequestCount: 0,
        partnerProfileViewCount: 0,
        sessionStartCount: 0,
        unresolvedCount: 0,
      },
      windowEndAt: null,
      windowStartAt: null,
    },
    funnel: [],
    retention: [
      { eligibleCustomerCount: 0, milestone: 1, rate: null, returnedCustomerCount: 0 },
      { eligibleCustomerCount: 0, milestone: 7, rate: null, returnedCustomerCount: 0 },
      { eligibleCustomerCount: 0, milestone: 30, rate: null, returnedCustomerCount: 0 },
    ],
    customerLifecycle: {
      newCustomerCount: 0,
      activeCustomerCount: 0,
      activeTodayCustomerCount: 0,
      active7dCustomerCount: 0,
      active30dCustomerCount: 0,
      completedCustomerCount: 0,
      repeatCustomerCount: 0,
      churnRiskCustomerCount: 0,
      neverBookedCustomerCount: 0,
    },
    bookingQuality: {
      createdBookingCount: 0,
      cancellationCount: 0,
      expiredCount: 0,
      noShowCount: 0,
      refundCount: 0,
      unresolvedCount: 0,
      lowReviewCount: 0,
    },
    paymentAndCoupon: {
      couponBookingCount: 0,
      paymentFailureCount: 0,
      refundAmount: 0,
      paymentMethodMix: [],
    },
    customerSegments: {
      newUnbookedCustomerCount: 0,
      firstCompletedCustomerCount: 0,
      repeatCustomerCount: 0,
      vipCustomerCount: 0,
      churnRiskCustomerCount: 0,
      issueCustomerCount: 0,
    },
    platformUsage: [],
    behavior: {
      popularServices: [],
      hourlyActivity: emptyHourlyActivity(),
      trend: [],
    },
    customerRankings: [],
    partnerRankings: [],
    customerUsage: {
      mostActiveCustomers: [],
      completedBookingCustomers: [],
      qualityRiskCustomers: [],
      lowReviewCustomers: [],
    },
    regionUsage: [],
    partnerUsage: {
      discoveryConversion: [],
      mostViewedPartners: [],
      requestedPartners: [],
      completedPartners: [],
    },
    provenance: {
      booking: 'incomplete',
      unknownBookingCount: 0,
      unknownUsageAggregateCount: 0,
      usage: 'incomplete',
    },
  };
}

type PartialUsageOverview = Omit<
  Partial<AdminUsageOverview>,
  | 'behavior'
  | 'bookingQuality'
  | 'comparison'
  | 'customerLifecycle'
  | 'customerSegments'
  | 'customerUsage'
  | 'freshness'
  | 'partnerUsage'
  | 'paymentAndCoupon'
  | 'totals'
> & {
  bookingQuality?: Partial<AdminUsageOverview['bookingQuality']>;
  customerLifecycle?: Partial<AdminUsageOverview['customerLifecycle']>;
  customerSegments?: Partial<AdminUsageOverview['customerSegments']>;
  customerUsage?: Partial<AdminUsageOverview['customerUsage']>;
  behavior?: Partial<AdminUsageOverview['behavior']>;
  freshness?: Partial<AdminUsageOverview['freshness']>;
  comparison?: Partial<AdminUsageOverview['comparison']> & {
    totals?: Partial<AdminUsageOverview['comparison']['totals']>;
  };
  partnerUsage?: Partial<AdminUsageOverview['partnerUsage']>;
  paymentAndCoupon?: Partial<AdminUsageOverview['paymentAndCoupon']>;
  platformUsage?: AdminUsageOverview['platformUsage'];
  totals?: Partial<AdminUsageOverview['totals']>;
};

export function usageOverviewWithDefaults(
  input: PartialUsageOverview | null | undefined,
  range: UsageOverviewRange,
): AdminUsageOverview {
  const fallback = emptyUsageOverview(range);

  return {
    ...fallback,
    ...(input ?? {}),
    totals: {
      ...fallback.totals,
      ...(input?.totals ?? {}),
    },
    freshness: {
      ...fallback.freshness,
      ...(input?.freshness ?? {}),
    },
    comparison: {
      ...fallback.comparison,
      ...(input?.comparison ?? {}),
      totals: {
        ...fallback.comparison.totals,
        ...(input?.comparison?.totals ?? {}),
      },
    },
    funnel: input?.funnel ?? fallback.funnel,
    retention: input?.retention ?? fallback.retention,
    customerLifecycle: {
      ...fallback.customerLifecycle,
      ...(input?.customerLifecycle ?? {}),
    },
    bookingQuality: {
      ...fallback.bookingQuality,
      ...(input?.bookingQuality ?? {}),
    },
    paymentAndCoupon: {
      ...fallback.paymentAndCoupon,
      ...(input?.paymentAndCoupon ?? {}),
      paymentMethodMix: input?.paymentAndCoupon?.paymentMethodMix ?? fallback.paymentAndCoupon.paymentMethodMix,
    },
    customerSegments: {
      ...fallback.customerSegments,
      ...(input?.customerSegments ?? {}),
    },
    platformUsage: input?.platformUsage ?? fallback.platformUsage,
    behavior: {
      ...fallback.behavior,
      ...(input?.behavior ?? {}),
      popularServices: input?.behavior?.popularServices ?? fallback.behavior.popularServices,
      hourlyActivity: input?.behavior?.hourlyActivity ?? fallback.behavior.hourlyActivity,
      trend: input?.behavior?.trend ?? fallback.behavior.trend,
    },
    customerRankings: input?.customerRankings ?? fallback.customerRankings,
    partnerRankings: input?.partnerRankings ?? fallback.partnerRankings,
    customerUsage: {
      ...fallback.customerUsage,
      ...(input?.customerUsage ?? {}),
      mostActiveCustomers: input?.customerUsage?.mostActiveCustomers ?? fallback.customerUsage.mostActiveCustomers,
      completedBookingCustomers:
        input?.customerUsage?.completedBookingCustomers ?? fallback.customerUsage.completedBookingCustomers,
      qualityRiskCustomers: input?.customerUsage?.qualityRiskCustomers ?? fallback.customerUsage.qualityRiskCustomers,
      lowReviewCustomers: input?.customerUsage?.lowReviewCustomers ?? fallback.customerUsage.lowReviewCustomers,
    },
    regionUsage: input?.regionUsage ?? fallback.regionUsage,
    partnerUsage: {
      ...fallback.partnerUsage,
      ...(input?.partnerUsage ?? {}),
      discoveryConversion: input?.partnerUsage?.discoveryConversion ?? fallback.partnerUsage.discoveryConversion,
      mostViewedPartners: input?.partnerUsage?.mostViewedPartners ?? fallback.partnerUsage.mostViewedPartners,
      requestedPartners: input?.partnerUsage?.requestedPartners ?? fallback.partnerUsage.requestedPartners,
      completedPartners: input?.partnerUsage?.completedPartners ?? fallback.partnerUsage.completedPartners,
    },
  };
}

export function buildUsageActionPriorities(overview: AdminUsageOverview): UsageActionPriority[] {
  const fromDate = overview.appliedRange.fromDate ?? '';
  const toDate = overview.appliedRange.toDate ?? '';
  const customerFilters = buildCustomerFilters({});

  return [
    {
      key: 'new-unbooked',
      label: 'New customers without a verified production booking',
      detail: 'Joined in this reporting period and still have no production booking.',
      tone: 'warning',
      value: overview.customerSegments.newUnbookedCustomerCount,
      valueLabel: countLabel(overview.customerSegments.newUnbookedCustomerCount, 'customer'),
      href: buildCustomerListHref(customerFilters, {
        dateField: 'joined',
        dateFrom: fromDate,
        dateRange: 'custom',
        dateTo: toDate,
        segment: 'usage-new-unbooked',
        view: 'all',
      }),
    },
    {
      key: 'unresolved-bookings',
      label: 'Unresolved booking records',
      detail: 'Created in this reporting period and still have no terminal outcome.',
      tone: 'danger',
      value: overview.bookingQuality.unresolvedCount,
      valueLabel: countLabel(overview.bookingQuality.unresolvedCount, 'booking'),
      href: buildBookingListHref({
        dateFrom: fromDate,
        dateRange: 'custom',
        dateTo: toDate,
        sort: 'oldest',
        view: 'usage-unresolved',
      }),
    },
  ].filter((priority) => priority.value > 0) as UsageActionPriority[];
}

export function countLabel(value: number, singular: string) {
  return value === 1 ? singular : `${singular}s`;
}

export function validateUsageCustomRange(from: string | null, to: string | null, today: string) {
  if (!isDate(from) || !isDate(to)) return 'Enter valid From and To dates.';
  if (from > to) return 'From must be on or before To.';
  if (to > today) return 'Future dates are not allowed.';
  const dayCount = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return dayCount > 90 ? 'Custom periods cannot exceed 90 days.' : null;
}

function isDate(value: string | null): value is string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
