import { Prisma } from '@prisma/client';

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
export type AdminQueueSlaWindow = {
  cutoffAt: Date;
  thresholdMinutes: number;
};
export type AdminQueueSlaDateBounds = {
  afterAt?: Date;
  beforeAt?: Date;
};

const HOUR_MS = 60 * 60_000;

export function adminQueueAgeDateWhere(
  value: string | null | undefined,
  now = new Date(),
): Prisma.DateTimeFilter | undefined {
  const age = normalizeAdminQueueAge(value);
  const nowMs = now.getTime();

  switch (age) {
    case 'under-1h':
      return { gte: new Date(nowMs - HOUR_MS), lte: now };
    case '1-4h':
      return { gte: new Date(nowMs - 4 * HOUR_MS), lt: new Date(nowMs - HOUR_MS) };
    case '4-24h':
      return { gte: new Date(nowMs - 24 * HOUR_MS), lt: new Date(nowMs - 4 * HOUR_MS) };
    case 'over-24h':
      return { lt: new Date(nowMs - 24 * HOUR_MS) };
    case 'all':
    default:
      return undefined;
  }
}

export function adminQueueSortDirection(value: string | null | undefined): Prisma.SortOrder {
  return normalizeAdminQueueSort(value) === 'oldest' ? 'asc' : 'desc';
}

export function normalizeAdminQueueAge(value: string | null | undefined): AdminQueueAge {
  return value === 'under-1h' || value === '1-4h' || value === '4-24h' || value === 'over-24h'
    ? value
    : 'all';
}

export function normalizeAdminQueueSort(value: string | null | undefined): AdminQueueSort {
  return value === 'oldest' ? 'oldest' : 'newest';
}

export function normalizeAdminQueueSlaFilter(
  value: string | null | undefined,
): AdminQueueSlaFilter {
  return value === 'critical' ||
    value === 'overdue' ||
    value === 'overdue-under-24h' ||
    value === 'within'
    ? value
    : 'all';
}

export function adminQueueSlaDateWhere(
  value: string | null | undefined,
  window: AdminQueueSlaWindow,
  now = new Date(),
): Prisma.DateTimeFilter | undefined {
  const bounds = adminQueueSlaDateBounds(value, window, now);
  if (!bounds) return undefined;
  return {
    ...(bounds.afterAt ? { gt: bounds.afterAt } : {}),
    ...(bounds.beforeAt ? { lte: bounds.beforeAt } : {}),
  };
}

export function adminQueueSlaDateBounds(
  value: string | null | undefined,
  window: AdminQueueSlaWindow,
  now = new Date(),
): AdminQueueSlaDateBounds | undefined {
  const filter = normalizeAdminQueueSlaFilter(value);
  const criticalCutoffAt = new Date(now.getTime() - 24 * HOUR_MS);

  switch (filter) {
    case 'within':
      return { afterAt: window.cutoffAt };
    case 'overdue':
      return { beforeAt: window.cutoffAt };
    case 'overdue-under-24h':
      return { afterAt: criticalCutoffAt, beforeAt: window.cutoffAt };
    case 'critical':
      return {
        beforeAt: new Date(Math.min(window.cutoffAt.getTime(), criticalCutoffAt.getTime())),
      };
    case 'all':
    default:
      return undefined;
  }
}

export async function adminQueueAgeCounts(
  countForAge: (age: AdminQueueAge) => Promise<number>,
): Promise<AdminQueueAgeCounts> {
  const [all, underOneHour, oneToFourHours, fourToTwentyFourHours, overTwentyFourHours] =
    await Promise.all([
      countForAge('all'),
      countForAge('under-1h'),
      countForAge('1-4h'),
      countForAge('4-24h'),
      countForAge('over-24h'),
    ]);

  return {
    all: normalizeAdminQueueCount(all),
    'under-1h': normalizeAdminQueueCount(underOneHour),
    '1-4h': normalizeAdminQueueCount(oneToFourHours),
    '4-24h': normalizeAdminQueueCount(fourToTwentyFourHours),
    'over-24h': normalizeAdminQueueCount(overTwentyFourHours),
  };
}

export async function adminQueueSlaSummary(options: {
  countOverdue: (cutoffAt: Date) => Promise<number>;
  defaultThresholdMinutes: number;
  now?: Date;
  readPolicyValue: () => Promise<unknown>;
}): Promise<AdminQueueSlaSummary> {
  const { cutoffAt, thresholdMinutes } = await adminQueueSlaWindow(options);

  return {
    overdueCount: normalizeAdminQueueCount(await options.countOverdue(cutoffAt)),
    thresholdMinutes,
  };
}

export async function adminQueueSlaWindow(options: {
  defaultThresholdMinutes: number;
  now?: Date;
  readPolicyValue: () => Promise<unknown>;
}): Promise<AdminQueueSlaWindow> {
  const thresholdMinutes = adminQueueSlaThresholdMinutes(
    await options.readPolicyValue(),
    options.defaultThresholdMinutes,
  );
  const now = options.now ?? new Date();

  return {
    cutoffAt: new Date(now.getTime() - thresholdMinutes * 60_000),
    thresholdMinutes,
  };
}

export function adminQueueSlaThresholdMinutes(value: unknown, fallback: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  const normalizedFallback = Number.isFinite(fallback) && fallback > 0 ? Math.trunc(fallback) : 1;

  return Number.isInteger(parsed) && parsed > 0 ? parsed : normalizedFallback;
}

function normalizeAdminQueueCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value ?? 0)) : 0;
}
