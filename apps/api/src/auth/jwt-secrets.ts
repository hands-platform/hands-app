type ConfigReader = {
  get<T = string>(key: string): T | undefined;
};

const DEV_JWT_ACCESS_SECRET = 'dev-access-secret';
const DEV_JWT_REFRESH_SECRET = 'dev-refresh-secret';
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

function jwtSecretOrDevFallback(name: string, value: string | undefined, nodeEnv: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed && !INSECURE_SECRET_VALUES.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  if (nodeEnv === 'production') {
    throw new Error(`${name} must be configured with a non-placeholder value in production.`);
  }

  return name === 'JWT_ACCESS_SECRET' ? DEV_JWT_ACCESS_SECRET : DEV_JWT_REFRESH_SECRET;
}
