import { readFileSync } from 'node:fs';
import { createAdminWebSessionCookieValue } from '../../../../lib/admin-session';

describe('Admin realtime token route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns a scoped short-lived realtime token instead of ADMIN_ACCESS_TOKEN', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: 'true',
      ADMIN_ACCESS_TOKEN: 'broad-admin-rest-token',
      ADMIN_REALTIME_TOKEN_SECRET: 'test-admin-realtime-secret',
      ADMIN_WEB_LOGIN_EMAIL: 'developer@hands.local',
      ADMIN_SOCKET_BASE_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/realtime-token'));
    const body = (await response.json()) as { expiresAt?: string; socketBaseUrl?: string; token?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.socketBaseUrl).toBe('http://localhost:3000');
    expect(body.token).toBeTruthy();
    expect(body.token).not.toBe('broad-admin-rest-token');
    expect(body.token?.split('.')).toHaveLength(3);
    const payload = decodeJwtPayload(body.token);
    expect(body.expiresAt).toBe(new Date((payload.exp as number) * 1000).toISOString());
    expect(payload).toMatchObject({
      sub: 'developer@hands.local',
      typ: 'admin-realtime',
      aud: 'hands-socket',
      scope: 'admin:realtime',
      role: 'ADMIN',
    });
    expect(typeof payload.jti).toBe('string');
    expect((payload.exp as number) - (payload.iat as number)).toBeLessThanOrEqual(120);
  });

  it('denies token minting in production when no admin session is present', async () => {
    process.env = {
      ...process.env,
      ADMIN_REALTIME_TOKEN_SECRET: 'test-admin-realtime-secret',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/realtime-token'));
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(body.token).toBeUndefined();
  });

  it('does not allow the non-production fallback unless explicitly enabled', async () => {
    process.env = {
      ...process.env,
      ADMIN_REALTIME_TOKEN_SECRET: 'test-admin-realtime-secret',
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      NODE_ENV: 'test',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/realtime-token'));
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(body.token).toBeUndefined();
  });

  it('returns a scoped token in production when a signed admin session cookie is present', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'broad-admin-rest-token',
      ADMIN_REALTIME_TOKEN_SECRET: 'test-admin-realtime-secret',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'operator-user-1',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/realtime-token', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { expiresAt?: string; token?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.token).toBeTruthy();
    const payload = decodeJwtPayload(body.token);
    expect(body.expiresAt).toBe(new Date((payload.exp as number) * 1000).toISOString());
    expect(payload).toMatchObject({
      sub: 'operator-user-1',
      typ: 'admin-realtime',
      aud: 'hands-socket',
      scope: 'admin:realtime',
      role: 'ADMIN',
    });
  });

  it('fails closed in production when ADMIN_REALTIME_TOKEN_SECRET is missing', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'broad-admin-rest-token',
      ADMIN_REALTIME_TOKEN_SECRET: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
    });

    const response = await GET(
      new Request('http://localhost/api/admin/realtime-token', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('REALTIME_TOKEN_UNAVAILABLE');
    expect(body.token).toBeUndefined();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
  });

  it('fails closed when ADMIN_REALTIME_TOKEN_SECRET reuses ADMIN_ACCESS_TOKEN', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'shared-admin-secret',
      ADMIN_REALTIME_TOKEN_SECRET: 'shared-admin-secret',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
    });

    const response = await GET(
      new Request('http://localhost/api/admin/realtime-token', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('REALTIME_TOKEN_UNAVAILABLE');
    expect(body.token).toBeUndefined();
  });

  it('fails closed in production when dev realtime fallback is enabled', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_REALTIME_TOKEN_SECRET: 'test-admin-realtime-secret',
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: 'true',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
    });

    const response = await GET(
      new Request('http://localhost/api/admin/realtime-token', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('REALTIME_TOKEN_UNAVAILABLE');
    expect(body.token).toBeUndefined();
  });

  it('fails closed when ADMIN_REALTIME_TOKEN_SECRET reuses JWT_ACCESS_SECRET', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'broad-admin-rest-token',
      ADMIN_REALTIME_TOKEN_SECRET: 'shared-jwt-secret',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      JWT_ACCESS_SECRET: 'shared-jwt-secret',
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
    });

    const response = await GET(
      new Request('http://localhost/api/admin/realtime-token', {
        headers: { cookie: `hands_admin_session=${sessionCookie}` },
      }),
    );
    const body = (await response.json()) as { error?: string; token?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('REALTIME_TOKEN_UNAVAILABLE');
    expect(body.token).toBeUndefined();
  });

  it('does not store or log realtime tokens from the booking monitor client', () => {
    const source = readFileSync('app/bookings/booking-monitor.tsx', 'utf8');

    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage)\b/);
    expect(source).not.toMatch(/console\.log\s*\(/);
    expect(source).toMatch(
      /import type \{[\s\S]*?\bAdminAuditLog,\s*\bAdminBooking,[\s\S]*?\} from '..\/..\/lib\/admin-api';/,
    );
    expect(source).not.toMatch(
      /import\s+(?!type\b)\{[^}]*\bAdminAuditLog\b[^}]*\bAdminBooking\b[^}]*\}\s+from '..\/..\/lib\/admin-api';/,
    );
  });
});

function decodeJwtPayload(token: string | undefined) {
  if (!token) {
    throw new Error('Expected token');
  }
  const [, payload] = token.split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}
