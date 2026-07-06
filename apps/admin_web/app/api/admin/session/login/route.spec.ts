import { hashAdminWebPasswordForEnv } from '../../../../../lib/admin-session';

describe('Admin web session login route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('issues an HttpOnly admin session cookie for a stored operator credential verified by the API', async () => {
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_API_BASE_URL: 'http://localhost:3000/api',
      ADMIN_WEB_LOGIN_EMAIL: undefined,
      ADMIN_WEB_LOGIN_PASSWORD_HASH: undefined,
      ADMIN_WEB_LOGIN_PASSWORD_SALT: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      ADMIN_WEB_SESSION_TTL_SECONDS: '3600',
      NODE_ENV: 'production',
    };
    const fetchMock = vi.fn(async () =>
      Response.json({
        authenticated: true,
        user: {
          email: 'operator@hands.vn',
          id: 'ops-admin-1',
          roles: ['ADMIN'],
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          email: 'operator@hands.vn',
          password: 'temporary-password',
        }),
      }),
    );
    const body = (await response.json()) as {
      authenticated?: boolean;
      password?: string;
      role?: string;
      secret?: string;
      sub?: string;
      token?: string;
    };
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/admin/users/admin-operator-login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer server-admin-token',
          'content-type': 'application/json',
        }),
      }),
    );
    expect(body).toMatchObject({ authenticated: true, role: 'ADMIN', sub: 'ops-admin-1' });
    expect(body.password).toBeUndefined();
    expect(body.secret).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    const sessionPayload = decodeSessionCookiePayload(setCookie);
    expect(sessionPayload).toMatchObject({
      role: 'ADMIN',
      sessionVersion: 1,
      sub: 'ops-admin-1',
    });
  });

  it('issues an HttpOnly admin session cookie for valid credentials', async () => {
    const salt = 'test-admin-login-salt';
    process.env = {
      ...process.env,
      ADMIN_WEB_LOGIN_EMAIL: 'admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD_HASH: hashAdminWebPasswordForEnv('correct horse battery staple', salt),
      ADMIN_WEB_LOGIN_PASSWORD_SALT: salt,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      ADMIN_WEB_SESSION_TTL_SECONDS: '3600',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@hands.vn',
          password: 'correct horse battery staple',
        }),
      }),
    );
    const body = (await response.json()) as {
      authenticated?: boolean;
      password?: string;
      role?: string;
      secret?: string;
      token?: string;
    };
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body).toMatchObject({ authenticated: true, role: 'ADMIN' });
    expect(body.password).toBeUndefined();
    expect(body.secret).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=3600');
    expect(setCookie).not.toContain('correct horse battery staple');
    expect(setCookie).not.toContain(process.env.ADMIN_WEB_LOGIN_PASSWORD_HASH ?? 'missing');
    expect(setCookie).not.toContain(process.env.ADMIN_WEB_SESSION_COOKIE_SECRET ?? 'missing');
    const sessionPayload = decodeSessionCookiePayload(setCookie);
    expect(sessionPayload).toMatchObject({
      role: 'ADMIN',
      sessionVersion: 1,
      sub: 'admin@hands.vn',
    });
    expect(sessionPayload.ADMIN_ACCESS_TOKEN).toBeUndefined();
    expect(sessionPayload.password).toBeUndefined();
    expect(sessionPayload.passwordHash).toBeUndefined();
    expect(sessionPayload.secret).toBeUndefined();
  });

  it('falls back to configured master credentials when the stored operator API does not authenticate them', async () => {
    const salt = 'test-admin-login-salt';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_API_BASE_URL: 'http://localhost:3000/api',
      ADMIN_WEB_LOGIN_EMAIL: 'admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD_HASH: hashAdminWebPasswordForEnv('correct horse battery staple', salt),
      ADMIN_WEB_LOGIN_PASSWORD_SALT: salt,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      ADMIN_WEB_SESSION_TTL_SECONDS: '3600',
      NODE_ENV: 'production',
    };
    const fetchMock = vi.fn(async () =>
      Response.json({
        authenticated: false,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@hands.vn',
          password: 'correct horse battery staple',
        }),
      }),
    );
    const body = (await response.json()) as {
      authenticated?: boolean;
      role?: string;
      sub?: string;
      token?: string;
    };
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(body).toMatchObject({ authenticated: true, role: 'ADMIN', sub: 'admin@hands.vn' });
    expect(body.token).toBeUndefined();
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('rejects an invalid password without leaking credential details', async () => {
    const salt = 'test-admin-login-salt';
    process.env = {
      ...process.env,
      ADMIN_WEB_LOGIN_EMAIL: 'admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD_HASH: hashAdminWebPasswordForEnv('expected-password', salt),
      ADMIN_WEB_LOGIN_PASSWORD_SALT: salt,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ email: 'admin@hands.vn', password: 'wrong-password' }),
      }),
    );
    const body = (await response.json()) as { error?: string; password?: string; secret?: string; token?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(body.error).toBe('INVALID_ADMIN_CREDENTIALS');
    expect(body.password).toBeUndefined();
    expect(body.secret).toBeUndefined();
    expect(body.token).toBeUndefined();
  });

  it('fails closed in production when login configuration is missing', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_LOGIN_EMAIL: undefined,
      ADMIN_WEB_LOGIN_PASSWORD_HASH: undefined,
      ADMIN_WEB_LOGIN_PASSWORD_SALT: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: undefined,
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ email: 'admin@hands.vn', password: 'password' }),
      }),
    );
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('ADMIN_LOGIN_UNAVAILABLE');
    expect(body.token).toBeUndefined();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('fails closed in production when dev login fallback is enabled', async () => {
    const salt = 'test-admin-login-salt';
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_LOGIN: 'true',
      ADMIN_WEB_LOGIN_EMAIL: 'admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD: 'raw-production-password',
      ADMIN_WEB_LOGIN_PASSWORD_HASH: hashAdminWebPasswordForEnv('correct horse battery staple', salt),
      ADMIN_WEB_LOGIN_PASSWORD_SALT: salt,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@hands.vn',
          password: 'correct horse battery staple',
        }),
      }),
    );
    const body = (await response.json()) as { error?: string; password?: string; secret?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('ADMIN_LOGIN_UNAVAILABLE');
    expect(body.password).toBeUndefined();
    expect(body.secret).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('does not allow raw password fallback in production', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_LOGIN: undefined,
      ADMIN_WEB_LOGIN_EMAIL: 'admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD: 'raw-production-password',
      ADMIN_WEB_LOGIN_PASSWORD_HASH: undefined,
      ADMIN_WEB_LOGIN_PASSWORD_SALT: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          email: 'admin@hands.vn',
          password: 'raw-production-password',
        }),
      }),
    );
    const body = (await response.json()) as { error?: string; password?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('ADMIN_LOGIN_UNAVAILABLE');
    expect(body.password).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('allows explicit non-production dev credentials without raw password support in production', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_LOGIN: 'true',
      ADMIN_WEB_LOGIN_EMAIL: 'dev-admin@hands.vn',
      ADMIN_WEB_LOGIN_PASSWORD: 'dev-only-password',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'test',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/login', {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({ email: 'dev-admin@hands.vn', password: 'dev-only-password' }),
      }),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).not.toContain('Secure');
  });
});

function decodeSessionCookiePayload(setCookie: string) {
  const cookieValue = setCookie.match(/hands_admin_session=([^;]+)/)?.[1];
  if (!cookieValue) {
    throw new Error('Expected hands_admin_session cookie');
  }
  const [payloadSegment] = cookieValue.split('.');
  return JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as Record<string, unknown>;
}
