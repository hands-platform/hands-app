import { NextResponse } from 'next/server';
import { adminWebSessionCookieName } from '../../../../../lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
};

export async function POST(request: Request) {
  const wantsHtml = request.headers.get('accept')?.includes('text/html') ?? false;
  const response = wantsHtml
    ? NextResponse.redirect(new URL('/login', request.url), { headers: NO_STORE_HEADERS, status: 303 })
    : NextResponse.json({ ok: true }, { headers: NO_STORE_HEADERS });

  response.cookies.set({
    httpOnly: true,
    maxAge: 0,
    name: adminWebSessionCookieName(),
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    value: '',
  });

  return response;
}
