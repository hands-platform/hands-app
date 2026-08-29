import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminAppSessionDirectoryRow } from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import AppSessionsPage from './page';

const { mockedRedirect } = vi.hoisted(() => ({ mockedRedirect: vi.fn() }));

vi.mock('next/navigation', () => ({ redirect: mockedRedirect }));

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const globalCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('AppSessionsPage', () => {
  beforeEach(() => {
    mockedRedirect.mockReset();
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));
  });

  it('renders bounded server app-session rows without applying a second local filter', async () => {
    const serverSession = {
      active: false,
      appVersion: '1.0.0',
      deviceId: 'server-device-token',
      expiresAt: '2026-06-28T09:01:00.000Z',
      id: 'server-session-row',
      ipAddress: '10.0.0.10',
      lastSeenAt: '2026-06-28T09:00:00.000Z',
      platform: 'IOS',
      role: 'CUSTOMER',
      user: {
        fullName: 'Server Trusted Session',
        id: 'server-user-row',
        phone: '+84900003333',
      },
      userId: 'server-user-row',
    } as AdminAppSessionDirectoryRow;

    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).startsWith('/admin/app-sessions/summary')) {
        return {
          data: {
            expired: 2,
            generatedAt: '2026-06-28T09:00:00.000Z',
            liveCustomers: 17,
            livePartners: 9,
            recent: 7,
            recentCustomers: 5,
            recentPartners: 2,
            stale: 4,
            totalCount: 120,
          },
          ok: true,
          status: 200,
        };
      }

      if (String(href).startsWith('/admin/app-sessions')) {
        return { data: [serverSession], ok: true, status: 200 };
      }

      return { data: fallback, ok: true, status: 200 };
    });

    const page = await AppSessionsPage({
      searchParams: Promise.resolve({ role: 'PROVIDER', state: 'live' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('<h1>App Session Diagnostics</h1>');
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/app-sessions?take=10&role=PROVIDER&state=live', []);
    expect(mockedAdminGetResult).toHaveBeenCalledWith('/admin/app-sessions/summary?role=PROVIDER&state=live', null);
    expect(markup).toContain('Server Trusted Session');
    expect(markup).toContain('>17<');
    expect(markup).toContain('>9<');
    expect(markup).toContain('>7<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('>2<');
    expect(markup).toContain('<span class="metric-card-scope is-live">Live</span>');
    expect(markup).toContain('<span class="metric-card-scope is-risk">Needs action</span>');
    expect(markup).toContain('<span class="metric-card-scope is-record">Filtered records</span>');
    expect(markup).toContain('<p>Filtered records</p>');
    expect(markup).not.toContain('<p>Loaded sessions</p>');
    expect(markup).toContain('Current page sample — 1 of 120');
    expect(markup).toContain('Current page role split');
    expect(markup).toContain('Current page platform and version');
    expect(markup).toContain('Current page review queue');
    expect(markup).not.toMatch(/>(?:Clear|Ready|Fresh)</u);
    expect(markup).toContain('card admin-section vuexy-booking-table-card vuexy-booking-table-group');
  });

  it('uses the shared StatusBadge atom for the loaded session count', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/page.tsx'), 'utf8');

    expect(source).toContain('AdminTableSection');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<span className="pill pill-info">{sessions.length} loaded</span>');
  });

  it('keeps only the notification delivery action in the page header', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).includes('/summary')
        ? { expired: 0, generatedAt: '2026-08-08T00:00:00.000Z', liveCustomers: 1, livePartners: 0, recent: 0, recentCustomers: 0, recentPartners: 0, stale: 0, totalCount: 1 }
        : fallback,
      ok: true,
      status: 200,
    }));
    const page = await AppSessionsPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Open notification delivery');
    expect(markup).not.toContain('Shift command');
  });

  it('compresses a successful zero response into an explicit data-empty state', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).includes('/summary')
        ? { expired: 0, generatedAt: '2026-08-08T00:00:00.000Z', liveCustomers: 0, livePartners: 0, recent: 0, recentCustomers: 0, recentPartners: 0, stale: 0, totalCount: 0 }
        : fallback,
      ok: true,
      status: 200,
    }));

    const markup = renderToStaticMarkup(await AppSessionsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('No app session data');
    expect(markup).toContain('not a system health confirmation');
    expect(markup).not.toContain('metric-card-label');
    expect(mockedRedirect).not.toHaveBeenCalled();
  });

  it('redirects an out-of-range page to the last page without dropping filters', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: String(href).includes('/summary')
        ? { expired: 331, generatedAt: '2026-08-08T00:00:00.000Z', liveCustomers: 0, livePartners: 0, recent: 0, recentCustomers: 0, recentPartners: 0, stale: 0, totalCount: 331 }
        : fallback,
      ok: true,
      status: 200,
    }));

    await AppSessionsPage({
      searchParams: Promise.resolve({
        page: '999',
        pageSize: '10',
        platform: 'ios',
        q: '8490',
        role: 'PROVIDER',
        state: 'expired',
      }),
    });

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/app-sessions?role=PROVIDER&state=expired&platform=ios&q=8490&page=34',
    );
  });

  it('does not render zero metrics when a session API request fails', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: false,
      status: 503,
    }));

    const markup = renderToStaticMarkup(await AppSessionsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('App session data unavailable');
    expect(markup).toContain('Retry session data');
    expect(markup).not.toContain('metric-card-label');
  });

  it('scopes app session section headers to direct page cards', () => {
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header {');
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header > div {');
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header > .participant-list {');
    expect(globalCss).not.toContain('.app-sessions-page .ops-section-header {');
    expect(globalCss).not.toContain('.files-page');
  });
});
