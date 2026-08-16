const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;
const INSECURE_SECRET_VALUES = new Set(['change-me', 'changeme', 'secret', 'password']);

export function adminWebSessionCookieSecretFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.ADMIN_WEB_SESSION_COOKIE_SECRET?.trim();
  if (!secret) {
    return null;
  }

  if (
    env.NODE_ENV === 'production' &&
    (INSECURE_SECRET_VALUES.has(secret.toLowerCase()) || secret.length < MINIMUM_PRODUCTION_SECRET_LENGTH)
  ) {
    throw new Error('ADMIN_WEB_SESSION_COOKIE_SECRET must contain at least 32 non-placeholder characters in production.');
  }

  for (const [name, value] of [
    ['ADMIN_ACCESS_TOKEN', env.ADMIN_ACCESS_TOKEN],
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['ADMIN_REALTIME_TOKEN_SECRET', env.ADMIN_REALTIME_TOKEN_SECRET],
    ['ADMIN_WEB_API_TOKEN_SECRET', env.ADMIN_WEB_API_TOKEN_SECRET],
  ] as const) {
    if (value?.trim() === secret) {
      throw new Error(`ADMIN_WEB_SESSION_COOKIE_SECRET must be separate from ${name}.`);
    }
  }

  return secret;
}
