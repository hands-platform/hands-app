import {
  adminRealtimeTokenSecretFromConfig,
  adminWebApiTokenSecretFromConfig,
  jwtAccessSecretFromConfig,
  jwtAccessSecretFromEnv,
  jwtRefreshSecretFromConfig,
} from './jwt-secrets';

describe('JWT secret resolution', () => {
  it('uses explicit non-placeholder secrets after trimming whitespace', () => {
    expect(
      jwtAccessSecretFromEnv({
        JWT_ACCESS_SECRET: '  production-access-secret  ',
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toBe('production-access-secret');
    expect(
      jwtRefreshSecretFromConfig(configReader({ JWT_REFRESH_SECRET: ' production-refresh-secret ' })),
    ).toBe('production-refresh-secret');
  });

  it('fails closed in production when secrets are missing or placeholders', () => {
    expect(() => jwtAccessSecretFromEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      'JWT_ACCESS_SECRET must be configured with a non-placeholder value in production.',
    );
    expect(() =>
      jwtRefreshSecretFromConfig(
        configReader({
          JWT_REFRESH_SECRET: 'change-me',
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow('JWT_REFRESH_SECRET must be configured with a non-placeholder value in production.');
  });

  it('keeps dev fallbacks limited to non-production environments', () => {
    expect(jwtAccessSecretFromEnv({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('dev-access-secret');
    expect(
      jwtAccessSecretFromConfig(
        configReader({
          JWT_ACCESS_SECRET: 'password',
          NODE_ENV: 'test',
        }),
      ),
    ).toBe('dev-access-secret');
    expect(jwtRefreshSecretFromConfig(configReader({ NODE_ENV: 'test' }))).toBe('dev-refresh-secret');
  });

  it('does not allow the admin realtime socket secret to reuse the JWT access secret', () => {
    expect(() =>
      adminRealtimeTokenSecretFromConfig(
        configReader({
          ADMIN_REALTIME_TOKEN_SECRET: 'shared-secret',
          JWT_ACCESS_SECRET: 'shared-secret',
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow('ADMIN_REALTIME_TOKEN_SECRET must be separate from JWT_ACCESS_SECRET.');
  });

  it('keeps the Admin Web API token secret separate and production-required', () => {
    expect(() => adminWebApiTokenSecretFromConfig(configReader({ NODE_ENV: 'production' }))).toThrow(
      'ADMIN_WEB_API_TOKEN_SECRET must be configured with a non-placeholder value in production.',
    );
    expect(() =>
      adminWebApiTokenSecretFromConfig(
        configReader({
          ADMIN_WEB_API_TOKEN_SECRET: 'shared-secret',
          ADMIN_REALTIME_TOKEN_SECRET: 'shared-secret',
          NODE_ENV: 'production',
        }),
      ),
    ).toThrow('ADMIN_WEB_API_TOKEN_SECRET must be separate from ADMIN_REALTIME_TOKEN_SECRET.');
  });
});

function configReader(values: Record<string, string | undefined>) {
  return {
    get: <T = string>(key: string) => values[key] as T | undefined,
  };
}
