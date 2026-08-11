import { NextResponse } from 'next/server';
import { adminRealtimeSocketBaseUrl } from '../../../../lib/admin-api';
import { createAdminRealtimeToken } from '../../../../lib/admin-realtime-token';
import { requireAdminWebAccess } from '../../../../lib/admin-session';

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
    const subject =
      access.session?.sub ??
      process.env.ADMIN_WEB_LOGIN_EMAIL?.trim() ??
      process.env.ADMIN_DEMO_PHONE?.trim() ??
      'admin-web-dev';
    const realtimeToken = createAdminRealtimeToken(subject);
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
