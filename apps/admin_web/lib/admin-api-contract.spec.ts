import type {
  AdminBooking,
  AdminBookingMatchSource,
  AdminBookingMatchingEvidence,
} from './admin-api';
import { adminPostOrThrow, getAdminAccessToken } from './admin-api';
import { ADMIN_WEB_SESSION_COOKIE_NAME, createAdminWebSessionCookieValue } from './admin-session';
import { headers } from 'next/headers';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

describe('admin api contract types', () => {
  it('keeps persisted booking match source closed to the API enum values', () => {
    const firstPickSource: AdminBookingMatchSource = 'FIRST_PICK_ACCEPTED_FIRST';
    const customerSource: AdminBookingMatchSource = 'CUSTOMER_SELECTED_PARTNER';
    const booking = {
      id: 'booking-1',
      status: 'MATCHED',
      customerProfileId: 'customer-1',
      matchSource: firstPickSource,
    } satisfies AdminBooking;
    const matchingEvidence = {
      stage: 'MATCHED',
      finalSelection: 'FIRST_PICK_ACCEPTED',
      firstPickStatus: 'ACCEPTED',
      marketplaceParticipantCount: 1,
      selectableParticipantCount: 0,
      matchedAt: '2026-06-10T10:00:00.000Z',
      matchSource: customerSource,
      chatReady: true,
    } satisfies AdminBookingMatchingEvidence;

    expect(booking.matchSource).toBe('FIRST_PICK_ACCEPTED_FIRST');
    expect(matchingEvidence.matchSource).toBe('CUSTOMER_SELECTED_PARTNER');
  });
});

describe('admin api auth guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('does not use the local demo OTP fallback in production', async () => {
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: undefined,
      NODE_ENV: 'production',
    };
    const fetchMock = vi.spyOn(global, 'fetch');

    await expect(getAdminAccessToken()).rejects.toThrow(
      'ADMIN_ACCESS_TOKEN is required for Admin Web API access',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an expired local admin token instead of using mobile OTP fallback', async () => {
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: testJwt(Math.floor(Date.now() / 1000) - 60),
      NODE_ENV: 'development',
    };
    const fetchMock = vi.spyOn(global, 'fetch');

    await expect(getAdminAccessToken()).rejects.toThrow('ADMIN_ACCESS_TOKEN is expired');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows env master admin sessions to perform categorized write actions without stored category setup', async () => {
    const sessionSecret = 'test-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'server-admin-token',
      ADMIN_WEB_LOGIN_EMAIL: 'master@example.com',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
    };
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'master@example.com',
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({
        cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}`,
      }) as never,
    );
    const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/admin/users/admin-operator-access')) {
        return new Response('null', {
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true });
      }
      if (url.endsWith('/admin/bank-reconciliation/bank-1/matches')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      return new Response('{}', { status: 404 });
    });

    await expect(
      adminPostOrThrow('/admin/bank-reconciliation/bank-1/matches', {
        amount: 500000,
        paymentClearingEntryId: 'clearing-1',
      }),
    ).resolves.toMatchObject({ method: 'POST' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/bank-reconciliation/bank-1/matches'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

function testJwt(exp: number) {
  return [
    base64UrlJson({ alg: 'none', typ: 'JWT' }),
    base64UrlJson({ exp }),
    'signature',
  ].join('.');
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
