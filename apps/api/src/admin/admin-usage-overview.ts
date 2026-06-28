import {
  VIETNAM_REGION_BUCKETS,
  VietnamCoordinateInput,
  VietnamRegionCode,
  vietnamRegionCodeFromValues,
} from './admin-vietnam-region-overview';

export type AdminUsageOverviewRange = 'today' | 'yesterday' | '7d' | 'month' | 'all';

export type AdminUsageOverviewWindow = {
  range: AdminUsageOverviewRange;
  label: string;
  startAt: Date | null;
  endAt: Date | null;
};

export type AdminUsageRegionInput = {
  regionValues: readonly unknown[];
  coordinates?: VietnamCoordinateInput | null;
  customerSessionCount?: number;
  bookingRequestCount?: number;
  completedBookingCount?: number;
};

export type AdminUsageRegionRow = {
  regionCode: VietnamRegionCode;
  regionName: string;
  shortName: string;
  customerSessionCount: number;
  bookingRequestCount: number;
  completedBookingCount: number;
};

const DEFAULT_USAGE_RANGE: AdminUsageOverviewRange = 'today';
const USAGE_RANGE_LABELS: Record<AdminUsageOverviewRange, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  month: 'This month',
  all: 'All time',
};

const SUPPORTED_USAGE_RANGES = new Set<AdminUsageOverviewRange>([
  'today',
  'yesterday',
  '7d',
  'month',
  'all',
]);

export function normalizeAdminUsageRange(value: unknown): AdminUsageOverviewRange {
  if (typeof value !== 'string') {
    return DEFAULT_USAGE_RANGE;
  }

  return SUPPORTED_USAGE_RANGES.has(value as AdminUsageOverviewRange)
    ? (value as AdminUsageOverviewRange)
    : DEFAULT_USAGE_RANGE;
}

export function adminUsageRangeWindow(
  rangeInput: AdminUsageOverviewRange,
  now = new Date(),
): AdminUsageOverviewWindow {
  const range = normalizeAdminUsageRange(rangeInput);
  const todayStart = startOfUtcDay(now);

  if (range === 'all') {
    return {
      range,
      label: USAGE_RANGE_LABELS[range],
      startAt: null,
      endAt: null,
    };
  }

  if (range === 'today') {
    return {
      range,
      label: USAGE_RANGE_LABELS[range],
      startAt: todayStart,
      endAt: addUtcDays(todayStart, 1),
    };
  }

  if (range === 'yesterday') {
    return {
      range,
      label: USAGE_RANGE_LABELS[range],
      startAt: addUtcDays(todayStart, -1),
      endAt: todayStart,
    };
  }

  if (range === 'month') {
    const startAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    return {
      range,
      label: USAGE_RANGE_LABELS[range],
      startAt,
      endAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    };
  }

  return {
    range,
    label: USAGE_RANGE_LABELS[range],
    startAt: addUtcDays(todayStart, -6),
    endAt: addUtcDays(todayStart, 1),
  };
}

export function adminUsageDateWhere(window: AdminUsageOverviewWindow) {
  if (!window.startAt || !window.endAt) {
    return undefined;
  }

  return {
    gte: window.startAt,
    lt: window.endAt,
  };
}

export function buildAdminUsageRegionRows(inputs: readonly AdminUsageRegionInput[]): AdminUsageRegionRow[] {
  const regions = new Map<VietnamRegionCode, AdminUsageRegionRow>(
    VIETNAM_REGION_BUCKETS.map((bucket) => [
      bucket.code,
      {
        regionCode: bucket.code,
        regionName: bucket.name,
        shortName: bucket.shortName,
        customerSessionCount: 0,
        bookingRequestCount: 0,
        completedBookingCount: 0,
      },
    ]),
  );

  for (const input of inputs) {
    const regionCode = vietnamRegionCodeFromValues(input.regionValues, input.coordinates);
    const region = regions.get(regionCode) ?? regions.get('other-vietnam');
    if (!region) continue;

    region.customerSessionCount += input.customerSessionCount ?? 0;
    region.bookingRequestCount += input.bookingRequestCount ?? 0;
    region.completedBookingCount += input.completedBookingCount ?? 0;
  }

  return Array.from(regions.values());
}

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
