import { type AdminPartnerOverview, type AdminPartnerOverviewRange } from '../../../lib/admin-api';

export const partnerOverviewRangeOptions: Array<{ value: AdminPartnerOverviewRange; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

const partnerOverviewRanges = new Set<AdminPartnerOverviewRange>(
  partnerOverviewRangeOptions.map((option) => option.value),
);

const partnerOverviewFallbackRangeLabels: Record<AdminPartnerOverviewRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

export function normalizePartnerOverviewRange(value: string | undefined): AdminPartnerOverviewRange {
  return partnerOverviewRanges.has(value as AdminPartnerOverviewRange)
    ? (value as AdminPartnerOverviewRange)
    : 'today';
}

export function partnerOverviewHref(
  range: AdminPartnerOverviewRange,
  filters: Partial<AdminPartnerOverview['filters']> = {},
) {
  const params = new URLSearchParams({ range });
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }

  return `/partners/overview?${params.toString()}`;
}

const partnerOverviewDirectoryFilterMap = {
  city: 'city',
  onlineStatus: 'onlineStatus',
  serviceId: 'serviceId',
  verificationStatus: 'verification',
  walletStatus: 'walletStatus',
} as const satisfies Partial<Record<keyof AdminPartnerOverview['filters'], string>>;

export function partnerOverviewDirectoryLink(
  sourceHref: string,
  range: AdminPartnerOverviewRange,
  filters: Partial<AdminPartnerOverview['filters']> = {},
) {
  const url = new URL(sourceHref, 'http://partner-overview.local');
  const exact = !filters.riskStatus;

  for (const [overviewKey, directoryKey] of Object.entries(partnerOverviewDirectoryFilterMap)) {
    const value = filters[overviewKey as keyof AdminPartnerOverview['filters']];
    if (value) url.searchParams.set(directoryKey, value);
  }
  if (url.searchParams.get('review')?.includes('quality')) {
    url.searchParams.set('qualityRange', range);
  }

  return {
    exact,
    href: `${url.pathname}${url.search}`,
  };
}

export function partnerOverviewFreshness(
  generatedAt: string,
  refreshSeconds: number,
  now = Date.now(),
) {
  const generatedTime = Date.parse(generatedAt);
  const safeRefreshMs = Math.max(1, refreshSeconds) * 1_000;
  const ageMs = Number.isFinite(generatedTime) ? Math.max(0, now - generatedTime) : Number.POSITIVE_INFINITY;

  return {
    ageMs,
    stale: ageMs > safeRefreshMs * 2,
  };
}

const partnerOverviewFilterLabels: Record<keyof AdminPartnerOverview['filters'], string> = {
  city: 'City / area',
  onlineStatus: 'Online',
  riskStatus: 'Risk',
  selectionIssue: 'Selection issue',
  selectionSort: 'Selection sort',
  serviceId: 'Service',
  verificationStatus: 'Verification',
  walletStatus: 'Wallet',
};

const partnerOverviewFilterValueLabels: Partial<
  Record<keyof AdminPartnerOverview['filters'], Record<string, string>>
> = {
  onlineStatus: {
    available: 'Available',
    busy: 'Busy',
    offline: 'Offline',
    online: 'Online',
  },
  riskStatus: {
    critical: 'Critical',
    high: 'High',
    low: 'Low',
    medium: 'Medium',
  },
  selectionIssue: {
    availability: 'Availability',
    price: 'Price',
    profile: 'Profile',
    response: 'Response',
    service: 'Service',
  },
  selectionSort: {
    availability: 'Availability risk',
    favorites: 'Favorites',
    price: 'Highest price',
    response: 'Response time',
    views: 'Profile views',
  },
  verificationStatus: {
    APPROVED: 'Approved',
    DRAFT: 'Draft',
    REJECTED: 'Rejected',
    SUBMITTED: 'Submitted',
  },
  walletStatus: {
    negative: 'Negative',
    positive: 'Positive',
    zero: 'Zero',
  },
};

