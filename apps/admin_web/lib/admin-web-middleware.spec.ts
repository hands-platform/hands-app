import { NextRequest } from 'next/server';
import { createAdminWebSessionCookieValue } from './admin-session';

describe('Admin web proxy', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('redirects unauthenticated admin pages to login', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { proxy } = await import('../proxy');

    const response = await proxy(new NextRequest('http://localhost/bookings?view=matching'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost/login?redirectTo=%2Fbookings%3Fview%3Dmatching');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns 401 for unauthenticated browser-facing admin API routes', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { proxy } = await import('../proxy');

    const response = await proxy(new NextRequest('http://localhost/api/admin/bookings/cmq/chat-messages'));
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('allows login and session routes without an existing session', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { proxy } = await import('../proxy');

    const loginPageResponse = await proxy(new NextRequest('http://localhost/login'));
    const loginRouteResponse = await proxy(new NextRequest('http://localhost/api/admin/session/login'));

    expect(loginPageResponse.headers.get('x-middleware-next')).toBe('1');
    expect(loginRouteResponse.headers.get('x-middleware-next')).toBe('1');
  });

  it('allows protected admin pages with a valid session cookie', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { proxy } = await import('../proxy');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          authenticated: true,
          mfaEnrollmentRequired: false,
          operatorAccess: {
            categories: ['PARTNERS_DIRECTORY'],
            id: 'admin@hands.vn',
            roles: ['ADMIN'],
          },
        }),
      ),
    );

    const response = await proxy(
      new NextRequest('http://localhost/partners?review=approval-pending&sort=oldest', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('x-middleware-request-x-admin-pathname')).toBe(
      '/partners?review=approval-pending&sort=oldest',
    );
    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-id')).toBe('admin@hands.vn');
    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-roles')).toBe('ADMIN');
    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-categories')).toBe(
      'PARTNERS_DIRECTORY',
    );
  });

  it('removes spoofed operator access headers when the server does not return access', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ authenticated: true, mfaEnrollmentRequired: false })),
    );
    const { proxy } = await import('../proxy');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });

    const response = await proxy(
      new NextRequest('http://localhost/bookings', {
        headers: {
          cookie: `hands_admin_session=${sessionCookie}`,
          'x-hands-admin-operator-categories': 'SYSTEM',
          'x-hands-admin-operator-id': 'attacker',
          'x-hands-admin-operator-roles': 'MASTER_ADMIN',
        },
      }),
    );

    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-categories')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-id')).toBeNull();
    expect(response.headers.get('x-middleware-request-x-hands-admin-operator-roles')).toBeNull();
  });

  it('rejects a signed cookie after the server session is revoked', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ authenticated: false }, { status: 401 })));
    const { proxy } = await import('../proxy');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });

    const response = await proxy(
      new NextRequest('http://localhost/bookings', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login?redirectTo=%2Fbookings');
  });

  it('keeps an enrollment-only session inside the MFA setup workspace', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(Response.json({ authenticated: true, mfaEnrollmentRequired: true })),
      ),
    );
    const { proxy } = await import('../proxy');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      mfaEnrollmentRequired: true,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });

    const redirected = await proxy(
      new NextRequest('http://localhost/finance-overview', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const setup = await proxy(
      new NextRequest('http://localhost/admin-operators?mfa=setup', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );

    expect(redirected.headers.get('location')).toBe('http://localhost/admin-operators?mfa=setup');
    expect(setup.headers.get('x-middleware-next')).toBe('1');
  });

  it('does not middleware-block realtime token route so route-level dev fallback can apply', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: 'true',
      NODE_ENV: 'test',
    };
    const { proxy } = await import('../proxy');

    const response = await proxy(new NextRequest('http://localhost/api/admin/realtime-token'));

    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
});
