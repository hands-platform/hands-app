import { createHmac, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { adminWebSessionCookieSecretFromEnv } from './admin-session-secret';

export const ADMIN_WEB_SESSION_COOKIE_NAME = 'hands_admin_session';
export const ADMIN_WEB_SESSION_DEFAULT_TTL_SECONDS = 2 * 60 * 60;
export const ADMIN_WEB_SESSION_MAX_TTL_SECONDS = 8 * 60 * 60;

const DEV_REALTIME_ACCESS_FLAG = 'true';
const DEV_LOGIN_FLAG = 'true';
const PASSWORD_HASH_BYTES = 64;

export type AdminWebSession = {
  exp: number;
  iat: number;
  jti: string;
  role: 'ADMIN';
  sessionVersion: 1;
  sub: string;
  mfaEnrollmentRequired?: boolean;
};

type AdminWebAccessAllowed = {
  allowed: true;
  mode: 'session-cookie' | 'dev-fallback';
  session?: AdminWebSession;
};

type AdminWebAccessDenied = {
  allowed: false;
  error: 'ADMIN_WEB_ACCESS_REQUIRED';
  status: 401;
};

export type AdminWebAccessResult = AdminWebAccessAllowed | AdminWebAccessDenied;

type AdminWebSessionCookieOptions = {
  expiresAtMs: number;
  issuedAtMs?: number;
  jti?: string;
  role?: 'ADMIN';
  secret: string;
  sessionVersion?: 1;
  sub?: string;
  mfaEnrollmentRequired?: boolean;
};

export type AdminWebLoginResult =
  | {
      ok: true;
      maxAgeSeconds: number;
      session: AdminWebSession;
      sessionCookieValue: string;
    }
  | {
      ok: false;
      error: 'ADMIN_LOGIN_UNAVAILABLE' | 'INVALID_ADMIN_CREDENTIALS';
      status: 401 | 503;
    };

export function requireAdminWebAccess(
  request: Pick<Request, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now(),
): AdminWebAccessResult {
  const session = getAdminWebSession(request, env, nowMs);
  if (session) {
    return { allowed: true, mode: 'session-cookie', session };
  }

  if (isDevRealtimeTokenFallbackAllowed(env)) {
    return { allowed: true, mode: 'dev-fallback' };
  }

  return { allowed: false, error: 'ADMIN_WEB_ACCESS_REQUIRED', status: 401 };
}

export function getAdminWebSession(
  request: Pick<Request, 'headers'>,
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now(),
) {
  const secret = adminWebSessionCookieSecretFromEnv(env);
  if (!secret) {
    return null;
  }

  const cookieName = adminWebSessionCookieName(env);
  const cookieValue = getCookieValue(request.headers.get('cookie'), cookieName);
  if (!cookieValue) {
    return null;
  }

  return verifyAdminWebSessionCookieValue(cookieValue, secret, nowMs);
}

export function authenticateAdminWebLogin(
  credentials: { email: string; password: string },
  env: NodeJS.ProcessEnv = process.env,
  nowMs = Date.now(),
): AdminWebLoginResult {
  if (isProductionDevLoginFallbackConfigured(env)) {
    return { ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 };
  }

  const email = env.ADMIN_WEB_LOGIN_EMAIL?.trim().toLowerCase();
  const sessionSecret = adminWebSessionCookieSecretFromEnv(env);
  const requestedEmail = credentials.email.trim().toLowerCase();

  if (!email || !sessionSecret || requestedEmail !== email) {
    return loginError(env, hasAdminLoginConfiguration(env) ? 'INVALID_ADMIN_CREDENTIALS' : 'ADMIN_LOGIN_UNAVAILABLE');
  }

  const passwordMatches = verifyAdminWebPassword(credentials.password, env);
  if (!passwordMatches) {
    return loginError(env, hasAdminLoginConfiguration(env) ? 'INVALID_ADMIN_CREDENTIALS' : 'ADMIN_LOGIN_UNAVAILABLE');
  }

  const maxAgeSeconds = parseAdminWebSessionTtlSeconds(env.ADMIN_WEB_SESSION_TTL_SECONDS);
  const expiresAtMs = nowMs + maxAgeSeconds * 1000;
  const sessionCookieValue = createAdminWebSessionCookieValue({
    expiresAtMs,
    issuedAtMs: nowMs,
    secret: sessionSecret,
    sub: email,
  });
  const session = verifyAdminWebSessionCookieValue(sessionCookieValue, sessionSecret, nowMs);

  if (!session) {
    return { ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 };
  }

  return {
    ok: true,
    maxAgeSeconds,
    session,
    sessionCookieValue,
  };
}

export function createAdminWebSessionCookieValue({
  expiresAtMs,
  issuedAtMs,
  jti = randomUUID(),
  role = 'ADMIN',
  secret,
  sessionVersion = 1,
  sub = 'admin-web',
  mfaEnrollmentRequired = false,
}: AdminWebSessionCookieOptions) {
  const payload: AdminWebSession = {
    exp: Math.floor(expiresAtMs / 1000),
    iat: Math.floor((issuedAtMs ?? Date.now()) / 1000),
    jti,
    role,
    sessionVersion,
    sub,
    mfaEnrollmentRequired,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signAdminWebSessionPayload(payloadSegment, secret);

  return `${payloadSegment}.${signature}`;
}

export function verifyAdminWebSessionCookieValue(
  cookieValue: string,
  secret: string,
  nowMs = Date.now(),
): AdminWebSession | null {
  const [payloadSegment, signature, extra] = cookieValue.split('.');
  if (!payloadSegment || !signature || extra) {
    return null;
  }

  const expectedSignature = signAdminWebSessionPayload(payloadSegment, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadSegment, 'base64url').toString('utf8')) as Partial<AdminWebSession>;
    if (
      payload.role !== 'ADMIN' ||
      payload.sessionVersion !== 1 ||
      typeof payload.sub !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      typeof payload.jti !== 'string' ||
      (payload.mfaEnrollmentRequired !== undefined && typeof payload.mfaEnrollmentRequired !== 'boolean')
    ) {
      return null;
    }

    if (payload.exp <= Math.floor(nowMs / 1000)) {
      return null;
    }

    return payload as AdminWebSession;
  } catch {
    return null;
  }
}

