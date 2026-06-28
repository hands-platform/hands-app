import {
  buildAppSessionApiHref,
  buildSessionFilters,
  sessionFilterHref,
  sessionFilterLabel,
} from './app-sessions-page-model';

describe('app sessions page model', () => {
  it('keeps the default admin app-session API request bounded', () => {
    const filters = buildSessionFilters({});

    expect(buildAppSessionApiHref(filters)).toBe('/admin/app-sessions?take=10&state=live');
    expect(sessionFilterHref(filters)).toBe('/app-sessions');
    expect(sessionFilterLabel(filters)).toBe('Showing live customer, partner, and admin app sessions');
  });

  it('passes role, state, platform, and search filters through to the API href', () => {
    const filters = buildSessionFilters({
      platform: ' IOS ',
      q: ' 8490 ',
      role: 'partner',
      state: 'live',
    });

    expect(buildAppSessionApiHref(filters)).toBe(
      '/admin/app-sessions?take=10&role=PROVIDER&state=live&platform=ios&q=8490',
    );
    expect(sessionFilterHref(filters)).toBe('/app-sessions?role=PROVIDER&state=live&platform=ios&q=8490');
    expect(sessionFilterLabel(filters)).toBe(
      'Filtered to partner sessions, live heartbeat, ios platform, search "8490"',
    );
  });
});
