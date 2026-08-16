import { NextResponse } from 'next/server';
import { getAdminWebSession } from '../../../../../lib/admin-session';
import { getAdminWebSessionStateWithApi } from '../../../../../lib/admin-session-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function GET(request: Request) {
  const session = getAdminWebSession(request);
  const state = session ? await getAdminWebSessionStateWithApi(session) : null;

  if (!session || !state?.valid) {
    return NextResponse.json({ authenticated: false }, { headers: NO_STORE_HEADERS, status: 401 });
  }

  return NextResponse.json(
    {
      authenticated: true,
      mfaEnrollmentRequired: state.mfaEnrollmentRequired,
      role: session.role,
      sub: session.sub,
    },
    { headers: NO_STORE_HEADERS },
  );
}
