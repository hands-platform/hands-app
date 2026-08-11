import { corsOriginFromEnv } from './cors-origin';
import { rateLimitMiddleware } from './rate-limit.middleware';
import { securityHeadersMiddleware } from './security-headers.middleware';

describe('security middleware', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('fails closed for credentialed production CORS without explicit origins', () => {
    expect(() => corsOriginFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'CORS_ORIGINS must be configured in production when credentials are enabled.',
    );
    expect(
      corsOriginFromEnv({
        CORS_ORIGINS: 'https://admin.hands.vn, https://ops.hands.vn',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toEqual(['https://admin.hands.vn', 'https://ops.hands.vn']);
  });

  it('keeps permissive CORS limited to non-production environments', () => {
    expect(corsOriginFromEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe(true);
  });

  it('rate limits auth routes by client, method, and path without query strings', () => {
    const next = vi.fn();
    const json = vi.fn();
    const setHeader = vi.fn();
    const status = vi.fn(() => ({ json }));
    const middleware = rateLimitMiddleware({
      max: 2,
      pathPattern: /^\/api\/auth\//,
      windowMs: 60_000,
    });
    const req = {
      headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' },
      ip: '203.0.113.10',
      method: 'POST',
      originalUrl: `/api/auth/verify-otp?attempt=${Date.now()}`,
    };

    middleware(req, { setHeader, status }, next);
    middleware(req, { setHeader, status }, next);
    middleware(req, { setHeader, status }, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Too many requests',
        statusCode: 429,
      }),
    );
  });

  it('rate limits auth routes by a stable path depth when callers configure one', () => {
    const next = vi.fn();
    const json = vi.fn();
    const setHeader = vi.fn();
    const status = vi.fn(() => ({ json }));
    const middleware = rateLimitMiddleware({
      max: 2,
      pathPattern: /^\/api\/auth\//,
      windowMs: 60_000,
      keyPathDepth: 3,
    });
    const req = (suffix: string) => ({
      headers: { 'x-forwarded-for': '198.51.100.22' },
      ip: '198.51.100.22',
      method: 'POST',
      originalUrl: `/api/auth/verify-otp/${suffix}?attempt=${suffix}`,
    });

    middleware(req('first'), { setHeader, status }, next);
    middleware(req('second'), { setHeader, status }, next);
    middleware(req('third'), { setHeader, status }, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Too many requests',
        statusCode: 429,
      }),
    );
  });

  it('sets browser hardening headers and only sends HSTS in production', () => {
    const next = vi.fn();
    const setHeader = vi.fn();

    process.env.NODE_ENV = 'development';
    securityHeadersMiddleware({}, { setHeader }, next);
    expect(setHeader).toHaveBeenCalledWith('x-content-type-options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('x-frame-options', 'DENY');
    expect(setHeader).not.toHaveBeenCalledWith('strict-transport-security', expect.any(String));

    setHeader.mockClear();
    process.env.NODE_ENV = 'production';
    securityHeadersMiddleware({}, { setHeader }, next);
    expect(setHeader).toHaveBeenCalledWith(
      'strict-transport-security',
      'max-age=15552000; includeSubDomains',
    );
  });
});
