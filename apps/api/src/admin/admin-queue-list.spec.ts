import {
  adminQueueAgeCounts,
  adminQueueAgeDateWhere,
  adminQueueSlaDateWhere,
  adminQueueSlaSummary,
  adminQueueSlaThresholdMinutes,
  adminQueueSlaWindow,
  adminQueueSortDirection,
  normalizeAdminQueueAge,
  normalizeAdminQueueSlaFilter,
} from './admin-queue-list';

describe('admin queue list query', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');

  it('builds non-overlapping operational age buckets', () => {
    expect(adminQueueAgeDateWhere('under-1h', now)).toEqual({
      gte: new Date('2026-07-19T11:00:00.000Z'),
      lte: now,
    });
    expect(adminQueueAgeDateWhere('1-4h', now)).toEqual({
      gte: new Date('2026-07-19T08:00:00.000Z'),
      lt: new Date('2026-07-19T11:00:00.000Z'),
    });
    expect(adminQueueAgeDateWhere('4-24h', now)).toEqual({
      gte: new Date('2026-07-18T12:00:00.000Z'),
      lt: new Date('2026-07-19T08:00:00.000Z'),
    });
    expect(adminQueueAgeDateWhere('over-24h', now)).toEqual({
      lt: new Date('2026-07-18T12:00:00.000Z'),
    });
  });

  it('fails unknown age values back to the full queue and keeps newest as the compatibility default', () => {
    expect(normalizeAdminQueueAge('unexpected')).toBe('all');
    expect(adminQueueAgeDateWhere('unexpected', now)).toBeUndefined();
    expect(adminQueueSortDirection(undefined)).toBe('desc');
    expect(adminQueueSortDirection('oldest')).toBe('asc');
  });

  it('loads every age bucket through one bounded count contract', async () => {
    const countForAge = vi.fn(async (age: string) => age.length);

    await expect(adminQueueAgeCounts(countForAge)).resolves.toEqual({
      all: 3,
      'under-1h': 8,
      '1-4h': 4,
      '4-24h': 5,
      'over-24h': 8,
    });
    expect(countForAge).toHaveBeenCalledTimes(5);
  });

  it('counts overdue rows from the persisted SLA policy boundary', async () => {
    const countOverdue = vi.fn().mockResolvedValue(7);

    await expect(
      adminQueueSlaSummary({
        countOverdue,
        defaultThresholdMinutes: 60,
        now: new Date('2026-07-19T08:00:00.000Z'),
        readPolicyValue: async () => 45,
      }),
    ).resolves.toEqual({ overdueCount: 7, thresholdMinutes: 45 });
    expect(countOverdue).toHaveBeenCalledWith(new Date('2026-07-19T07:15:00.000Z'));
  });

  it('falls back to the canonical SLA when the saved value is invalid', () => {
    expect(adminQueueSlaThresholdMinutes(null, 120)).toBe(120);
    expect(adminQueueSlaThresholdMinutes('240', 120)).toBe(240);
    expect(adminQueueSlaThresholdMinutes(0, 120)).toBe(120);
  });

  it('normalizes the opt-in SLA filter without narrowing unknown query values', () => {
    expect(normalizeAdminQueueSlaFilter('overdue')).toBe('overdue');
    expect(normalizeAdminQueueSlaFilter('within')).toBe('within');
    expect(normalizeAdminQueueSlaFilter('overdue-under-24h')).toBe('overdue-under-24h');
    expect(normalizeAdminQueueSlaFilter('critical')).toBe('critical');
    expect(normalizeAdminQueueSlaFilter('unexpected')).toBe('all');
    expect(normalizeAdminQueueSlaFilter(undefined)).toBe('all');
  });

  it('builds mutually exclusive action-oriented SLA date filters', () => {
    const window = { cutoffAt: new Date('2026-07-19T11:00:00.000Z'), thresholdMinutes: 60 };

    expect(adminQueueSlaDateWhere('within', window, now)).toEqual({
      gt: new Date('2026-07-19T11:00:00.000Z'),
    });
    expect(adminQueueSlaDateWhere('overdue-under-24h', window, now)).toEqual({
      gt: new Date('2026-07-18T12:00:00.000Z'),
      lte: new Date('2026-07-19T11:00:00.000Z'),
    });
    expect(adminQueueSlaDateWhere('critical', window, now)).toEqual({
      lte: new Date('2026-07-18T12:00:00.000Z'),
    });
    expect(adminQueueSlaDateWhere('overdue', window, now)).toEqual({
      lte: new Date('2026-07-19T11:00:00.000Z'),
    });
    expect(adminQueueSlaDateWhere('all', window, now)).toBeUndefined();
  });

  it('keeps critical and non-critical overdue filters disjoint for an SLA over 24 hours', () => {
    const window = { cutoffAt: new Date('2026-07-17T12:00:00.000Z'), thresholdMinutes: 2_880 };

    expect(adminQueueSlaDateWhere('overdue-under-24h', window, now)).toEqual({
      gt: new Date('2026-07-18T12:00:00.000Z'),
      lte: new Date('2026-07-17T12:00:00.000Z'),
    });
    expect(adminQueueSlaDateWhere('critical', window, now)).toEqual({
      lte: new Date('2026-07-17T12:00:00.000Z'),
    });
  });

  it('exposes one exact policy cutoff for list and count queries', async () => {
    await expect(
      adminQueueSlaWindow({
        defaultThresholdMinutes: 60,
        now,
        readPolicyValue: async () => 15,
      }),
    ).resolves.toEqual({
      cutoffAt: new Date('2026-07-19T11:45:00.000Z'),
      thresholdMinutes: 15,
    });
  });
});
