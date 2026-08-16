import { createAdminWebSessionCookieValue } from '../../../../../lib/admin-session';

describe('Admin web session me route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_WEB_API_TOKEN_SECRET = 'test-admin-web-api-secret-with-32-chars';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('returns unauthenticated when no admin session exists', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/session/me'));
    const body = (await response.json()) as { authenticated?: boolean; role?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.authenticated).toBe(false);
    expect(body.role).toBeUndefined();
  });

  it('returns the authenticated admin role for a valid session cookie', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/session/me', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { authenticated?: boolean; role?: string; sub?: string; token?: string };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ authenticated: true, role: 'ADMIN', sub: 'admin@hands.vn' });
    expect(body.token).toBeUndefined();
  });

  it('rejects an expired or tampered session cookie', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const expiredSession = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() - 1_000,
      secret: sessionSecret,
      sub: 'admin@hands.vn',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/session/me', {
        headers: { cookie: `hands_admin_session=${expiredSession}tampered` },
      }),
    );
    const body = (await response.json()) as { authenticated?: boolean };

    expect(response.status).toBe(401);
    expect(body.authenticated).toBe(false);
  });

  it('rejects a signed session cookie when the payload role is not ADMIN', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const nonAdminSession = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      role: 'CUSTOMER' as never,
      secret: sessionSecret,
      sub: 'customer@hands.vn',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/session/me', {
        headers: { cookie: `hands_admin_session=${nonAdminSession}` },
      }),
    );
    const body = (await response.json()) as { authenticated?: boolean; role?: string; token?: string };

    expect(response.status).toBe(401);
    expect(body.authenticated).toBe(false);
    expect(body.role).toBeUndefined();
    expect(body.token).toBeUndefined();
  });
});
