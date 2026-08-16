import { NextRequest } from 'next/server';

import type { AdminReview } from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../lib/admin-session';

vi.mock('../../../lib/admin-api', () => ({
  adminGetResult: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);

describe('Admin review export route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-admin-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    mockedAdminGetResult.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('requires a signed Admin Web session before exporting customer review data', async () => {
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/reviews/export'));

    expect(response.status).toBe(401);
    expect((await response.json()) as { error?: string }).toMatchObject({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it.each([0, 1, 100, 101, 172])('exports all %s filtered reviews in pages of at most 100', async (count) => {
    mockedAdminGetResult.mockImplementation(async (href) => {
      const url = new URL(String(href), 'http://admin.local');
      if (url.pathname.endsWith('/summary')) {
        return { data: { totalCount: count }, ok: true, status: 200 };
      }
      const skip = Number(url.searchParams.get('skip') ?? 0);
      const take = Number(url.searchParams.get('take') ?? 100);
      return {
        data: reviewRows(Math.min(take, Math.max(0, count - skip)), skip),
        ok: true,
        status: 200,
      };
    });
    const { GET } = await import('./route');
    const response = await GET(authenticatedRequest('http://localhost/reviews/export?dateRange=30d'));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(csv.split('\r\n')).toHaveLength(count + 1);
    expect(response.headers.get('content-disposition')).toMatch(
      /hands-customer-reviews-30d-\d{4}-\d{2}-\d{2}\.csv/,
    );
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1 + Math.ceil(count / 100));
  });

  it('returns an error instead of a partial CSV when a later page fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      const url = new URL(String(href), 'http://admin.local');
      if (url.pathname.endsWith('/summary')) {
        return { data: { totalCount: 172 }, ok: true, status: 200 };
      }
      if (url.searchParams.get('skip') === '100') {
        return { data: fallback, ok: false, status: 503 };
      }
      return { data: reviewRows(100), ok: true, status: 200 };
    });
    const { GET } = await import('./route');
    const response = await GET(authenticatedRequest('http://localhost/reviews/export'));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: 'Review export failed while loading page 2.' });
    expect(response.headers.get('content-type')).toContain('application/json');
  });

  it('rejects a count mismatch caused by changing data', async () => {
    mockedAdminGetResult.mockImplementation(async (href) => {
      const url = new URL(String(href), 'http://admin.local');
      return url.pathname.endsWith('/summary')
        ? { data: { totalCount: 101 }, ok: true, status: 200 }
        : { data: reviewRows(100), ok: true, status: 200 };
    });
    const { GET } = await import('./route');
    const response = await GET(authenticatedRequest('http://localhost/reviews/export'));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: 'Review export count changed during generation (200 of 101). Retry the export.',
    });
  });
});

function authenticatedRequest(url: string) {
  const sessionCookie = createAdminWebSessionCookieValue({
    expiresAtMs: Date.now() + 60_000,
    secret: 'test-admin-session-secret-with-32-chars',
    sub: 'reviews.operator@hands.vn',
  });
  return new NextRequest(url, {
    headers: { cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}` },
  });
}

function reviewRows(count: number, offset = 0): AdminReview[] {
  return Array.from({ length: count }, (_, index) => ({
    bookingId: `booking-${offset + index}`,
    booking: { id: `booking-${offset + index}` },
    comment: `Review ${offset + index}`,
    createdAt: '2026-07-01T08:00:00.000Z',
    customerProfile: { user: { fullName: `Customer ${offset + index}` } },
    id: `review-${offset + index}`,
    providerProfile: { displayName: `Partner ${offset + index}` },
    rating: 5,
    status: 'PUBLISHED',
  }));
}
