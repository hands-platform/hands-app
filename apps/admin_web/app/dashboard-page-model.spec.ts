import { buildDashboardDetailsHref, buildDashboardViewMode } from './dashboard-page-model';

describe('dashboard page model', () => {
  it('keeps the default dashboard in summary mode', () => {
    expect(buildDashboardViewMode({})).toEqual({
      detailsMode: 'summary',
      shouldRenderFullDashboard: false,
    });
  });

  it('enables the full dashboard only when details=all is explicit', () => {
    expect(buildDashboardViewMode({ details: 'all' })).toEqual({
      detailsMode: 'all',
      shouldRenderFullDashboard: true,
    });
    expect(buildDashboardViewMode({ details: 'unexpected' }).shouldRenderFullDashboard).toBe(false);
  });

  it('preserves range filters when building summary and full dashboard links', () => {
    expect(buildDashboardDetailsHref('all', { range: '7d' })).toBe('/?range=7d&details=all');
    expect(buildDashboardDetailsHref('summary', { range: '7d', details: 'all' })).toBe('/?range=7d');
    expect(buildDashboardDetailsHref('summary', {})).toBe('/');
  });
});
