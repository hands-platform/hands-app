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

    mockedAdminGet.mockResolvedValue([serverSession]);

    const page = await AppSessionsPage({
      searchParams: Promise.resolve({ role: 'PROVIDER', state: 'live' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/app-sessions?take=25&role=PROVIDER&state=live',
      [],
    );
    expect(markup).toContain('Server Trusted Session');
  });
});
