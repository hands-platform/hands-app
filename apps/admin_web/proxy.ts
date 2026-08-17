import { NextRequest, NextResponse } from 'next/server';
import { getAdminWebSessionStateWithApi } from './lib/admin-session-api';
import { adminWebSessionCookieSecretFromEnv } from './lib/admin-session-secret';
import type { AdminWebSession } from './lib/admin-session';

const ADMIN_WEB_SESSION_COOKIE_NAME = 'hands_admin_session';
const ADMIN_OPERATOR_CATEGORIES_HEADER = 'x-hands-admin-operator-categories';
const ADMIN_OPERATOR_ID_HEADER = 'x-hands-admin-operator-id';
const ADMIN_OPERATOR_ROLES_HEADER = 'x-hands-admin-operator-roles';
const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestHeaders = requestHeadersWithAdminPathname(request, `${pathname}${search}`);

  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const cookieSession = await getValidAdminWebCookieSession(request);
  if (cookieSession) {
    const serverSession = await getAdminWebSessionStateWithApi(cookieSession);
    if (serverSession.valid) {
      if (serverSession.mfaEnrollmentRequired && pathname !== '/admin-operators') {
        if (isBrowserFacingApi(pathname)) {
          return NextResponse.json(
            { error: 'MFA_ENROLLMENT_REQUIRED' },
            { headers: NO_STORE_HEADERS, status: 403 },
          );
        }
        return NextResponse.redirect(new URL('/admin-operators?mfa=setup', request.url), {
          headers: NO_STORE_HEADERS,
        });
      }
      if (serverSession.operatorAccess) {
        requestHeaders.set(ADMIN_OPERATOR_ID_HEADER, serverSession.operatorAccess.id);
        requestHeaders.set(ADMIN_OPERATOR_ROLES_HEADER, serverSession.operatorAccess.roles.join(','));
        requestHeaders.set(ADMIN_OPERATOR_CATEGORIES_HEADER, serverSession.operatorAccess.categories.join(','));
      }
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
  }

  if (isBrowserFacingApi(pathname)) {
    return NextResponse.json({ error: 'ADMIN_WEB_ACCESS_REQUIRED' }, { headers: NO_STORE_HEADERS, status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirectTo', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl, { headers: NO_STORE_HEADERS });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|txt|webmanifest)$).*)'],
};

async function getValidAdminWebCookieSession(request: NextRequest) {
  const secret = adminWebSessionCookieSecretFromEnv();
  if (!secret) {
    return false;
  }

  const cookieName = process.env.ADMIN_WEB_SESSION_COOKIE_NAME?.trim() || ADMIN_WEB_SESSION_COOKIE_NAME;
  const cookieValue = request.cookies.get(cookieName)?.value;
  if (!cookieValue) {
    return false;
  }

  return verifyAdminWebSessionCookieValue(cookieValue, secret, Date.now());
}

async function verifyAdminWebSessionCookieValue(cookieValue: string, secret: string, nowMs: number) {
  const [payloadSegment, signature, extra] = cookieValue.split('.');
  if (!payloadSegment || !signature || extra) {
    return false;
  }

  const expectedSignature = await signAdminWebSessionPayload(payloadSegment, secret);
  if (!constantTimeStringEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64UrlUtf8(payloadSegment)) as {
      exp?: unknown;
      iat?: unknown;
      jti?: unknown;
      role?: unknown;
      sessionVersion?: unknown;
      sub?: unknown;
      mfaEnrollmentRequired?: unknown;
    };

    const valid =
      payload.role === 'ADMIN' &&
      payload.sessionVersion === 1 &&
      typeof payload.sub === 'string' &&
      typeof payload.iat === 'number' &&
      typeof payload.exp === 'number' &&
      typeof payload.jti === 'string' &&
      (payload.mfaEnrollmentRequired === undefined || typeof payload.mfaEnrollmentRequired === 'boolean') &&
      payload.exp > Math.floor(nowMs / 1000);
    return valid ? (payload as AdminWebSession) : null;
  } catch {
    return null;
  }
}

async function signAdminWebSessionPayload(payloadSegment: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadSegment));

  return base64UrlEncode(new Uint8Array(signature));
}

function isPublicPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname.startsWith('/api/admin/session/') ||
    pathname === '/api/admin/realtime-token' ||
    pathname.startsWith('/r/')
  );
}

function isBrowserFacingApi(pathname: string) {
  if (pathname.startsWith('/api/') || pathname.startsWith('/files/') || pathname === '/reviews/export') {
    return true;
  }

  return false;
}

function requestHeadersWithAdminPathname(request: NextRequest, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ADMIN_OPERATOR_CATEGORIES_HEADER);
  requestHeaders.delete(ADMIN_OPERATOR_ID_HEADER);
  requestHeaders.delete(ADMIN_OPERATOR_ROLES_HEADER);
  requestHeaders.set('x-admin-pathname', pathname);
  return requestHeaders;
}

function constantTimeStringEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function decodeBase64UrlUtf8(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
