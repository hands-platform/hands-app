import { apiRateLimitPolicies, rateLimitMiddleware } from './rate-limit.middleware';

describe('rateLimitMiddleware', () => {
  it('covers auth, public Partner discovery, and payment callback trust boundaries', () => {
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/auth/admin-operator-login'))).toBe(
      true,
    );
    expect(
      apiRateLimitPolicies.some((policy) =>
        policy.pathPattern.test('/api/customer/partners/nearby?lat=10.7&lng=106.6'),
      ),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/customer/providers/provider-1')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) =>
        policy.pathPattern.test('/api/public/partners?city=ho-chi-minh'),
      ),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/payments/VNPAY/callback?vnp_TxnRef=1')),
    ).toBe(true);
  });

  it('uses the trusted request IP instead of a client-supplied forwarded header', () => {
    const middleware = rateLimitMiddleware({
      windowMs: 60_000,
      max: 1,
      pathPattern: /^\/api\/auth\//,
    });
    const firstResponse = responseFixture();
    const secondResponse = responseFixture();

    middleware(
      {
        headers: { 'x-forwarded-for': '198.51.100.10' },
        ip: '203.0.113.5',
        originalUrl: '/api/auth/request-otp',
      },
      firstResponse.response,
      firstResponse.next,
    );
    middleware(
      {
        headers: { 'x-forwarded-for': '198.51.100.11' },
        ip: '203.0.113.5',
        originalUrl: '/api/auth/request-otp',
      },
      secondResponse.response,
      secondResponse.next,
    );

    expect(firstResponse.next).toHaveBeenCalledOnce();
    expect(secondResponse.status).toHaveBeenCalledWith(429);
    expect(secondResponse.next).not.toHaveBeenCalled();
  });
});

function responseFixture() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    json,
    next: vi.fn(),
    response: {
      setHeader: vi.fn(),
      status,
    },
    status,
  };
}
