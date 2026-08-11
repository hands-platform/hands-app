import {
  ADMIN_USAGE_CUSTOM_RANGE_MAX_DAYS,
  adminUsageComparisonWindow,
  adminUsageDateWhere,
  adminUsageRangeWindow,
  buildAdminUsageRegionRows,
  normalizeAdminUsageRange,
} from './admin-usage-overview';

describe('admin usage overview helpers', () => {
  const now = new Date('2026-06-22T10:20:30.000Z');

  it('normalizes supported range filters and defaults to today', () => {
    expect(normalizeAdminUsageRange(undefined)).toBe('today');
    expect(normalizeAdminUsageRange('today')).toBe('today');
    expect(normalizeAdminUsageRange('yesterday')).toBe('yesterday');
    expect(normalizeAdminUsageRange('30d')).toBe('30d');
    expect(normalizeAdminUsageRange('month')).toBe('month');
    expect(normalizeAdminUsageRange('custom')).toBe('custom');
    expect(normalizeAdminUsageRange('all')).toBe('today');
    expect(normalizeAdminUsageRange('bad-input')).toBe('today');
  });

  it('builds bounded Vietnam-time windows for today, yesterday, 7 days, 30 days, and month', () => {
    expect(adminUsageRangeWindow('today', now)).toMatchObject({
      range: 'today',
      label: 'Today',
      startAt: new Date('2026-06-21T17:00:00.000Z'),
      endAt: now,
      fromDate: '2026-06-22',
      toDate: '2026-06-22',
    });

    expect(adminUsageRangeWindow('yesterday', now)).toMatchObject({
      range: 'yesterday',
      label: 'Yesterday',
      startAt: new Date('2026-06-20T17:00:00.000Z'),
      endAt: new Date('2026-06-21T17:00:00.000Z'),
    });

    expect(adminUsageRangeWindow('7d', now)).toMatchObject({
      range: '7d',
      label: 'Last 7 days',
      startAt: new Date('2026-06-15T17:00:00.000Z'),
      endAt: now,
    });

    expect(adminUsageRangeWindow('30d', now)).toMatchObject({
      range: '30d',
      label: 'Last 30 days',
      startAt: new Date('2026-05-23T17:00:00.000Z'),
      endAt: now,
    });

    expect(adminUsageRangeWindow('month', now)).toMatchObject({
      range: 'month',
      label: 'This month',
      startAt: new Date('2026-05-31T17:00:00.000Z'),
      endAt: now,
    });
  });

  it('accepts valid custom periods and rejects reversed, future, invalid, and over-90-day input', () => {
    expect(adminUsageRangeWindow('custom', now, '2026-06-10', '2026-06-12')).toMatchObject({
      range: 'custom',
      startAt: new Date('2026-06-09T17:00:00.000Z'),
      endAt: new Date('2026-06-12T17:00:00.000Z'),
      fromDate: '2026-06-10',
      toDate: '2026-06-12',
    });

    expect(() => adminUsageRangeWindow('custom', now, '2025-01-01', '2026-06-22')).toThrow(
      `${ADMIN_USAGE_CUSTOM_RANGE_MAX_DAYS} days`,
    );
    expect(() => adminUsageRangeWindow('custom', now, '2026-06-12', '2026-06-10')).toThrow(
      'From date must be on or before To date',
    );
    expect(() => adminUsageRangeWindow('custom', now, '2026-06-22', '2026-06-23')).toThrow(
      'future date',
    );
    expect(() => adminUsageRangeWindow('custom', now, 'invalid', '2026-06-22')).toThrow(
      'valid From and To dates',
    );
  });

  it('builds an equal-length previous comparison window', () => {
    const current = adminUsageRangeWindow('7d', now);
    const previous = adminUsageComparisonWindow(current);

    expect(previous).toMatchObject({
      endAt: current.startAt,
      label: 'Previous last 7 days',
    });
    expect(previous!.endAt!.getTime() - previous!.startAt!.getTime()).toBe(
      current.endAt!.getTime() - current.startAt!.getTime(),
    );
    expect(previous).toMatchObject({ fromDate: '2026-06-09', toDate: '2026-06-15' });
  });

  it('does not expose an unbounded all-time range and emits end-exclusive date filters', () => {
    expect(adminUsageRangeWindow('all' as never, now)).toMatchObject({
      range: 'today',
      label: 'Today',
    });
    expect(adminUsageDateWhere(adminUsageRangeWindow('today', now))).toEqual({
      gte: new Date('2026-06-21T17:00:00.000Z'),
      lt: now,
    });
  });

  it('builds regionCode usage aggregates without returning individual GPS points', () => {
    const rows = buildAdminUsageRegionRows([
      {
        regionValues: ['Cầu Giấy, Hà Nội'],
        customerSessionCount: 1,
      },
      {
        regionValues: ['22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City'],
        bookingRequestCount: 2,
      },
      {
        regionValues: ['Smoke booking address'],
        coordinates: { latitude: 10.7769, longitude: 106.7009 },
        completedBookingCount: 1,
      },
    ]);

    expect(rows.find((row) => row.regionCode === 'hanoi')).toMatchObject({
      regionName: 'Ha Noi',
      customerSessionCount: 1,
      bookingRequestCount: 0,
      completedBookingCount: 0,
    });
    expect(rows.find((row) => row.regionCode === 'hcm')).toMatchObject({
      customerSessionCount: 0,
      bookingRequestCount: 2,
      completedBookingCount: 1,
    });
    expect(rows.find((row) => row.regionCode === 'hcm')).not.toHaveProperty('latitude');
    expect(rows.find((row) => row.regionCode === 'hcm')).not.toHaveProperty('longitude');
  });
});
