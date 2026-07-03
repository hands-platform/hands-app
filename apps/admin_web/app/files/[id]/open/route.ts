import { NextResponse } from 'next/server';

import { adminGet } from '../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../lib/admin-session';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { headers: { 'cache-control': 'no-store', pragma: 'no-cache' }, status: access.status },
    );
  }

  const { id } = await context.params;
  const result = await adminGet<{ read?: { url?: string } }>(
    `/files/${encodeURIComponent(id)}/read-url`,
    {},
  );

  if (!result.read?.url) {
    return NextResponse.json({ error: 'Private file read URL is not available.' }, { status: 404 });
  }

  return NextResponse.redirect(result.read.url);
}
