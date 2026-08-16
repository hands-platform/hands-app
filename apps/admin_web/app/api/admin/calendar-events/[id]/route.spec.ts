import {
  adminDeleteWithBodyOrThrow,
  adminPatchOrThrow,
} from '../../../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../../../lib/admin-session';

vi.mock('../../../../../lib/admin-api', () => ({
  adminDeleteWithBodyOrThrow: vi.fn(),
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminDeleteWithBodyOrThrow = vi.mocked(adminDeleteWithBodyOrThrow);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);

describe('Admin calendar event detail route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a signed Admin Web session before updating a calendar event', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { PATCH } = await import('./route');

    const response = await PATCH(
      new Request('http://localhost/api/admin/calendar-events/calendar-1', {
        body: JSON.stringify({ title: 'Updated closeout' }),
        headers: { origin: 'http://localhost' },
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'calendar-1' }) },
    );
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
  });

  it('passes operator identity through update requests so the API can enforce author-only edits', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminPatchOrThrow.mockResolvedValue({
      allDay: false,
      authorId: 'calendar.operator@hands.vn',
      authorName: 'Calendar Operator',
      description: '',
      end: '2026-07-03T11:00:00.000Z',
      id: 'calendar-1',
      location: '',
      start: '2026-07-03T10:00:00.000Z',
      tags: ['finance'],
      title: 'Updated closeout',
      url: '',
    });
    const { PATCH } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'calendar.operator@hands.vn',
    });

    const response = await PATCH(
      new Request('http://localhost/api/admin/calendar-events/calendar-1', {
        body: JSON.stringify({ title: 'Updated closeout' }),
        headers: {
          cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}`,
          origin: 'http://localhost',
        },
        method: 'PATCH',
      }),
      { params: Promise.resolve({ id: 'calendar-1' }) },
    );
    const body = (await response.json()) as { id?: string };

    expect(response.status).toBe(200);
    expect(body.id).toBe('calendar-1');
    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith('/admin/calendar-events/calendar-1', {
      operatorIdentity: 'calendar.operator@hands.vn',
      operatorName: 'Calendar Operator',
      title: 'Updated closeout',
    });
  });

  it('passes operator identity through delete requests so the API can enforce author-only deletes', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminDeleteWithBodyOrThrow.mockResolvedValue({ id: 'calendar-1', ok: true });
    const { DELETE } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'calendar.operator@hands.vn',
    });

    const response = await DELETE(
      new Request('http://localhost/api/admin/calendar-events/calendar-1', {
        headers: {
          cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}`,
          origin: 'http://localhost',
        },
        method: 'DELETE',
      }),
      { params: Promise.resolve({ id: 'calendar-1' }) },
    );
    const body = (await response.json()) as { id?: string; ok?: boolean };

    expect(response.status).toBe(200);
    expect(body).toEqual({ id: 'calendar-1', ok: true });
    expect(mockedAdminDeleteWithBodyOrThrow).toHaveBeenCalledWith('/admin/calendar-events/calendar-1', {
      operatorIdentity: 'calendar.operator@hands.vn',
      operatorName: 'Calendar Operator',
    });
  });
});
