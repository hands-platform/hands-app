import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      error: 'GEOAPIFY_TILE_PROXY_RETIRED',
      replacement: '/api/admin/maptiler-tiles/[z]/[x]/[y].png',
    },
    { status: 410 },
  );
}
