import {
  adminUsageDateWhere,
  adminUsageRangeWindow,
  normalizeAdminUsageRange,
} from './admin-usage-overview';

describe('admin usage overview helpers', () => {
  const now = new Date('2026-06-22T10:20:30.000Z');

  it('normalizes supported range filters and defaults to 7 days', () => {
    expect(normalizeAdminUsageRange(undefined)).toBe('7d');
    expect(normalizeAdminUsageRange('today')).toBe('today');
    expect(normalizeAdminUsageRange('yesterday')).toBe('yesterday');
    expect(normalizeAdminUsageRange('month')).toBe('month');
    expect(normalizeAdminUsageRange('all')).toBe('all');
    expect(normalizeAdminUsageRange('bad-input')).toBe('7d');
  });

  it('builds bounded windows for today, yesterday, 7 days, and month without realtime GPS', () => {
    expect(adminUsageRangeWindow('today', now)).toMatchObject({
      range: 'today',
      label: 'Today',
      startAt: new Date('2026-06-22T00:00:00.000Z'),
      endAt: new Date('2026-06-23T00:00:00.000Z'),
    });

    expect(adminUsageRangeWindow('yesterday', now)).toMatchObject({
      range: 'yesterday',
      label: 'Yesterday',
      startAt: new Date('2026-06-21T00:00:00.000Z'),
      endAt: new Date('2026-06-22T00:00:00.000Z'),
    });

    expect(adminUsageRangeWindow('7d', now)).toMatchObject({
      range: '7d',
      label: 'Last 7 days',
      startAt: new Date('2026-06-16T00:00:00.000Z'),
      endAt: new Date('2026-06-23T00:00:00.000Z'),
    });

    expect(adminUsageRangeWindow('month', now)).toMatchObject({
      range: 'month',
      label: 'This month',
      startAt: new Date('2026-06-01T00:00:00.000Z'),
      endAt: new Date('2026-07-01T00:00:00.000Z'),
    });
  });

  it('keeps all-time range unbounded and emits Prisma-compatible date filters otherwise', () => {
    expect(adminUsageRangeWindow('all', now)).toMatchObject({
      range: 'all',
      label: 'All time',
      startAt: null,
      endAt: null,
    });

    expect(adminUsageDateWhere(adminUsageRangeWindow('all', now))).toBeUndefined();
    expect(adminUsageDateWhere(adminUsageRangeWindow('today', now))).toEqual({
      gte: new Date('2026-06-22T00:00:00.000Z'),
      lt: new Date('2026-06-23T00:00:00.000Z'),
    });
  });
});
