import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import {
  adminWebSessionCookieName,
  authenticateAdminWebLogin,
  createAdminWebSessionCookieValue,
  parseAdminWebSessionTtlSeconds,
  verifyAdminWebSessionCookieValue,
  type AdminWebLoginResult,
} from '../../../../../lib/admin-session';
import { isSameOriginMutationRequest } from '../../../../../lib/same-origin-request';
import { adminWebSessionCookieSecretFromEnv } from '../../../../../lib/admin-session-secret';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

type StoredAdminWebLoginResult =
  | AdminWebLoginResult
  | {
      ok: false;
      error: 'ADMIN_LOGIN_RATE_LIMITED';
      retryAfterSeconds?: string;
      status: 429;
    };

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json(
      { error: 'CROSS_SITE_LOGIN_REJECTED' },
      { headers: NO_STORE_HEADERS, status: 403 },
    );
  }
  const credentials = await readCredentials(request);
  const storedOperatorLogin = await authenticateStoredAdminOperatorLogin(credentials, request);
  const login =
    storedOperatorLogin ??
    (process.env.NODE_ENV === 'production'
      ? ({ ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 } satisfies AdminWebLoginResult)
      : authenticateAdminWebLogin(credentials));
  const wantsHtml = request.headers.get('accept')?.includes('text/html') ?? false;

  if (!login.ok) {
    if (wantsHtml) {
      const error = login.status === 429 ? 'rate_limited' : 'invalid';
      return NextResponse.redirect(new URL(`/login?error=${error}`, request.url), {
        headers: NO_STORE_HEADERS,
        status: 303,
      });
    }

    return NextResponse.json(
      { error: login.error },
      {
        headers: {
          ...NO_STORE_HEADERS,
          ...(login.status === 429 && login.retryAfterSeconds
            ? { 'retry-after': login.retryAfterSeconds }
            : {}),
        },
        status: login.status,
      },
    );
  }

  const response = wantsHtml
    ? NextResponse.redirect(safeRedirectUrl(request, login.session.mfaEnrollmentRequired === true), {
        headers: NO_STORE_HEADERS,
        status: 303,
      })
    : NextResponse.json(
        {
          authenticated: true,
          mfaEnrollmentRequired: login.session.mfaEnrollmentRequired === true,
          role: login.session.role,
          sub: login.session.sub,
        },
        { headers: NO_STORE_HEADERS },
      );

  response.cookies.set({
    httpOnly: true,
    maxAge: login.maxAgeSeconds,
    name: adminWebSessionCookieName(),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: login.sessionCookieValue,
  });

  return response;
}

async function authenticateStoredAdminOperatorLogin(
  credentials: { email: string; mfaCode?: string; password: string },
  request: Request,
): Promise<StoredAdminWebLoginResult | null> {
  const sessionSecret = adminWebSessionCookieSecretFromEnv();
  if (!sessionSecret) {
    return null;
  }

  try {
    const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': request.headers.get('user-agent')?.trim().slice(0, 200) || 'HANDS Admin Web BFF',
    };
    const clientIp = trustedIngressClientIp(request);
    if (clientIp) headers['x-forwarded-for'] = clientIp;

    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/admin-operator-login`, {
      method: 'POST',
      headers,
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          ok: false,
          error: 'ADMIN_LOGIN_RATE_LIMITED',
          retryAfterSeconds: response.headers.get('retry-after') ?? undefined,
          status: 429,
        };
      }
      return {
        ok: false,
        error: response.status === 401 ? 'INVALID_ADMIN_CREDENTIALS' : 'ADMIN_LOGIN_UNAVAILABLE',
        status: response.status === 401 ? 401 : 503,
      };
    }

    const body = (await response.json()) as {
      authenticated?: unknown;
      user?: { id?: unknown; roles?: unknown };
      session?: {
        id?: unknown;
        issuedAt?: unknown;
        expiresAt?: unknown;
        mfaEnrollmentRequired?: unknown;
      };
    };
    if (
      body.authenticated !== true ||
      typeof body.user?.id !== 'string' ||
      !Array.isArray(body.user.roles) ||
      !body.user.roles.includes('ADMIN') ||
      typeof body.session?.id !== 'string' ||
      typeof body.session.issuedAt !== 'string' ||
      typeof body.session.expiresAt !== 'string'
    ) {
      return { ok: false, error: 'INVALID_ADMIN_CREDENTIALS', status: 401 };
    }

    const issuedAtMs = Date.parse(body.session.issuedAt);
    const expiresAtMs = Date.parse(body.session.expiresAt);
    if (!Number.isFinite(issuedAtMs) || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return { ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 };
    }
    const configuredMaxAge = parseAdminWebSessionTtlSeconds(process.env.ADMIN_WEB_SESSION_TTL_SECONDS);
    const maxAgeSeconds = Math.min(configuredMaxAge, Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000)));
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs,
      issuedAtMs,
      jti: body.session.id,
      mfaEnrollmentRequired: body.session.mfaEnrollmentRequired === true,
      secret: sessionSecret,
      sub: body.user.id,
    });
    const session = verifyAdminWebSessionCookieValue(sessionCookieValue, sessionSecret);

    return session
      ? {
          ok: true,
          maxAgeSeconds,
          session,
          sessionCookieValue,
        }
      : { ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 };
  } catch {
    return null;
  }
}

function trustedIngressClientIp(request: Request) {
  if (process.env.ADMIN_WEB_TRUST_X_REAL_IP?.trim().toLowerCase() !== 'true') {
    return null;
  }
  const clientIp = request.headers.get('x-real-ip')?.trim() ?? '';
  return isIP(clientIp) ? clientIp : null;
}

async function readCredentials(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      mfaCode?: unknown;
      password?: unknown;
      redirectTo?: unknown;
    };

    return {
      email: typeof body.email === 'string' ? body.email : '',
      mfaCode: typeof body.mfaCode === 'string' ? body.mfaCode : '',
      password: typeof body.password === 'string' ? body.password : '',
    };
  }

  const formData = await request.formData().catch(() => null);

  return {
    email: stringFormValue(formData?.get('email')),
    mfaCode: stringFormValue(formData?.get('mfaCode')),
    password: stringFormValue(formData?.get('password')),
  };
}

function safeRedirectUrl(request: Request, mfaEnrollmentRequired = false) {
  if (mfaEnrollmentRequired) {
    return new URL('/admin-operators?mfa=setup', request.url);
  }
  const requestUrl = new URL(request.url);
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/';
  const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';

  return new URL(safePath, request.url);
}

function stringFormValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === 'string' ? value : '';
}
