import { adminPostOrThrow } from '../../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../../lib/admin-session';

vi.mock('../../../../lib/admin-api', () => ({
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);

describe('Admin calendar events route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a signed Admin Web session before creating a calendar event', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/calendar-events', {
        body: JSON.stringify({ title: 'Finance closeout' }),
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('creates persistent calendar events with the current operator identity', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminPostOrThrow.mockResolvedValue({
      allDay: false,
      authorId: 'calendar.operator@hands.vn',
      authorName: 'Calendar Operator',
      description: '',
      end: '2026-07-03T11:00:00.000Z',
      id: 'calendar-1',
      location: '',
      start: '2026-07-03T10:00:00.000Z',
      tags: ['finance'],
      title: 'Finance closeout',
      url: '',
    });
    const { POST } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'calendar.operator@hands.vn',
    });

    const response = await POST(
      new Request('http://localhost/api/admin/calendar-events', {
        body: JSON.stringify({
          end: '2026-07-03T11:00:00.000Z',
          start: '2026-07-03T10:00:00.000Z',
          tags: ['finance'],
          title: 'Finance closeout',
        }),
        headers: { cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}` },
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { id?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.id).toBe('calendar-1');
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/calendar-events', {
      end: '2026-07-03T11:00:00.000Z',
      operatorIdentity: 'calendar.operator@hands.vn',
      operatorName: 'Calendar Operator',
      start: '2026-07-03T10:00:00.000Z',
      tags: ['finance'],
      title: 'Finance closeout',
    });
  });
});
