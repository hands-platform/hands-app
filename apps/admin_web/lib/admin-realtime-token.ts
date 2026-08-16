import { createHmac, randomUUID } from 'crypto';

export const ADMIN_REALTIME_TOKEN_TYPE = 'admin-realtime';
export const ADMIN_REALTIME_TOKEN_AUDIENCE = 'hands-socket';
export const ADMIN_REALTIME_TOKEN_SCOPE = 'admin:realtime';
export const ADMIN_REALTIME_TOKEN_TTL_SECONDS = 120;

const DEV_ADMIN_REALTIME_TOKEN_SECRET = 'dev-admin-realtime-token-secret';
const INSECURE_SECRET_VALUES = new Set(['change-me', 'changeme', 'secret', 'password']);
const MINIMUM_PRODUCTION_SECRET_LENGTH = 32;

type AdminRealtimeTokenResult = {
  expiresAt: string;
  token: string;
};

export function createAdminRealtimeToken(
  subject: string,
  sessionId: string = randomUUID(),
  now = new Date(),
  developmentFallback = false,
): AdminRealtimeTokenResult {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject) {
    throw new Error('Admin realtime token subject is required.');
  }
  const normalizedSessionId = sessionId.trim();
  if (!normalizedSessionId) {
    throw new Error('Admin realtime token session id is required.');
  }
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + ADMIN_REALTIME_TOKEN_TTL_SECONDS;
  const payload = {
    sub: normalizedSubject,
    typ: ADMIN_REALTIME_TOKEN_TYPE,
    aud: ADMIN_REALTIME_TOKEN_AUDIENCE,
    scope: ADMIN_REALTIME_TOKEN_SCOPE,
    role: 'ADMIN',
    iat,
    exp,
    jti: normalizedSessionId,
    ...(developmentFallback ? { developmentFallback: true } : {}),
  };

  return {
    token: signJwt(payload, adminRealtimeTokenSecretFromEnv()),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function adminRealtimeTokenSecretFromEnv(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && env.ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN === 'true') {
    throw new Error('ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN must be disabled in production.');
  }

  const trimmed = env.ADMIN_REALTIME_TOKEN_SECRET?.trim();
  if (trimmed && !INSECURE_SECRET_VALUES.has(trimmed.toLowerCase())) {
    if (trimmed === env.ADMIN_ACCESS_TOKEN?.trim()) {
      throw new Error('ADMIN_REALTIME_TOKEN_SECRET must be separate from ADMIN_ACCESS_TOKEN.');
    }
    if (trimmed === env.JWT_ACCESS_SECRET?.trim()) {
      throw new Error('ADMIN_REALTIME_TOKEN_SECRET must be separate from JWT_ACCESS_SECRET.');
    }
    for (const [name, value] of [
      ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
      ['ADMIN_WEB_API_TOKEN_SECRET', env.ADMIN_WEB_API_TOKEN_SECRET],
      ['ADMIN_WEB_SESSION_COOKIE_SECRET', env.ADMIN_WEB_SESSION_COOKIE_SECRET],
    ] as const) {
      if (value?.trim() === trimmed) {
        throw new Error(`ADMIN_REALTIME_TOKEN_SECRET must be separate from ${name}.`);
      }
    }
    if (env.NODE_ENV === 'production' && trimmed.length < MINIMUM_PRODUCTION_SECRET_LENGTH) {
      throw new Error('ADMIN_REALTIME_TOKEN_SECRET must contain at least 32 characters in production.');
    }
    return trimmed;
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('ADMIN_REALTIME_TOKEN_SECRET must be configured in production.');
  }

  if (env.NODE_ENV !== 'test') {
    console.warn('ADMIN_REALTIME_TOKEN_SECRET is missing; using development-only realtime token secret.');
  }
  return DEV_ADMIN_REALTIME_TOKEN_SECRET;
}

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const signature = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
