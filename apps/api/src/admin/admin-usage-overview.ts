import { BadRequestException } from '@nestjs/common';

import {
  VIETNAM_REGION_BUCKETS,
  VietnamCoordinateInput,
  VietnamRegionCode,
  vietnamRegionCodeFromValues,
} from './admin-vietnam-region-overview';

export const ADMIN_USAGE_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const ADMIN_USAGE_CUSTOM_RANGE_MAX_DAYS = 90;

export type AdminUsageOverviewRange =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | 'month'
  | 'custom';

export type AdminUsageOverviewWindow = {
  range: AdminUsageOverviewRange;
  label: string;
  startAt: Date | null;
  endAt: Date | null;
  fromDate: string | null;
  toDate: string | null;
  dayCount: number;
  granularity: 'hourly' | 'daily';
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
  '30d': 'Last 30 days',
  month: 'This month',
  custom: 'Custom period',
};

const SUPPORTED_USAGE_RANGES = new Set<AdminUsageOverviewRange>([
  'today',
  'yesterday',
  '7d',
  '30d',
  'month',
  'custom',
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
  customFrom?: string,
  customTo?: string,
): AdminUsageOverviewWindow {
  const range = normalizeAdminUsageRange(rangeInput);
  const todayStart = startOfVietnamDay(now);

  if (range === 'today') {
    return usageWindow(range, USAGE_RANGE_LABELS[range], todayStart, now);
  }

  if (range === 'yesterday') {
    return usageWindow(range, USAGE_RANGE_LABELS[range], addDays(todayStart, -1), todayStart);
  }

  if (range === 'month') {
    const localParts = vietnamDateParts(now);
    const startAt = vietnamDateStart(localParts.year, localParts.month, 1);
    return usageWindow(range, USAGE_RANGE_LABELS[range], startAt, now);
  }

  if (range === 'custom') {
    const startAt = parseVietnamDate(customFrom);
    const endDateStart = parseVietnamDate(customTo);
    if (!startAt || !endDateStart) {
      throw new BadRequestException('Custom usage range requires valid From and To dates.');
    }
    if (startAt > endDateStart) {
      throw new BadRequestException('Custom usage range From date must be on or before To date.');
    }
    if (startAt > todayStart || endDateStart > todayStart) {
      throw new BadRequestException('Custom usage range cannot include a future date.');
    }
    const dayCount = Math.round((endDateStart.getTime() - startAt.getTime()) / 86_400_000) + 1;
    if (dayCount > ADMIN_USAGE_CUSTOM_RANGE_MAX_DAYS) {
      throw new BadRequestException(
        `Custom usage range cannot exceed ${ADMIN_USAGE_CUSTOM_RANGE_MAX_DAYS} days.`,
      );
    }

    return usageWindow(
      range,
      USAGE_RANGE_LABELS[range],
      startAt,
      endDateStart.getTime() === todayStart.getTime() ? now : addDays(endDateStart, 1),
    );
  }

  const lookbackDays = range === '30d' ? 29 : 6;
  return usageWindow(range, USAGE_RANGE_LABELS[range], addDays(todayStart, -lookbackDays), now);
}

export function adminUsageComparisonWindow(window: AdminUsageOverviewWindow): AdminUsageOverviewWindow | null {
  if (!window.startAt || !window.endAt) return null;

  const durationMs = Math.max(1, window.endAt.getTime() - window.startAt.getTime());
  const endAt = window.startAt;
  const startAt = new Date(endAt.getTime() - durationMs);

  return usageWindow(window.range, `Previous ${window.label.toLowerCase()}`, startAt, endAt);
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

function usageWindow(
  range: AdminUsageOverviewRange,
  label: string,
  startAt: Date,
  endAt: Date,
): AdminUsageOverviewWindow {
  const fromDate = vietnamDateParam(startAt);
  const toDate = vietnamDateParam(new Date(Math.max(startAt.getTime(), endAt.getTime() - 1)));
  const dayCount =
    Math.round((parseVietnamDate(toDate)!.getTime() - parseVietnamDate(fromDate)!.getTime()) / 86_400_000) + 1;

  return {
    range,
    label,
    startAt,
    endAt,
    fromDate,
    toDate,
    dayCount,
    granularity: dayCount === 1 ? 'hourly' : 'daily',
  };
}

function startOfVietnamDay(value: Date) {
  const parts = vietnamDateParts(value);
  return vietnamDateStart(parts.year, parts.month, parts.day);
}

function vietnamDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: ADMIN_USAGE_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    day: numberPart('day'),
    month: numberPart('month'),
    year: numberPart('year'),
  };
}

function vietnamDateStart(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day, -7));
}

function parseVietnamDate(value: string | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;
  const date = vietnamDateStart(Number(match[1]), Number(match[2]), Number(match[3]));
  const parts = vietnamDateParts(date);

  return parts.year === Number(match[1]) && parts.month === Number(match[2]) && parts.day === Number(match[3])
    ? date
    : null;
}

function vietnamDateParam(value: Date) {
  const parts = vietnamDateParts(value);
  return `${parts.year.toString().padStart(4, '0')}-${parts.month.toString().padStart(2, '0')}-${parts.day
    .toString()
    .padStart(2, '0')}`;
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
