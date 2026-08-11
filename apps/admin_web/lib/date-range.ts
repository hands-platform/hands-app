export type AdminDateRange = 'all' | 'today' | '7d' | '30d' | '90d';

const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: VIETNAM_TIME_ZONE,
  year: 'numeric',
});

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

export function normalizeDateRange(value: string): AdminDateRange {
  if (value === 'all' || value === 'today' || value === '7d' || value === '30d' || value === '90d') {
    return value;
  }
  return 'today';
}

export function dateRangeLabel(range: AdminDateRange) {
  if (range === 'today') {
    return 'Today (Vietnam)';
  }
  if (range === '7d') {
    return 'Last 7 days';
  }
  if (range === '30d') {
    return 'Last 30 days';
  }
  if (range === '90d') {
    return 'Last 90 days';
  }
  return 'All dates';
}

export function isInDateRange(value: string | undefined | null, range: AdminDateRange) {
  if (!value) {
    return false;
  }

  const recordTime = Date.parse(value);
  if (!Number.isFinite(recordTime)) {
    return false;
  }

  if (range === 'today') {
    return vietnamDateKey(new Date(recordTime)) === vietnamDateKey(new Date());
  }

  const start = dateRangeStart(range);
  if (!start) {
    return true;
  }
  return recordTime >= start.getTime();
}

function dateRangeStart(range: AdminDateRange) {
  const now = new Date();
  if (range === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  if (range === '90d') {
    return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  }
  return null;
}

export function vietnamDateKey(date: Date) {
  const parts = vietnamDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
