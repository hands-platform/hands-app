import { NextResponse } from 'next/server';
import {
  adminWebSessionCookieName,
  authenticateAdminWebLogin,
} from '../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function POST(request: Request) {
  const credentials = await readCredentials(request);
  const login = authenticateAdminWebLogin(credentials);
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
