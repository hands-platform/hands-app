import { NextResponse } from 'next/server';
import { getAdminWebSession } from '../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: Request) {
  const session = getAdminWebSession(request);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE_HEADERS, status: 401 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      role: session.role,
      sub: session.sub,
    },
    { headers: NO_STORE_HEADERS },
  );
}
