export function corsOriginFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS must be configured in production when credentials are enabled.');
  }

  return true;
}
