type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

const DEV_JWT_ACCESS_SECRET = 'dev-access-secret';
const DEV_JWT_REFRESH_SECRET = 'dev-refresh-secret';
const DEV_ADMIN_REALTIME_TOKEN_SECRET = 'dev-admin-realtime-token-secret';
const DEV_ADMIN_WEB_API_TOKEN_SECRET = 'dev-admin-web-api-token-secret';
const INSECURE_SECRET_VALUES = new Set(['change-me', 'changeme', 'secret', 'password']);
const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
const SECRET_NAMES = [
  'ADMIN_ACCESS_TOKEN',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_REALTIME_TOKEN_SECRET',
  'ADMIN_WEB_API_TOKEN_SECRET',
  'ADMIN_WEB_SESSION_COOKIE_SECRET',
] as const;

export function jwtAccessSecretFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const secret = jwtSecretOrDevFallback('JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET, env.NODE_ENV);
  assertSeparate('JWT_ACCESS_SECRET', secret, (name) => env[name]);
  return secret;
}

export function jwtAccessSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'JWT_ACCESS_SECRET',
    config.get<string>('JWT_ACCESS_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  assertSeparate('JWT_ACCESS_SECRET', secret, (name) => config.get<string>(name));
  return secret;
}

export function jwtRefreshSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'JWT_REFRESH_SECRET',
    config.get<string>('JWT_REFRESH_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  assertSeparate('JWT_REFRESH_SECRET', secret, (name) => config.get<string>(name));
  return secret;
}

export function adminRealtimeTokenSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'ADMIN_REALTIME_TOKEN_SECRET',
    config.get<string>('ADMIN_REALTIME_TOKEN_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  assertSeparate('ADMIN_REALTIME_TOKEN_SECRET', secret, (name) => config.get<string>(name));
  return secret;
}

export function adminWebApiTokenSecretFromConfig(config: ConfigReader) {
  const secret = jwtSecretOrDevFallback(
    'ADMIN_WEB_API_TOKEN_SECRET',
    config.get<string>('ADMIN_WEB_API_TOKEN_SECRET'),
    config.get<string>('NODE_ENV'),
  );
  assertSeparate('ADMIN_WEB_API_TOKEN_SECRET', secret, (name) => config.get<string>(name));
  return secret;
}

function jwtSecretOrDevFallback(name: string, value: string | undefined, nodeEnv: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed && !INSECURE_SECRET_VALUES.has(trimmed.toLowerCase())) {
    if (nodeEnv === 'production' && trimmed.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
      throw new Error(`${name} must contain at least 32 characters in production.`);
    }
    return trimmed;
  }

  if (nodeEnv === 'production') {
    throw new Error(`${name} must be configured with a non-placeholder value in production.`);
  }

  return devSecretFor(name);
}

function assertSeparate(
  name: string,
  secret: string,
  valueFor: (otherName: (typeof SECRET_NAMES)[number]) => string | undefined,
) {
  for (const otherName of SECRET_NAMES) {
    if (otherName === name) continue;
    if (valueFor(otherName)?.trim() === secret) {
      throw new Error(`${name} must be separate from ${otherName}.`);
    }
  }
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
