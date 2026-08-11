import type { AdminBooking } from '../../lib/admin-api';

export type BookingDateRangeFilter = 'all' | 'today' | 'yesterday' | '7d' | '30d' | 'custom';

export const bookingDateRangeFilterOptions: readonly {
  readonly label: string;
  readonly value: BookingDateRangeFilter;
}[] = [
  { value: 'all', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Previous day' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last month' },
  { value: 'custom', label: 'Custom dates' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function bookingCustomDateRangeError(dateFrom: string, dateTo: string) {
  const fromMs = parseDateInput(dateFrom);
  const toMs = parseDateInput(dateTo);

  if (fromMs === null || toMs === null) {
    return 'Choose a valid start date and end date.';
  }
  if (fromMs > toMs) {
    return 'Start date must be on or before end date.';
  }
  if (toMs - fromMs > 89 * DAY_MS) {
    return 'Custom date range cannot exceed 90 days.';
  }
  return null;
}

export function bookingMatchesDateRangeFilter(
  booking: AdminBooking,
  input: {
    readonly customDateFrom?: string;
    readonly customDateTo?: string;
    readonly dateRangeFilter: BookingDateRangeFilter;
    readonly nowMs: number;
  },
) {
  if (input.dateRangeFilter === 'all') {
    return true;
  }

  const timestamp = bookingDateRangeTimestamp(booking);
  if (timestamp === null) {
    return false;
  }

  const bounds = bookingDateRangeBounds(input);
  return timestamp >= bounds.startMs && timestamp <= bounds.endMs;
}

function bookingDateRangeTimestamp(booking: AdminBooking) {
  for (const value of [booking.statusChangedAt, booking.openedAt, booking.createdAt, booking.updatedAt]) {
    const timestamp = safeDateTimestamp(value);
    if (timestamp !== null) {
      return timestamp;
    }
  }
  return null;
}

function bookingDateRangeBounds(input: {
  readonly customDateFrom?: string;
  readonly customDateTo?: string;
  readonly dateRangeFilter: BookingDateRangeFilter;
  readonly nowMs: number;
}) {
  const todayStartMs = startOfLocalDay(input.nowMs);
  const todayEndMs = endOfLocalDay(todayStartMs);

  switch (input.dateRangeFilter) {
    case 'today':
      return { startMs: todayStartMs, endMs: todayEndMs };
    case 'yesterday': {
      const startMs = addDays(todayStartMs, -1);
      return { startMs, endMs: endOfLocalDay(startMs) };
    }
    case '7d':
      return { startMs: addDays(todayStartMs, -6), endMs: todayEndMs };
    case '30d':
      return { startMs: addDays(todayStartMs, -29), endMs: todayEndMs };
    case 'custom':
      return customDateRangeBounds(input.customDateFrom, input.customDateTo);
    default:
      return { startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY };
  }
}

function customDateRangeBounds(customDateFrom?: string, customDateTo?: string) {
  const from = parseDateInput(customDateFrom);
  const to = parseDateInput(customDateTo);

  if (from === null && to === null) {
    return { startMs: Number.NEGATIVE_INFINITY, endMs: Number.POSITIVE_INFINITY };
  }

  const startMs = from ?? Number.NEGATIVE_INFINITY;
  const endMs = to === null ? Number.POSITIVE_INFINITY : endOfLocalDay(to);

  return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
}

function parseDateInput(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const timestamp = Date.UTC(yearNumber, monthNumber - 1, dayNumber);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === yearNumber &&
    date.getUTCMonth() === monthNumber - 1 &&
    date.getUTCDate() === dayNumber
    ? timestamp
    : null;
}

function safeDateTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfLocalDay(startMs: number) {
  return addDays(startMs, 1) - 1;
}

function addDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}