export function partnerOverviewActiveFilters(
  range: AdminPartnerOverviewRange,
  filters: Partial<AdminPartnerOverview['filters']> = {},
) {
  return Object.entries(filters)
    .filter((entry): entry is [keyof AdminPartnerOverview['filters'], string] => {
      const [, value] = entry;
      return typeof value === 'string' && value.trim().length > 0;
    })
    .map(([key, value]) => {
      const nextFilters = { ...filters };
      delete nextFilters[key];

      return {
        key,
        label: partnerOverviewFilterLabels[key],
        value: partnerOverviewFilterValueLabels[key]?.[value] ?? value,
        removeHref: partnerOverviewHref(range, nextFilters),
      };
    });
}

export function emptyPartnerOverview(range: AdminPartnerOverviewRange): AdminPartnerOverview {
  return {
    generatedAt: '',
    refreshSeconds: 60,
    source: 'live-summary-backed-partner-operational-query',
    timeZone: 'Asia/Ho_Chi_Minh',
    range,
    rangeLabel: partnerOverviewFallbackRangeLabels[range],
    windowStartAt: null,
    windowEndAt: null,
    comparison: {
      rangeLabel: `Previous ${partnerOverviewFallbackRangeLabels[range].toLowerCase()}`,
      windowStartAt: null,
      windowEndAt: null,
      totals: {
        appOpenCount: 0,
        cancellationCount: 0,
        completedBookingCount: 0,
        sessionStartCount: 0,
      },
    },
    queryScope: {
      actionListCountScope: 'full-population',
      appActivityCountScope: 'full-population',
      operatingStatusCountScope: 'full-population',
      providerScanLimit: 500,
      walletBalancePartnerCount: 0,
      walletBalanceScopeTruncated: false,
      walletStatusFilterBounded: false,
    },
    filters: {
      city: null,
      onlineStatus: null,
      riskStatus: null,
      selectionIssue: null,
      selectionSort: null,
      serviceId: null,
      verificationStatus: null,
      walletStatus: null,
    },
    filterOptions: {
      services: [],
    },
    summaryKpis: [],
    operatingStatus: {
      locationFreshnessMinutes: 90,
      customerDiscovery: {
        visibleNow: 0,
        visibleHref: '/partners?review=customer-visible-now',
        blockers: [],
      },
      cards: [],
      availableBlockedReasons: [],
    },
    supplyHealth: {
      areas: [],
      services: [],
    },
    funnel: {
      steps: [],
    },
    activityRetention: {
      cards: [],
    },
    appActivity: {
      kpis: [],
      mostActive: [],
      inactivePartners: [],
    },
    bookingQuality: {
      kpis: [],
      riskPartnerCount: 0,
      riskPartners: [],
    },
    financeWalletRisk: {
      kpis: [],
      negativeWalletPartners: [],
      policyNote: '',
    },
    selectionFriction: {
      issueCounts: [],
      rows: [],
    },
    actionLists: [],
    segments: [],
    dataNotes: [],
  };
}

type PartialPartnerOverview = Partial<AdminPartnerOverview> & {
  activityRetention?: Partial<AdminPartnerOverview['activityRetention']>;
  appActivity?: Partial<AdminPartnerOverview['appActivity']>;
  bookingQuality?: Partial<AdminPartnerOverview['bookingQuality']>;
  comparison?: Partial<AdminPartnerOverview['comparison']> & {
    totals?: Partial<AdminPartnerOverview['comparison']['totals']>;
  };
  filterOptions?: Partial<AdminPartnerOverview['filterOptions']>;
  financeWalletRisk?: Partial<AdminPartnerOverview['financeWalletRisk']>;
  filters?: Partial<AdminPartnerOverview['filters']>;
  funnel?: Partial<AdminPartnerOverview['funnel']>;
  operatingStatus?: Partial<AdminPartnerOverview['operatingStatus']>;
  queryScope?: Partial<AdminPartnerOverview['queryScope']>;
  selectionFriction?: Partial<AdminPartnerOverview['selectionFriction']>;
  supplyHealth?: Partial<AdminPartnerOverview['supplyHealth']>;
};