export function hashAdminWebPasswordForEnv(password: string, salt: string) {
  return scryptSync(password, salt, PASSWORD_HASH_BYTES).toString('base64url');
}

export function adminWebSessionCookieName(env: NodeJS.ProcessEnv = process.env) {
  return env.ADMIN_WEB_SESSION_COOKIE_NAME?.trim() || ADMIN_WEB_SESSION_COOKIE_NAME;
}

export function parseAdminWebSessionTtlSeconds(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ADMIN_WEB_SESSION_DEFAULT_TTL_SECONDS;
  }

  return Math.min(Math.floor(parsed), ADMIN_WEB_SESSION_MAX_TTL_SECONDS);
}

function verifyAdminWebPassword(password: string, env: NodeJS.ProcessEnv) {
  const hash = env.ADMIN_WEB_LOGIN_PASSWORD_HASH?.trim();
  const salt = env.ADMIN_WEB_LOGIN_PASSWORD_SALT?.trim();
  if (hash && salt) {
    return constantTimeEqual(hashAdminWebPasswordForEnv(password, salt), hash);
  }

  if (env.NODE_ENV !== 'production' && env.ADMIN_WEB_ALLOW_DEV_LOGIN === DEV_LOGIN_FLAG) {
    const devPassword = env.ADMIN_WEB_LOGIN_PASSWORD;
    return typeof devPassword === 'string' && devPassword.length > 0 && constantTimeEqual(password, devPassword);
  }

  return false;
}

function hasAdminLoginConfiguration(env: NodeJS.ProcessEnv) {
  if (isProductionDevLoginFallbackConfigured(env)) {
    return false;
  }

  if (!env.ADMIN_WEB_SESSION_COOKIE_SECRET?.trim() || !env.ADMIN_WEB_LOGIN_EMAIL?.trim()) {
    return false;
  }

  if (env.ADMIN_WEB_LOGIN_PASSWORD_HASH?.trim() && env.ADMIN_WEB_LOGIN_PASSWORD_SALT?.trim()) {
    return true;
  }

  return env.NODE_ENV !== 'production' && env.ADMIN_WEB_ALLOW_DEV_LOGIN === DEV_LOGIN_FLAG && Boolean(env.ADMIN_WEB_LOGIN_PASSWORD);
}

function loginError(
  env: NodeJS.ProcessEnv,
  error: 'ADMIN_LOGIN_UNAVAILABLE' | 'INVALID_ADMIN_CREDENTIALS',
): AdminWebLoginResult {
  if (error === 'ADMIN_LOGIN_UNAVAILABLE' || !hasAdminLoginConfiguration(env)) {
    return { ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 };
  }

  return { ok: false, error: 'INVALID_ADMIN_CREDENTIALS', status: 401 };
}

function isDevRealtimeTokenFallbackAllowed(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV !== 'production' && env.ADMIN_WEB_ALLOW_DEV_REALTIME_TOKEN === DEV_REALTIME_ACCESS_FLAG;
}

function isProductionDevLoginFallbackConfigured(env: NodeJS.ProcessEnv) {
  return env.NODE_ENV === 'production' && env.ADMIN_WEB_ALLOW_DEV_LOGIN === DEV_LOGIN_FLAG;
}

function signAdminWebSessionPayload(payloadSegment: string, secret: string) {
  return createHmac('sha256', secret).update(payloadSegment).digest('base64url');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const segment of cookieHeader.split(';')) {
    const [rawName, ...rawValueParts] = segment.trim().split('=');
    if (rawName === name) {
      return rawValueParts.join('=');
    }
  }

  return null;
}
