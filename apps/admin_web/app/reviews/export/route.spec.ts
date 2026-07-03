import { adminGet } from '../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../lib/admin-session';
import { NextRequest } from 'next/server';

vi.mock('../../../lib/admin-api', () => ({
  adminGet: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);

describe('Admin review export route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires a signed Admin Web session before exporting customer review data', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN: undefined,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret',
      NODE_ENV: 'production',
    };
    mockedAdminGet.mockResolvedValue([]);
    const { GET } = await import('./route');

    const response = await GET(new NextRequest('http://localhost/reviews/export'));

    expect(response.status).toBe(401);
    const body = (await response.json()) as { error?: string };
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error).toBe('ADMIN_WEB_ACCESS_REQUIRED');
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('exports customer review CSV for a signed Admin Web session', async () => {
    const sessionSecret = 'test-admin-session-secret';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    mockedAdminGet.mockResolvedValue([
      {
        bookingId: 'booking-1',
        booking: { id: 'booking-1' },
        comment: 'Great service',
        createdAt: '2026-07-01T08:00:00.000Z',
        customerProfile: { user: { fullName: 'Customer One' } },
        id: 'review-1',
        providerProfile: { displayName: 'Partner One' },
        rating: 5,
        status: 'PUBLISHED',
      },
    ]);
    const { GET } = await import('./route');
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'reviews.operator@hands.vn',
    });

    const response = await GET(
      new NextRequest('http://localhost/reviews/export', {
        headers: { cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}` },
      }),
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('hands-customer-reviews.csv');
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(csv).toContain('booking-1');
    expect(mockedAdminGet).toHaveBeenCalledTimes(1);
  });
});
