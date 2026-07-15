import { createHmac, randomUUID } from 'node:crypto';

export const ADMIN_WEB_API_TOKEN_TYPE = 'admin-web-api';
export const ADMIN_WEB_API_TOKEN_AUDIENCE = 'hands-api';
export const ADMIN_WEB_API_TOKEN_SCOPE = 'admin:api';
export const ADMIN_WEB_API_TOKEN_TTL_SECONDS = 300;

const DEV_ADMIN_WEB_API_TOKEN_SECRET = 'dev-admin-web-api-token-secret';
const INSECURE_SECRET_VALUES = new Set(['change-me', 'changeme', 'secret', 'password']);

export function createAdminWebApiToken(subject: string, now = new Date(), env = process.env) {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ADMIN_WEB_API_TOKEN_TTL_SECONDS;
  const payload = {
    sub: subject,
    typ: ADMIN_WEB_API_TOKEN_TYPE,
    aud: ADMIN_WEB_API_TOKEN_AUDIENCE,
    scope: ADMIN_WEB_API_TOKEN_SCOPE,
    role: 'ADMIN',
    iat,
    exp,
    jti: randomUUID(),
  };

  return signJwt(payload, adminWebApiTokenSecretFromEnv(env));
}

export function adminWebApiTokenSecretFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const secret = env.ADMIN_WEB_API_TOKEN_SECRET?.trim();
  if (secret && !INSECURE_SECRET_VALUES.has(secret.toLowerCase())) {
    for (const [name, value] of [
      ['ADMIN_ACCESS_TOKEN', env.ADMIN_ACCESS_TOKEN],
      ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
      ['ADMIN_REALTIME_TOKEN_SECRET', env.ADMIN_REALTIME_TOKEN_SECRET],
      ['ADMIN_WEB_SESSION_COOKIE_SECRET', env.ADMIN_WEB_SESSION_COOKIE_SECRET],
    ] as const) {
      if (value?.trim() === secret) {
        throw new Error(`ADMIN_WEB_API_TOKEN_SECRET must be separate from ${name}.`);
      }
    }
    return secret;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('ADMIN_WEB_API_TOKEN_SECRET must be configured in production.');
  }
  return DEV_ADMIN_WEB_API_TOKEN_SECRET;
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
