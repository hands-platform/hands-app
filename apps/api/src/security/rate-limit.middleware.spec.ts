import { apiRateLimitPolicies, rateLimitMiddleware } from './rate-limit.middleware';

describe('rateLimitMiddleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('covers auth, public Partner discovery, and payment callback trust boundaries', () => {
    const adminLoginPolicy = apiRateLimitPolicies.find((policy) =>
      policy.pathPattern.test('/api/auth/admin-operator-login'),
    );
    expect(adminLoginPolicy).toMatchObject({ max: 5, windowMs: 15 * 60_000 });
    expect(
      apiRateLimitPolicies.filter((policy) => policy.pathPattern.test('/api/auth/admin-operator-login')),
    ).toHaveLength(1);
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
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/partner/bookings/open?take=20')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/provider/bookings/open')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/payments/VNPAY/callback?vnp_TxnRef=1')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/payments/CASH/callback')),
    ).toBe(true);
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/app/session'))).toBe(true);
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/files/presign'))).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/files/file-1/complete')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/files/file-1/read-url')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/chat/rooms/room-1/messages')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) =>
        policy.pathPattern.test('/api/public/site-pages/news?locale=vi'),
      ),
    ).toBe(true);
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/services/groups'))).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/mobile/app-version')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/customer/bookings/booking-1/cancel')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/partner/bookings/booking-1/join')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/customer/locations/location-1')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/partner/location')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/provider/location')),
    ).toBe(true);
    expect(
      apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/notifications/device-token/register')),
    ).toBe(true);
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/health'))).toBe(true);
    expect(apiRateLimitPolicies.some((policy) => policy.pathPattern.test('/api/health/ready'))).toBe(true);
  });

  it('shares one file-operation bucket across attacker-controlled file ids', async () => {
    const policy = apiRateLimitPolicies.find((candidate) =>
      candidate.pathPattern.test('/api/files/file-1/complete'),
    );
    expect(policy).toBeDefined();
    const store = { consumeRateLimit: vi.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60_000 }) };
    const middleware = rateLimitMiddleware(policy!, store);
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.5', method: 'POST', originalUrl: '/api/files/attacker-file-id/complete' },
      result.response,
      result.next,
    );

    expect(store.consumeRateLimit).toHaveBeenCalledWith('203.0.113.5:POST:/api/files', 60_000);
  });

  it('covers both Partner location aliases with the same limit', () => {
    const policies = apiRateLimitPolicies.filter(
      (candidate) =>
        candidate.pathPattern.test('/api/partner/location') ||
        candidate.pathPattern.test('/api/provider/location'),
    );

    expect(policies).toHaveLength(1);
    expect(policies[0]).toMatchObject({ max: 60, windowMs: 60_000 });
  });

  it('shares one callback bucket across attacker-controlled payment method segments', async () => {
    const policy = apiRateLimitPolicies.find((candidate) =>
      candidate.pathPattern.test('/api/payments/MOMO/callback'),
    );
    expect(policy).toBeDefined();
    const store = { consumeRateLimit: vi.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60_000 }) };
    const middleware = rateLimitMiddleware(policy!, store);
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.5', method: 'POST', originalUrl: '/api/payments/MANUAL/callback' },
      result.response,
      result.next,
    );

    expect(store.consumeRateLimit).toHaveBeenCalledWith('203.0.113.5:POST:/api/payments', 60_000);
  });

  it('shares one Partner mutation bucket across attacker-controlled booking ids', async () => {
    const policy = apiRateLimitPolicies.find((candidate) =>
      candidate.pathPattern.test('/api/partner/bookings/booking-1/join'),
    );
    expect(policy).toBeDefined();
    const store = { consumeRateLimit: vi.fn().mockResolvedValue({ count: 1, resetAt: Date.now() + 60_000 }) };
    const middleware = rateLimitMiddleware(policy!, store);
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.5', method: 'POST', originalUrl: '/api/partner/bookings/attacker-id/join' },
      result.response,
      result.next,
    );

    expect(store.consumeRateLimit).toHaveBeenCalledWith(
      '203.0.113.5:POST:/api/partner/bookings',
      60_000,
    );
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

  it('uses a shared rate-limit store when one is configured', async () => {
    const store = {
      consumeRateLimit: vi.fn().mockResolvedValue({ count: 2, resetAt: Date.now() + 60_000 }),
    };
    const middleware = rateLimitMiddleware(
      { windowMs: 60_000, max: 1, pathPattern: /^\/api\/auth\// },
      store,
    );
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.5', method: 'POST', originalUrl: '/api/auth/admin-operator-login' },
      result.response,
      result.next,
    );

    expect(store.consumeRateLimit).toHaveBeenCalledWith(
      '203.0.113.5:POST:/api/auth/admin-operator-login',
      60_000,
    );
    expect(result.status).toHaveBeenCalledWith(429);
  });

  it('fails closed in production when the shared limiter is unavailable', async () => {
    process.env.NODE_ENV = 'production';
    const store = { consumeRateLimit: vi.fn().mockRejectedValue(new Error('redis unavailable')) };
    const middleware = rateLimitMiddleware(
      { windowMs: 60_000, max: 20, pathPattern: /^\/api\/files\/presign/ },
      store,
    );
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.5', method: 'POST', originalUrl: '/api/files/presign' },
      result.response,
      result.next,
    );

    expect(result.status).toHaveBeenCalledWith(503);
    expect(result.json).toHaveBeenCalledWith({
      statusCode: 503,
      message: 'Request protection is temporarily unavailable',
    });
    expect(result.next).not.toHaveBeenCalled();
  });

  it('keeps the local limiter fallback limited to non-production development', async () => {
    process.env.NODE_ENV = 'development';
    const store = { consumeRateLimit: vi.fn().mockRejectedValue(new Error('redis unavailable')) };
    const middleware = rateLimitMiddleware(
      { windowMs: 60_000, max: 20, pathPattern: /^\/api\/files\/presign/ },
      store,
    );
    const result = responseFixture();

    await middleware(
      { ip: '203.0.113.6', method: 'POST', originalUrl: '/api/files/presign' },
      result.response,
      result.next,
    );

    expect(result.next).toHaveBeenCalledOnce();
    expect(result.status).not.toHaveBeenCalled();
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
