import { readSearchParam } from './date-range';

export type AdminQueueAge = 'all' | 'under-1h' | '1-4h' | '4-24h' | 'over-24h';
export type AdminQueueSort = 'newest' | 'oldest';
export type AdminQueueSlaFilter =
  | 'all'
  | 'critical'
  | 'overdue'
  | 'overdue-under-24h'
  | 'within';
export type AdminQueueAgeCounts = Record<AdminQueueAge, number>;
export type AdminQueueSlaSummary = {
  overdueCount: number;
  thresholdMinutes: number;
};

export const ADMIN_QUEUE_AGE_OPTIONS = [
  { label: 'All ages', value: 'all' },
  { label: 'Under 1h', value: 'under-1h' },
  { label: '1-4h', value: '1-4h' },
  { label: '4-24h', value: '4-24h' },
  { label: '24h+', value: 'over-24h' },
] as const satisfies readonly { label: string; value: AdminQueueAge }[];

export const ADMIN_QUEUE_SORT_OPTIONS = [
  { label: 'Oldest first', value: 'oldest' },
  { label: 'Newest first', value: 'newest' },
] as const satisfies readonly { label: string; value: AdminQueueSort }[];

export function readAdminQueueAge(value: string | string[] | undefined): AdminQueueAge {
  const age = readSearchParam(value);
  return age === 'under-1h' || age === '1-4h' || age === '4-24h' || age === 'over-24h'
    ? age
    : 'all';
}

export function readAdminQueueSort(value: string | string[] | undefined): AdminQueueSort {
  return readSearchParam(value) === 'oldest' ? 'oldest' : 'newest';
}

export function readAdminQueueSlaFilter(
  value: string | string[] | undefined,
): AdminQueueSlaFilter {
  const sla = readSearchParam(value);
  return sla === 'critical' ||
    sla === 'overdue' ||
    sla === 'overdue-under-24h' ||
    sla === 'within'
    ? sla
    : 'all';
}

export function adminQueueAgeLabel(age: AdminQueueAge) {
  return ADMIN_QUEUE_AGE_OPTIONS.find((option) => option.value === age)?.label ?? 'All ages';
}

export function adminQueueSortLabel(sort: AdminQueueSort) {
  return ADMIN_QUEUE_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Newest first';
}

export function adminQueueSlaFilterLabel(sla: AdminQueueSlaFilter) {
  switch (sla) {
    case 'within':
      return 'Within SLA';
    case 'overdue-under-24h':
      return 'Overdue under 24h';
    case 'critical':
      return '24h+ critical';
    case 'overdue':
      return 'All overdue';
    case 'all':
    default:
      return 'All SLA states';
  }
}

export function adminQueueSlaThresholdLabel(minutes: number) {
  if (minutes >= 1_440 && minutes % 1_440 === 0) {
    return `${minutes / 1_440}d`;
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    return `${minutes / 60}h`;
  }
  return `${minutes}m`;
}
