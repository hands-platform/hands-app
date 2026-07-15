import {
  combinedDashboardSourceState,
  dashboardMetricWithSourceState,
  dashboardSourceState,
} from './dashboard-trace-summary';

describe('dashboard trace summary model', () => {
  it('distinguishes fresh, stale, invalid, and unavailable sources', () => {
    const now = new Date('2026-07-15T03:00:00.000Z');
    vi.setSystemTime(now);

    expect(dashboardSourceState({}, '2026-07-15T02:59:00.000Z')).toBe('available');
    expect(dashboardSourceState({}, '2026-07-15T02:54:59.000Z')).toBe('stale');
    expect(dashboardSourceState({}, 'not-a-date')).toBe('stale');
    expect(dashboardSourceState(null, now.toISOString())).toBe('unavailable');

    vi.useRealTimers();
  });

  it('prioritizes unavailable sources over stale sources', () => {
    expect(combinedDashboardSourceState(['available', 'stale'])).toBe('stale');
    expect(combinedDashboardSourceState(['stale', 'unavailable'])).toBe('unavailable');
    expect(combinedDashboardSourceState(['available'])).toBe('available');
  });

  it('keeps fresh metrics and turns unhealthy sources into actionable risk metrics', () => {
    const metric = { label: 'Payment holds', value: 4 } as const;

    expect(dashboardMetricWithSourceState(metric, 'available', '/')).toBe(metric);
    expect(dashboardMetricWithSourceState(metric, 'stale', '/?refresh=1')).toMatchObject({
      helper: 'Refresh to load current data.',
      href: '/?refresh=1',
      kind: 'risk',
      scope: 'Stale',
      value: 4,
    });
    expect(dashboardMetricWithSourceState(metric, 'unavailable', '/?refresh=1')).toMatchObject({
      helper: 'This data source did not respond.',
      kind: 'risk',
      scope: 'Data unavailable',
      value: 'Unavailable',
    });
  });
});
