import { NextRequest, NextResponse } from 'next/server';

import { CMS_PREVIEW_COOKIE } from '../../../../lib/site-content';

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ message: 'Cross-site preview requests are not allowed' }, { status: 403 });
  }
  const formData = await request.formData().catch(() => null);
  const returnTo = String(formData?.get('returnTo') ?? '').trim();
  if (!validReturnPath(returnTo)) {
    return NextResponse.json({ message: 'Invalid preview exit path' }, { status: 400 });
  }
  const response = NextResponse.redirect(new URL(returnTo, request.nextUrl.origin), 303);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.cookies.set({
    name: CMS_PREVIEW_COOKIE,
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: returnTo,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

function validReturnPath(path: string) {
  return /^\/(?:vi|ko|en|ja|zh)(?:\/[a-z0-9-]+)*$/u.test(path) && path.length <= 512;
}
