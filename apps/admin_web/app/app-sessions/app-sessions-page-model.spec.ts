import {
  buildAppSessionApiHref,
  buildAppSessionCanonicalPageHref,
  buildAppSessionSummaryApiHref,
  buildSessionFilters,
  sessionFilterHref,
  sessionFilterLabel,
} from './app-sessions-page-model';

describe('app sessions page model', () => {
  it('keeps the default admin app-session API request bounded', () => {
    const filters = buildSessionFilters({});

    expect(buildAppSessionApiHref(filters)).toBe('/admin/app-sessions?take=10&state=live');
    expect(buildAppSessionSummaryApiHref(filters)).toBe('/admin/app-sessions/summary?state=live');
    expect(sessionFilterHref(filters)).toBe('/app-sessions');
    expect(sessionFilterLabel(filters)).toBe('Showing live Customer and Partner app sessions');
  });

  it('passes role, state, platform, and search filters through to the API href', () => {
    const filters = buildSessionFilters({
      page: '3',
      platform: ' IOS ',
      q: ' 8490 ',
      role: 'partner',
      state: 'live',
    });

    expect(buildAppSessionApiHref(filters)).toBe(
      '/admin/app-sessions?take=10&role=PROVIDER&state=live&platform=ios&q=8490&skip=20',
    );
    expect(buildAppSessionSummaryApiHref(filters)).toBe(
      '/admin/app-sessions/summary?role=PROVIDER&state=live&platform=ios&q=8490',
    );
    expect(sessionFilterHref(filters)).toBe('/app-sessions?role=PROVIDER&state=live&platform=ios&q=8490&page=3');
    expect(sessionFilterLabel(filters)).toBe(
      'Filtered to partner sessions, live heartbeat, ios platform, search "8490"',
    );
  });

  it('canonicalizes an out-of-range page while preserving the complete filter scope', () => {
    const filters = buildSessionFilters({
      page: '999',
      pageSize: '10',
      platform: 'ios',
      q: '8490',
      role: 'provider',
      state: 'expired',
    });

    expect(buildAppSessionCanonicalPageHref(filters, 331)).toBe(
      '/app-sessions?role=PROVIDER&state=expired&platform=ios&q=8490&page=34',
    );
    expect(buildAppSessionCanonicalPageHref(filters, 0)).toBeNull();
    expect(buildAppSessionCanonicalPageHref({ ...filters, page: 34 }, 331)).toBeNull();
  });
});
