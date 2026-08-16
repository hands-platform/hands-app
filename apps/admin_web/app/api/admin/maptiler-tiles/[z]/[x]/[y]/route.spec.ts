import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
  getAdminWebSession,
} from '../../../../../../../lib/admin-session';

describe('Admin MapTiler tile proxy route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('requires a signed Admin Web session before proxying map tiles', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      MAPTILER_API_KEY: 'test-maptiler-key',
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/maptiler-tiles/7/100/55.png'), {
      params: Promise.resolve({ x: '100', y: '55.png', z: '7' }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
  });

  it('fails safely when the MapTiler key is missing', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-web-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      MAPTILER_API_KEY: undefined,
      NODE_ENV: 'production',
    };
    global.fetch = verifiedAdminSessionFetch() as typeof fetch;
    const { GET } = await import('./route');
    expect(getAdminWebSession(adminTileRequest(), process.env)).not.toBeNull();

    const response = await GET(adminTileRequest(), {
      params: Promise.resolve({ x: '100', y: '55.png', z: '7' }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe('MAPTILER_API_KEY_MISSING');
  });

  it('blocks tile coordinates outside the bounded Vietnam overview window', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-web-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      MAPTILER_API_KEY: 'test-maptiler-key',
      NODE_ENV: 'production',
    };
    global.fetch = verifiedAdminSessionFetch() as typeof fetch;
    const { GET } = await import('./route');

    const response = await GET(adminTileRequest('http://localhost/api/admin/maptiler-tiles/7/99/55.png'), {
      params: Promise.resolve({ x: '99', y: '55.png', z: '7' }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(404);
    expect(body.error).toBe('TILE_OUTSIDE_VIETNAM_OVERVIEW');
  });

  it('proxies a bounded MapTiler streets tile without exposing the key in the app URL', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-web-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      MAPTILER_API_KEY: 'test-maptiler-key',
      NODE_ENV: 'production',
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;

      if (typeof input === 'string' && input.includes('/admin/admin-operators/me/session')) {
        return Response.json({ ok: true });
      }

      return new Response('tile-bytes', {
        headers: { 'content-type': 'image/png' },
        status: 200,
      });
    });
    global.fetch = fetchMock as typeof fetch;
    const { GET } = await import('./route');

    const response = await GET(adminTileRequest(), {
      params: Promise.resolve({ x: '100', y: '55.png', z: '7' }),
    });
    const upstreamUrl = fetchMock.mock.calls.find(([input]) => input instanceof URL)?.[0];

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(upstreamUrl).toBeInstanceOf(URL);
    if (!(upstreamUrl instanceof URL)) {
      throw new Error('Expected MapTiler proxy to call fetch with a URL instance.');
    }
    expect(upstreamUrl.hostname).toBe('api.maptiler.com');
    expect(upstreamUrl.pathname).toBe('/maps/streets-v2/256/7/100/55.png');
    expect(upstreamUrl.searchParams.get('key')).toBe('test-maptiler-key');
  });

  it('rejects a valid signed cookie after its server session is revoked', async () => {
    process.env = {
      ...process.env,
      ADMIN_API_BASE_URL: 'http://localhost:3000/api',
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-web-api-token-secret-with-32-chars',
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      MAPTILER_API_KEY: 'test-maptiler-key',
      NODE_ENV: 'production',
    };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ authenticated: false }, { status: 401 }));
    global.fetch = fetchMock as typeof fetch;
    const { GET } = await import('./route');

    const response = await GET(adminTileRequest(), {
      params: Promise.resolve({ x: '100', y: '55.png', z: '7' }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

function verifiedAdminSessionFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (typeof input === 'string' && input.includes('/admin/admin-operators/me/session')) {
      return Response.json({ ok: true });
    }
    throw new Error(`Unexpected fetch: ${String(input)}`);
  });
}

function adminTileRequest(url = 'http://localhost/api/admin/maptiler-tiles/7/100/55.png') {
  return new Request(url, {
    headers: {
      cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${createAdminWebSessionCookieValue({
        expiresAtMs: Date.now() + 60_000,
        secret: 'test-admin-session-secret-with-32-chars',
        sub: 'map.operator@hands.vn',
      })}`,
    },
  });
}
