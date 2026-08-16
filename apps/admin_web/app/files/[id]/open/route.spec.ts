import { adminGet } from '../../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../../lib/admin-session';

vi.mock('../../../../lib/admin-api', () => ({
  adminGet: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);

describe('Admin private file open route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a signed Admin Web session before requesting a private file read URL', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    mockedAdminGet.mockResolvedValue({});
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/files/file-1/open'), {
      params: Promise.resolve({ id: 'file-1' }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('redirects to a private read URL for a signed Admin Web session', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminGet.mockResolvedValue({ read: { url: 'https://storage.example.com/private/file-1' } });
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'files.operator@hands.vn',
    });

    const response = await GET(
      new Request('http://localhost/files/file-1/open', {
        headers: { cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}` },
      }),
      { params: Promise.resolve({ id: 'file-1' }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://storage.example.com/private/file-1');
    expect(mockedAdminGet).toHaveBeenCalledWith('/files/file-1/read-url', {});
  });
});
