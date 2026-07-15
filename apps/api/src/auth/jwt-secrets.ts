type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

const DEV_JWT_ACCESS_SECRET = 'dev-access-secret';
const DEV_JWT_REFRESH_SECRET = 'dev-refresh-secret';
const DEV_ADMIN_REALTIME_TOKEN_SECRET = 'dev-admin-realtime-token-secret';
const DEV_ADMIN_WEB_API_TOKEN_SECRET = 'dev-admin-web-api-token-secret';
const INSECURE_SECRET_VALUES = new Set(['change-me', 'changeme', 'secret', 'password']);

export function jwtAccessSecretFromEnv(env: NodeJS.ProcessEnv = process.env) {
  return jwtSecretOrDevFallback('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET, env.NODE_ENV);
}

export function jwtAccessSecretFromConfig(config: ConfigReader) {
  return jwtSecretOrDevFallback(
    'JWT_ACCESS_SECRET',
    config.get<string>('JWT_ACCESS_SECRET'),
    config.get<string>('NODE_ENV'),
  );
}

export function jwtRefreshSecretFromConfig(config: ConfigReader) {
  return jwtSecretOrDevFallback(
    'JWT_REFRESH_SECRET',
    config.get<string>('JWT_REFRESH_SECRET'),
    config.get<string>('NODE_ENV'),
  );
}

export function adminRealtimeTokenSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'ADMIN_REALTIME_TOKEN_SECRET',
    config.get<string>('ADMIN_REALTIME_TOKEN_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  const accessSecret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
  if (accessSecret && secret === accessSecret) {
    throw new Error('ADMIN_REALTIME_TOKEN_SECRET must be separate from JWT_ACCESS_SECRET.');
  }
  return secret;
}

export function adminWebApiTokenSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'ADMIN_WEB_API_TOKEN_SECRET',
    config.get<string>('ADMIN_WEB_API_TOKEN_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  for (const name of ['JWT_ACCESS_SECRET', 'ADMIN_REALTIME_TOKEN_SECRET', 'ADMIN_WEB_SESSION_COOKIE_SECRET']) {
    const value = config.get<string>(name)?.trim();
    if (value && value === secret) {
      throw new Error(`ADMIN_WEB_API_TOKEN_SECRET must be separate from ${name}.`);
    }
  }
  return secret;
}

function jwtSecretOrDevFallback(name: string, value: string | undefined, nodeEnv: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed && !INSECURE_SECRET_VALUES.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  if (nodeEnv === 'production') {
    throw new Error(`${name} must be configured with a non-placeholder value in production.`);
  }

  return devSecretFor(name);
}

function devSecretFor(name: string) {
  switch (name) {
    case 'JWT_ACCESS_SECRET':
      return DEV_JWT_ACCESS_SECRET;
    case 'JWT_REFRESH_SECRET':
      return DEV_JWT_REFRESH_SECRET;
    case 'ADMIN_REALTIME_TOKEN_SECRET':
      return DEV_ADMIN_REALTIME_TOKEN_SECRET;
    case 'ADMIN_WEB_API_TOKEN_SECRET':
      return DEV_ADMIN_WEB_API_TOKEN_SECRET;
    default:
      return DEV_JWT_ACCESS_SECRET;
  }
}
