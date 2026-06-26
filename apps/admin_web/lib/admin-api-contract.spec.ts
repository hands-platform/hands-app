import type {
  AdminBooking,
  AdminBookingMatchSource,
  AdminBookingMatchingEvidence,
} from './admin-api';
import { getAdminAccessToken } from './admin-api';

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

    await expect(getAdminAccessToken()).rejects.toThrow('ADMIN_ACCESS_TOKEN is required in production');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired local admin token instead of serving empty admin data', async () => {
    const freshToken = testJwt(Math.floor(Date.now() / 1000) + 600);
    process.env = {
      ...process.env,
      ADMIN_ACCESS_TOKEN: testJwt(Math.floor(Date.now() / 1000) - 60),
      NODE_ENV: 'development',
    };
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: freshToken }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      }),
    );

    await expect(getAdminAccessToken()).resolves.toBe(freshToken);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/verify-otp'),
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
