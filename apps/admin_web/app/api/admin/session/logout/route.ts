import { NextResponse } from 'next/server';
import { adminWebSessionCookieName, requireAdminWebAccess } from '../../../../../lib/admin-session';
import { revokeAdminWebSessionWithApi } from '../../../../../lib/admin-session-api';
import { isSameOriginMutationRequest } from '../../../../../lib/same-origin-request';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function POST(request: Request) {
  if (!isSameOriginMutationRequest(request)) {
    return NextResponse.json({ error: 'CROSS_SITE_LOGOUT_REJECTED' }, { headers: NO_STORE_HEADERS, status: 403 });
  }
  const access = requireAdminWebAccess(request);
  const revocationResult = access.allowed && access.session
    ? await revokeAdminWebSessionWithApi(access.session)
    : 'inactive';
  const sessionEnded = revocationResult !== 'unavailable';
  const wantsHtml = request.headers.get('accept')?.includes('text/html') ?? false;
  const response = wantsHtml
    ? NextResponse.redirect(new URL(sessionEnded ? '/login' : '/login?logoutError=session-revocation', request.url), {
        headers: NO_STORE_HEADERS,
        status: 303,
      })
    : NextResponse.json(
        sessionEnded
          ? { ok: true }
          : { error: 'ADMIN_SESSION_REVOCATION_FAILED', ok: false },
        { headers: NO_STORE_HEADERS, status: sessionEnded ? 200 : 503 },
      );

  if (sessionEnded) {
    response.cookies.set({
      httpOnly: true,
      maxAge: 0,
      name: adminWebSessionCookieName(),
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      value: '',
    });
  }

  return response;
}
