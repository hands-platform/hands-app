import type {
  AdminBooking,
  AdminBookingMatchSource,
  AdminBookingMatchingEvidence,
} from './admin-api';
import { AdminApiRequestError, adminPostOrThrow, getAdminAccessToken } from './admin-api';
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

  it('rejects Admin API access without an operator session even when a broad token is configured', async () => {
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'legacy-broad-admin-token',
      NODE_ENV: 'production',
    };
    const fetchMock = vi.spyOn(global, 'fetch');

    await expect(getAdminAccessToken()).rejects.toThrow('Admin Web session is required for Admin API access');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('issues a short-lived scoped token from the current operator session instead of returning the broad token', async () => {
    const sessionSecret = 'test-session-secret';
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: 'legacy-broad-admin-token',
      ADMIN_WEB_API_TOKEN_SECRET: 'test-admin-web-api-secret',
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'operator-1',
    });
    vi.mocked(headers).mockResolvedValue(
      new Headers({ cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}` }) as never,
    );
    const fetchMock = vi.spyOn(global, 'fetch');

    const token = await getAdminAccessToken();
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
      aud: string;
      exp: number;
      iat: number;
      role: string;
      scope: string;
      sub: string;
      typ: string;
    };

    expect(token).not.toBe(process.env.ADMIN_ACCESS_TOKEN);
    expect(payload).toMatchObject({
      aud: 'hands-api',
      role: 'ADMIN',
      scope: 'admin:api',
      sub: 'operator-1',
      typ: 'admin-web-api',
    });
    expect(payload.exp - payload.iat).toBe(300);
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

  it('treats an empty admin operator access response as no stored setup for env master writes', async () => {
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
        return new Response('', {
          headers: { 'content-type': 'application/json' },
          status: 200,
        });
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true });
      }
      if (url.endsWith('/admin/bank-reconciliation/bank-1/matches/match-1/reverse')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      return new Response('{}', { status: 404 });
    });

    await expect(
      adminPostOrThrow('/admin/bank-reconciliation/bank-1/matches/match-1/reverse', {
        approvalAdminId: 'finance-admin-2',
      }),
    ).resolves.toMatchObject({ method: 'POST' });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/bank-reconciliation/bank-1/matches/match-1/reverse'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('fails closed when an Admin Web write route has no operator category mapping', async () => {
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
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      if (url.endsWith('/admin/unmapped-risk-action')) {
        return Response.json({ ok: true, path: url, method: init?.method });
      }
      return new Response('{}', { status: 404 });
    });

    await expect(adminPostOrThrow('/admin/unmapped-risk-action', {})).rejects.toThrow(
      'Admin operator write access denied for unmapped route',
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/admin/unmapped-risk-action'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/admin/operator-activity'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('retains structured API error evidence on the server for bounded operator recovery flows', async () => {
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
      new Headers({ cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookieValue}` }) as never,
    );
    vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/admin/users/admin-operator-access')) {
        return new Response('null', { headers: { 'content-type': 'application/json' }, status: 200 });
      }
      if (url.includes('/admin/operator-activity')) {
        return Response.json({ ok: true });
      }
      if (url.endsWith('/admin/bank-reconciliation/transactions')) {
        return Response.json(
          {
            code: 'BANK_TRANSACTION_POTENTIAL_DUPLICATE',
            candidates: [{ id: 'bank-tx-existing' }],
          },
          { status: 409 },
        );
      }
      return new Response('{}', { status: 404 });
    });

    const error = await adminPostOrThrow('/admin/bank-reconciliation/transactions', {}).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(AdminApiRequestError);
    expect(error).toMatchObject({
      status: 409,
      payload: {
        code: 'BANK_TRANSACTION_POTENTIAL_DUPLICATE',
        candidates: [{ id: 'bank-tx-existing' }],
      },
    });
  });
});
