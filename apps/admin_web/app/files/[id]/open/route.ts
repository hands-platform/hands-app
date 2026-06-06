import { NextResponse } from 'next/server';

import { adminGet } from '../../../../lib/admin-api';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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
