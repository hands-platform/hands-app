import { readSearchParam } from './date-range';

export type DetailDateFilters = {
  active: boolean;
  from: string;
  to: string;
  range: string;
  label: string;
  fromMs: number;
  toMs: number;
};

export const detailDateRangeOptions = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

type SearchParams = Record<string, string | string[] | undefined>;

export function readDetailDateFilters(params: SearchParams = {}, now = new Date()): DetailDateFilters {
  const range = firstParam(params.range) ?? 'all';
  const explicitFrom = readDateInput(firstParam(params.from));
  const explicitTo = readDateInput(firstParam(params.to));

  let from = explicitFrom;
  let to = explicitTo;

  if (!from && !to) {
    const preset = presetRange(range, now);
    from = preset.from;
    to = preset.to;
  }

  const normalizedFrom = from ? startOfDateInput(from).getTime() : Number.NEGATIVE_INFINITY;
  const normalizedTo = to ? endOfDateInput(to).getTime() : Number.POSITIVE_INFINITY;
  const active = Boolean(from || to);
  const label = active ? buildDateRangeLabel(from, to) : 'All loaded records';

  return {
    active,
    from: from ?? '',
    to: to ?? '',
    range: active ? range : 'all',
    label,
    fromMs: Math.min(normalizedFrom, normalizedTo),
    toMs: Math.max(normalizedFrom, normalizedTo),
  };
}

export function isWithinDetailDateFilter(
  value: string | Date | null | undefined,
  filters: DetailDateFilters,
) {
  if (!filters.active) return true;
  const ms = value instanceof Date ? value.getTime() : value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(ms)) return false;
  return ms >= filters.fromMs && ms <= filters.toMs;
}

function firstParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function readDateInput(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = startOfDateInput(value);
  return Number.isNaN(date.getTime()) ? '' : value;
}

function presetRange(range: string, now: Date) {
  const today = dateInputValue(now);
  if (range === 'today') {
    return { from: today, to: today };
  }
  if (range === '7d') {
    return { from: dateInputValue(addDays(now, -6)), to: today };
  }
  if (range === '30d') {
    return { from: dateInputValue(addDays(now, -29)), to: today };
  }
  return { from: '', to: '' };
}

function buildDateRangeLabel(from?: string, to?: string) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'All loaded records';
}

function startOfDateInput(value: string) {
  return new Date(`${value}T00:00:00`);
}

function endOfDateInput(value: string) {
  return new Date(`${value}T23:59:59.999`);
}

function dateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