export function partnerOverviewWithDefaults(
  value: PartialPartnerOverview | null | undefined,
  fallbackRange: AdminPartnerOverviewRange,
): AdminPartnerOverview {
  const fallback = emptyPartnerOverview(fallbackRange);
  if (!value) return fallback;

  return {
    ...fallback,
    ...value,
    range: normalizePartnerOverviewRange(value.range ?? fallbackRange),
    rangeLabel: value.rangeLabel ?? partnerOverviewFallbackRangeLabels[fallbackRange],
    comparison: {
      ...fallback.comparison,
      ...(value.comparison ?? {}),
      totals: {
        ...fallback.comparison.totals,
        ...(value.comparison?.totals ?? {}),
      },
    },
    queryScope: {
      ...fallback.queryScope,
      ...(value.queryScope ?? {}),
    },
    filters: {
      ...fallback.filters,
      ...(value.filters ?? {}),
    },
    filterOptions: {
      ...fallback.filterOptions,
      ...(value.filterOptions ?? {}),
      services: value.filterOptions?.services ?? fallback.filterOptions.services,
    },
    summaryKpis: value.summaryKpis ?? fallback.summaryKpis,
    operatingStatus: {
      ...fallback.operatingStatus,
      ...(value.operatingStatus ?? {}),
      customerDiscovery: {
        ...fallback.operatingStatus.customerDiscovery,
        ...(value.operatingStatus?.customerDiscovery ?? {}),
        blockers:
          value.operatingStatus?.customerDiscovery?.blockers ??
          fallback.operatingStatus.customerDiscovery.blockers,
      },
      cards: value.operatingStatus?.cards ?? fallback.operatingStatus.cards,
      availableBlockedReasons:
        value.operatingStatus?.availableBlockedReasons ??
        fallback.operatingStatus.availableBlockedReasons,
    },
    supplyHealth: {
      ...fallback.supplyHealth,
      ...(value.supplyHealth ?? {}),
      areas: value.supplyHealth?.areas ?? fallback.supplyHealth.areas,
      services: value.supplyHealth?.services ?? fallback.supplyHealth.services,
    },
    funnel: {
      ...fallback.funnel,
      ...(value.funnel ?? {}),
      steps: value.funnel?.steps ?? fallback.funnel.steps,
    },
    activityRetention: {
      ...fallback.activityRetention,
      ...(value.activityRetention ?? {}),
      cards: value.activityRetention?.cards ?? fallback.activityRetention.cards,
    },
    appActivity: {
      ...fallback.appActivity,
      ...(value.appActivity ?? {}),
      kpis: value.appActivity?.kpis ?? fallback.appActivity.kpis,
      mostActive: value.appActivity?.mostActive ?? fallback.appActivity.mostActive,
      inactivePartners: value.appActivity?.inactivePartners ?? fallback.appActivity.inactivePartners,
    },
    bookingQuality: {
      ...fallback.bookingQuality,
      ...(value.bookingQuality ?? {}),
      kpis: value.bookingQuality?.kpis ?? fallback.bookingQuality.kpis,
      riskPartners: value.bookingQuality?.riskPartners ?? fallback.bookingQuality.riskPartners,
    },
    financeWalletRisk: {
      ...fallback.financeWalletRisk,
      ...(value.financeWalletRisk ?? {}),
      kpis: value.financeWalletRisk?.kpis ?? fallback.financeWalletRisk.kpis,
      negativeWalletPartners:
        value.financeWalletRisk?.negativeWalletPartners ?? fallback.financeWalletRisk.negativeWalletPartners,
      policyNote: value.financeWalletRisk?.policyNote ?? fallback.financeWalletRisk.policyNote,
    },
    selectionFriction: {
      ...fallback.selectionFriction,
      ...(value.selectionFriction ?? {}),
      issueCounts: value.selectionFriction?.issueCounts ?? fallback.selectionFriction.issueCounts,
      rows: value.selectionFriction?.rows ?? fallback.selectionFriction.rows,
    },
    actionLists: value.actionLists ?? fallback.actionLists,
    segments: value.segments ?? fallback.segments,
    dataNotes: value.dataNotes ?? fallback.dataNotes,
  };
}
