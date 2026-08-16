import { NextResponse } from 'next/server';
import { adminRealtimeSocketBaseUrl } from '../../../../lib/admin-api';
import { createAdminRealtimeToken } from '../../../../lib/admin-realtime-token';
import { requireAdminWebAccess } from '../../../../lib/admin-session';
import { getAdminWebSessionStateWithApi } from '../../../../lib/admin-session-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: Request) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: NO_STORE_HEADERS, status: access.status });
  }

  try {
    if (access.session) {
      const sessionState = await getAdminWebSessionStateWithApi(access.session);
      if (!sessionState.valid) {
        return NextResponse.json(
          { error: 'ADMIN_WEB_ACCESS_REQUIRED' },
          { headers: NO_STORE_HEADERS, status: 401 },
        );
      }
      if (sessionState.mfaEnrollmentRequired) {
        return NextResponse.json(
          { error: 'MFA_ENROLLMENT_REQUIRED' },
          { headers: NO_STORE_HEADERS, status: 403 },
        );
      }
    }
    const subject =
      access.session?.sub ??
      process.env.ADMIN_WEB_LOGIN_EMAIL?.trim() ??
      process.env.ADMIN_DEMO_PHONE?.trim() ??
      'admin-web-dev';
    const realtimeToken = createAdminRealtimeToken(
      subject,
      access.session?.jti,
      new Date(),
      access.mode === 'dev-fallback',
    );
    return NextResponse.json(
      {
        socketBaseUrl: adminRealtimeSocketBaseUrl(),
        token: realtimeToken.token,
        expiresAt: realtimeToken.expiresAt,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: 'REALTIME_TOKEN_UNAVAILABLE' },
      { headers: NO_STORE_HEADERS, status: 503 },
    );
  }
}
