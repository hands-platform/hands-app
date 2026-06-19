import { NextResponse } from 'next/server';
import { adminRealtimeSocketBaseUrl, getAdminAccessToken } from '../../../../lib/admin-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const token = await getAdminAccessToken();
    return NextResponse.json(
      {
        socketBaseUrl: adminRealtimeSocketBaseUrl(),
        token,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'REALTIME_TOKEN_UNAVAILABLE' },
      { headers: { 'cache-control': 'no-store' }, status: 503 },
    );
  }
}
