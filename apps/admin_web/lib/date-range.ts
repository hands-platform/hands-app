export type AdminDateRange = 'all' | 'today' | '7d' | '30d';

export function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

export function normalizeDateRange(value: string): AdminDateRange {
  if (value === 'today' || value === '7d' || value === '30d') {
    return value;
  }
  return 'all';
}

export function dateRangeLabel(range: AdminDateRange) {
  if (range === 'today') {
    return 'Today';
  }
  if (range === '7d') {
    return 'Last 7 days';
  }
  if (range === '30d') {
    return 'Last 30 days';
  }
  return 'All dates';
}

export function isInDateRange(value: string | undefined | null, range: AdminDateRange) {
  const start = dateRangeStart(range);
  if (!start) {
    return true;
  }
  if (!value) {
    return false;
  }
  const recordTime = Date.parse(value);
  return Number.isFinite(recordTime) && recordTime >= start.getTime();
}

function dateRangeStart(range: AdminDateRange) {
  const now = new Date();
  if (range === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (range === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}
