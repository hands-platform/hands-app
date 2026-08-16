import { headers } from 'next/headers';
import { readFileSync } from 'node:fs';

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
    const sessionSecret = 'test-session-secret-with-32-characters';
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

  it('reuses already loaded operator access without recording an allowed page view', async () => {
    const sessionSecret = 'test-session-secret-with-32-characters';
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
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the configured env Master Admin unrestricted when a stored ADMIN row exists', async () => {
    const sessionSecret = 'test-session-secret-with-32-characters';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_WEB_LOGIN_EMAIL: 'master@example.com',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
    };
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'stored-master-1',
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}`,
      }) as never,
    );
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/admin/users/admin-operator-access')) {
        return Response.json({
          categories: [],
          email: 'master@example.com',
          id: 'stored-master-1',
          roles: ['ADMIN'],
        });
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true });
      }
      return new Response('{}', { status: 404 });
    });

    const access = await getAdminOperatorPageAccess('/bookings');

    expect(access).toMatchObject({
      allowed: true,
      category: 'BOOKINGS_REALTIME',
      access: {
        id: 'stored-master-1',
        roles: ['ADMIN', 'MASTER_ADMIN'],
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/users/admin-operator-access'),
      expect.any(Object),
    );
  });

  it('wraps the current operator access lookup in the React server request cache', () => {
    const source = readFileSync('lib/admin-operator-access.ts', 'utf8');

    expect(source).toContain("import { cache } from 'react';");
    expect(source).toContain('export const getCurrentAdminOperatorAccess = cache(async function getCurrentAdminOperatorAccess()');
  });
});
