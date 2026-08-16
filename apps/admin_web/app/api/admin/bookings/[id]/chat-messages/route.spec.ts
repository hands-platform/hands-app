import { adminGet } from '../../../../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../../../../lib/admin-session';

vi.mock('../../../../../../lib/admin-api', () => ({
  adminGet: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);

describe('Admin booking chat messages route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a signed Admin Web session before proxying retained chat messages', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { GET } = await import('./route');

    const response = await GET(new Request('http://localhost/api/admin/bookings/booking-1/chat-messages'), {
      params: Promise.resolve({ id: 'booking-1' }),
    });
    const body = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('proxies retained chat messages for a signed Admin Web session', async () => {
    const sessionSecret = 'test-admin-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminGet.mockResolvedValue({
      bookingId: 'booking-1',
      chatRoomId: 'chat-room-1',
      limit: 50,
      messages: [],
      truncated: false,
    });
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'booking.operator@hands.vn',
    });

    const response = await GET(
      new Request('http://localhost/api/admin/bookings/booking-1/chat-messages', {
        headers: { cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}` },
      }),
      { params: Promise.resolve({ id: 'booking-1' }) },
    );
    const body = (await response.json()) as { bookingId?: string };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.bookingId).toBe('booking-1');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/bookings/booking-1/chat-messages', null);
  });
});
