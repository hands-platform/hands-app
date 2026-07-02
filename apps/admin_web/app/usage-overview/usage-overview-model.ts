import { type AdminUsageOverview } from '../../lib/admin-api';

export type UsageOverviewRange = 'today' | 'yesterday' | '7d' | 'month' | 'all';

export const usageOverviewRangeOptions: Array<{ value: UsageOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 days' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

export type UsageActionPriorityTone = 'danger' | 'warning' | 'info' | 'success';

export type UsageActionPriority = {
  key: string;
  label: string;
  detail: string;
  tone: UsageActionPriorityTone;
  value: number;
  valueLabel: string;
};

const usageOverviewRanges = new Set<UsageOverviewRange>(
  usageOverviewRangeOptions.map((option) => option.value),
);

const usageOverviewFallbackRangeLabels: Record<UsageOverviewRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  month: 'This month',
  all: 'All time',
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

export function emptyUsageOverview(range: UsageOverviewRange): AdminUsageOverview {
  return {
    generatedAt: new Date(0).toISOString(),
    refreshSeconds: 60,
    source: 'stored-usage-aggregates',
    range,
    rangeLabel: usageOverviewFallbackRangeLabels[range],
    windowStartAt: null,
    windowEndAt: null,
    totals: {
      customerSessionCount: 0,
      completedBookingCount: 0,
      partnerProfileViewCount: 0,
      partnerBookingRequestCount: 0,
    },
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
      refundCount: 0,
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
    },
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
  };
}

type PartialUsageOverview = Partial<AdminUsageOverview> & {
  bookingQuality?: Partial<AdminUsageOverview['bookingQuality']>;
  customerLifecycle?: Partial<AdminUsageOverview['customerLifecycle']>;
  customerSegments?: Partial<AdminUsageOverview['customerSegments']>;
  customerUsage?: Partial<AdminUsageOverview['customerUsage']>;
  behavior?: Partial<AdminUsageOverview['behavior']>;
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
    },
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
  const viewToRequestRate = ratioPercent(
    overview.totals.partnerBookingRequestCount,
    overview.totals.partnerProfileViewCount,
  );
  const requestToCompleteRate = ratioPercent(
    overview.totals.completedBookingCount,
    overview.totals.partnerBookingRequestCount,
  );

  return [
    {
      key: 'issue-signal',
      label: 'Review problem customers',
      detail: 'Cancellation, no-show, expiry, or refund signals in this range.',
      tone: overview.customerSegments.issueCustomerCount > 0 ? 'danger' : 'success',
      value: overview.customerSegments.issueCustomerCount,
      valueLabel: 'customers',
    },
    {
      key: 'churn-risk',
      label: 'Recover churn risk',
      detail: 'Completed before, then no customer app session in 30 days.',
      tone: overview.customerSegments.churnRiskCustomerCount > 0 ? 'danger' : 'success',
      value: overview.customerSegments.churnRiskCustomerCount,
      valueLabel: 'customers',
    },
    {
      key: 'new-unbooked',
      label: 'Convert new unbooked',
      detail: 'New customers in this range who still have no booking.',
      tone: overview.customerSegments.newUnbookedCustomerCount > 0 ? 'warning' : 'success',
      value: overview.customerSegments.newUnbookedCustomerCount,
      valueLabel: 'customers',
    },
    {
      key: 'discovery-dropoff',
      label: 'Improve Partner discovery',
      detail: 'Partner profile views that are not becoming preferred Partner requests.',
      tone: viewToRequestRate < 25 && overview.totals.partnerProfileViewCount > 0 ? 'warning' : 'info',
      value: viewToRequestRate,
      valueLabel: 'view-to-request',
    },
    {
      key: 'completion-dropoff',
      label: 'Watch booking completion',
      detail: 'Preferred Partner requests that are not closing as completed work.',
      tone: requestToCompleteRate < 50 && overview.totals.partnerBookingRequestCount > 0 ? 'warning' : 'info',
      value: requestToCompleteRate,
      valueLabel: 'request-to-complete',
    },
  ];
}

function ratioPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;

  return Math.round((numerator / denominator) * 100);
}
