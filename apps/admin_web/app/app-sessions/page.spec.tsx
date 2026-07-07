import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import type { AdminAppSession } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import AppSessionsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const globalCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('AppSessionsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
  });

  it('renders bounded server app-session rows without applying a second local filter', async () => {
    const serverSession = {
      active: false,
      appVersion: '1.0.0',
      createdAt: '2026-06-28T09:00:00.000Z',
      deviceId: 'server-device-token',
      expiresAt: '2026-06-28T09:01:00.000Z',
      id: 'server-session-row',
      ipAddress: '10.0.0.10',
      lastSeenAt: '2026-06-28T09:00:00.000Z',
      platform: 'IOS',
      role: 'CUSTOMER',
      updatedAt: '2026-06-28T09:00:00.000Z',
      user: {
        fullName: 'Server Trusted Session',
        id: 'server-user-row',
        phone: '+84900003333',
      },
      userId: 'server-user-row',
    } as AdminAppSession;

    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (String(href).startsWith('/admin/app-sessions/summary')) {
        return {
          expired: 2,
          generatedAt: '2026-06-28T09:00:00.000Z',
          liveCustomers: 17,
          livePartners: 9,
          recent: 7,
          recentCustomers: 5,
          recentPartners: 2,
          stale: 4,
          totalCount: 120,
        };
      }

      if (String(href).startsWith('/admin/app-sessions')) {
        return [serverSession];
      }

      return fallback;
    });

    const page = await AppSessionsPage({
      searchParams: Promise.resolve({ role: 'PROVIDER', state: 'live' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/app-sessions?take=10&role=PROVIDER&state=live', []);
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/app-sessions/summary?role=PROVIDER&state=live', null);
    expect(markup).toContain('Server Trusted Session');
    expect(markup).toContain('>17<');
    expect(markup).toContain('>9<');
    expect(markup).toContain('>7<');
    expect(markup).toContain('>4<');
    expect(markup).toContain('>2<');
    expect(markup).toContain('card admin-section vuexy-booking-table-card vuexy-booking-table-group');
  });

  it('uses the shared StatusBadge atom for the loaded session count', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/page.tsx'), 'utf8');

    expect(source).toContain('AdminTableSection');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('<span className="pill pill-info">{sessions.length} loaded</span>');
  });

  it('uses the shared AdminFormControlLink atom for page header actions', () => {
    const source = readFileSync(join(process.cwd(), 'app/app-sessions/page.tsx'), 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('scopes app session and file section headers to direct page cards', () => {
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header,');
    expect(globalCss).toContain('.files-page > .card > .ops-section-header {');
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header > div,');
    expect(globalCss).toContain('.files-page > .card > .ops-section-header > div {');
    expect(globalCss).toContain('.app-sessions-page > .card > .ops-section-header > .participant-list,');
    expect(globalCss).toContain('.files-page > .card > .ops-section-header > .participant-list {');
    expect(globalCss).not.toContain('.app-sessions-page .ops-section-header,');
    expect(globalCss).not.toContain('.files-page .ops-section-header {');
  });
});
