import { headers } from 'next/headers';

import { getAdminOperatorPageAccess } from './admin-operator-access';
import type { AdminOperatorAccess } from './admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from './admin-session';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('admin operator page access', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('fails closed when a protected Admin page has no operator category mapping', async () => {
    const sessionSecret = 'test-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
    };
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'operator@example.com',
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}`,
      }) as never,
    );
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/admin/users/admin-operator-access')) {
        return Response.json({
          categories: ['BOOKINGS_REALTIME'],
          email: 'operator@example.com',
          id: 'operator-1',
          roles: ['ADMIN'],
        });
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      return new Response('{}', { status: 404 });
    });

    const access = await getAdminOperatorPageAccess('/new-sensitive-admin-page');

    expect(access).toMatchObject({
      allowed: false,
      category: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/operator-activity'),
      expect.objectContaining({
        body: expect.stringContaining('unmapped_admin_page'),
        method: 'POST',
      }),
    );
  });

  it('reuses already loaded operator access while still recording page activity', async () => {
    const sessionSecret = 'test-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
    };
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'operator@example.com',
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}`,
      }) as never,
    );
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/admin/users/admin-operator-access')) {
        throw new Error('operator access should be reused from layout');
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      return new Response('{}', { status: 404 });
    });
    const loadedAccess: AdminOperatorAccess = {
      categories: ['BOOKINGS_REALTIME'],
      email: 'operator@example.com',
      id: 'operator-1',
      roles: ['ADMIN'],
    };

    const access = await getAdminOperatorPageAccess('/bookings', loadedAccess);

    expect(access).toMatchObject({
      allowed: true,
      category: 'BOOKINGS_REALTIME',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/operator-activity'),
      expect.objectContaining({
        body: expect.stringContaining('admin_web.page_view'),
        method: 'POST',
      }),
    );
  });
});
