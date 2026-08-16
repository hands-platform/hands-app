import { createAdminWebSessionCookieValue } from '../../../../../lib/admin-session';

describe('Admin web session logout route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('clears the admin session cookie with no-store headers', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: { accept: 'application/json', origin: 'http://localhost' },
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { ok?: boolean };
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });

  it('clears the admin session cookie as Secure in production', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: { accept: 'application/json', origin: 'http://localhost' },
        method: 'POST',
      }),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
  });

  it('revokes the database-backed session before clearing its browser cookie', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_API_BASE_URL: 'http://localhost:3000/api',
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      jti: 'session-to-revoke',
      secret: sessionSecret,
      sub: 'operator-user-1',
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: {
          accept: 'application/json',
          cookie: `hands_admin_session=${sessionCookie}`,
          origin: 'http://localhost',
        },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/admin-operators/me/session/revoke',
      expect.objectContaining({ method: 'POST', cache: 'no-store' }),
    );
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('fails visibly and preserves the cookie when server-side revocation fails', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      jti: 'session-revoke-failure',
      secret: sessionSecret,
      sub: 'operator-user-1',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: {
          accept: 'application/json',
          cookie: `hands_admin_session=${sessionCookie}`,
          origin: 'http://localhost',
        },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: 'ADMIN_SESSION_REVOCATION_FAILED',
      ok: false,
    });
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears the cookie when the database session is already inactive', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      jti: 'already-revoked-session',
      secret: sessionSecret,
      sub: 'operator-user-1',
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: {
          accept: 'application/json',
          cookie: `hands_admin_session=${sessionCookie}`,
          origin: 'http://localhost',
        },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  it('rejects an explicit cross-site logout request', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: { accept: 'application/json', origin: 'https://attacker.example' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'CROSS_SITE_LOGOUT_REJECTED' });
  });
});
