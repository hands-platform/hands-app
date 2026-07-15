import { NextResponse } from 'next/server';
import {
  adminWebSessionCookieName,
  authenticateAdminWebLogin,
  createAdminWebSessionCookieValue,
  parseAdminWebSessionTtlSeconds,
  verifyAdminWebSessionCookieValue,
  type AdminWebLoginResult,
} from '../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function POST(request: Request) {
  const credentials = await readCredentials(request);
  const storedOperatorLogin = await authenticateStoredAdminOperatorLogin(credentials);
  const login =
    storedOperatorLogin ??
    (process.env.NODE_ENV === 'production'
      ? ({ ok: false, error: 'ADMIN_LOGIN_UNAVAILABLE', status: 503 } satisfies AdminWebLoginResult)
      : authenticateAdminWebLogin(credentials));
  const wantsHtml = request.headers.get('accept')?.includes('text/html') ?? false;

  if (!login.ok) {
    if (wantsHtml) {
      return NextResponse.redirect(new URL('/login?error=invalid', request.url), {
        headers: NO_STORE_HEADERS,
        status: 303,
      });
    }

    return NextResponse.json({ error: login.error }, { headers: NO_STORE_HEADERS, status: login.status });
  }

  const response = wantsHtml
    ? NextResponse.redirect(safeRedirectUrl(request), { headers: NO_STORE_HEADERS, status: 303 })
    : NextResponse.json(
        {
          authenticated: true,
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
  credentials: { email: string; password: string },
): Promise<AdminWebLoginResult | null> {
  const sessionSecret = process.env.ADMIN_WEB_SESSION_COOKIE_SECRET?.trim();
  if (!sessionSecret) {
    return null;
  }

  try {
    const apiBaseUrl = process.env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api';
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/auth/admin-operator-login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(credentials),
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ok: false,
        error: response.status === 401 ? 'INVALID_ADMIN_CREDENTIALS' : 'ADMIN_LOGIN_UNAVAILABLE',
        status: response.status === 401 ? 401 : 503,
      };
    }

    const body = (await response.json()) as {
      authenticated?: unknown;
      user?: { id?: unknown; roles?: unknown };
    };
    if (
      body.authenticated !== true ||
      typeof body.user?.id !== 'string' ||
      !Array.isArray(body.user.roles) ||
      !body.user.roles.includes('ADMIN')
    ) {
      return { ok: false, error: 'INVALID_ADMIN_CREDENTIALS', status: 401 };
    }

    const maxAgeSeconds = parseAdminWebSessionTtlSeconds(process.env.ADMIN_WEB_SESSION_TTL_SECONDS);
    const nowMs = Date.now();
    const sessionCookieValue = createAdminWebSessionCookieValue({
      expiresAtMs: nowMs + maxAgeSeconds * 1000,
      issuedAtMs: nowMs,
      secret: sessionSecret,
      sub: body.user.id,
    });
    const session = verifyAdminWebSessionCookieValue(sessionCookieValue, sessionSecret, nowMs);

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

async function readCredentials(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; password?: unknown; redirectTo?: unknown };

    return {
      email: typeof body.email === 'string' ? body.email : '',
      password: typeof body.password === 'string' ? body.password : '',
    };
  }

  const formData = await request.formData().catch(() => null);

  return {
    email: stringFormValue(formData?.get('email')),
    password: stringFormValue(formData?.get('password')),
  };
}

function safeRedirectUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/';
  const safePath = redirectTo.startsWith('/') && !redirectTo.startsWith('//') ? redirectTo : '/';

  return new URL(safePath, request.url);
}

function stringFormValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === 'string' ? value : '';
}
