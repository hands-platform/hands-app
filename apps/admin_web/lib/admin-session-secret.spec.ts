import { adminWebSessionCookieSecretFromEnv } from './admin-session-secret';

describe('Admin Web session cookie secret', () => {
  it('requires a strong production secret', () => {
    expect(() =>
      adminWebSessionCookieSecretFromEnv({
        ADMIN_WEB_SESSION_COOKIE_SECRET: 'too-short-production-secret',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow('ADMIN_WEB_SESSION_COOKIE_SECRET must contain at least 32 non-placeholder characters in production.');
  });

  it('does not allow the cookie signing secret to be reused by an Admin API token', () => {
    expect(() =>
      adminWebSessionCookieSecretFromEnv({
        ADMIN_WEB_API_TOKEN_SECRET: 'shared-cookie-and-api-secret-32-chars',
        ADMIN_WEB_SESSION_COOKIE_SECRET: 'shared-cookie-and-api-secret-32-chars',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow('ADMIN_WEB_SESSION_COOKIE_SECRET must be separate from ADMIN_WEB_API_TOKEN_SECRET.');
  });
});
