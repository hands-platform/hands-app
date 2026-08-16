import { NextRequest, NextResponse } from 'next/server';

import { CMS_PREVIEW_COOKIE, fetchPublicSitePreview } from '../../../lib/site-content';

const PREVIEW_COOKIE_MAX_AGE_SECONDS = 10 * 60;

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: 'Cross-site preview requests are not allowed' }, { status: 403 });
  }

  const input = await request.json().catch(() => null) as { path?: unknown; token?: unknown } | null;
  const token = typeof input?.token === 'string' ? input.token.trim() : '';
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  if (!token || token.length > 4_096 || !validCookiePath(path)) {
    return NextResponse.json({ message: 'Invalid preview request' }, { status: 400 });
  }

  try {
    await fetchPublicSitePreview(token);
  } catch {
    return NextResponse.json({ message: 'Preview token is invalid or expired' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.cookies.set({
    name: CMS_PREVIEW_COOKIE,
    value: token,
    httpOnly: true,
    maxAge: PREVIEW_COOKIE_MAX_AGE_SECONDS,
    path,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

function validCookiePath(path: string) {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && path.length <= 512;
}
