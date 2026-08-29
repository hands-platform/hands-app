import { renderToStaticMarkup } from 'react-dom/server';
import {
  combinedDashboardSourceState,
  DashboardDataScopeStatus,
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

  it('uses one scope and freshness vocabulary across dashboard consumers', () => {
    const generatedAt = '2026-07-15T02:59:00.000Z';
    const freshMarkup = renderToStaticMarkup(
      <DashboardDataScopeStatus
        generatedAt={generatedAt}
        refreshSeconds={60}
        scope="current-shift"
        sourceState="available"
      />,
    );
    const partialMarkup = renderToStaticMarkup(
      <DashboardDataScopeStatus
        generatedAt={generatedAt}
        partialSourceCount={2}
        scope="today"
        sourceState="available"
      />,
    );
    const staleMarkup = renderToStaticMarkup(
      <DashboardDataScopeStatus generatedAt={generatedAt} scope="historical" sourceState="stale" />,
    );
    const unavailableMarkup = renderToStaticMarkup(
      <DashboardDataScopeStatus scope="all-open" sourceState="unavailable" />,
    );

    expect(freshMarkup).toContain('Shift activity · Today (Vietnam)');
    expect(freshMarkup).toContain('Updated');
    expect(freshMarkup).toContain('ICT · Command data current');
    expect(freshMarkup).toContain('Test data excluded');
    expect(freshMarkup).toContain('Checks for updates every 60s');
    expect(partialMarkup).toContain('Today');
    expect(partialMarkup).toContain('Partial data · 2 sources unavailable · updated');
    expect(staleMarkup).toContain('Historical');
    expect(staleMarkup).toContain('Source delayed · updated');
    expect(unavailableMarkup).toContain('All open');
    expect(unavailableMarkup).toContain('Source unavailable');
  });
});
