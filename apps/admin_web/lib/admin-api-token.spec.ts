import {
  ADMIN_WEB_API_TOKEN_TTL_SECONDS,
  adminWebApiTokenSecretFromEnv,
  createAdminWebApiToken,
} from './admin-api-token';

describe('Admin Web API token', () => {
  it('creates a short-lived operator-scoped token without embedding the broad token', () => {
    const token = createAdminWebApiToken('operator-1', new Date('2026-07-14T00:00:00.000Z'), {
      ADMIN_ACCESS_TOKEN: 'legacy-broad-token',
      ADMIN_WEB_API_TOKEN_SECRET: 'admin-web-api-secret-with-32-characters',
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv);
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >;

    expect(token).not.toContain('legacy-broad-token');
    expect(payload).toMatchObject({
      aud: 'hands-api',
      role: 'ADMIN',
      scope: 'admin:api',
      sub: 'operator-1',
      typ: 'admin-web-api',
    });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(ADMIN_WEB_API_TOKEN_TTL_SECONDS);
  });

  it('fails closed in production and rejects reused secrets', () => {
    expect(() => adminWebApiTokenSecretFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'ADMIN_WEB_API_TOKEN_SECRET must be configured in production.',
    );
    expect(() =>
      adminWebApiTokenSecretFromEnv({
        ADMIN_WEB_API_TOKEN_SECRET: 'shared-secret-value-with-32-characters',
        ADMIN_WEB_SESSION_COOKIE_SECRET: 'shared-secret-value-with-32-characters',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow('ADMIN_WEB_API_TOKEN_SECRET must be separate from ADMIN_WEB_SESSION_COOKIE_SECRET.');
    expect(() =>
      adminWebApiTokenSecretFromEnv({
        ADMIN_WEB_API_TOKEN_SECRET: 'too-short-production-secret',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow('ADMIN_WEB_API_TOKEN_SECRET must contain at least 32 characters in production.');
  });
});
