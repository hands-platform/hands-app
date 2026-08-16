import { NextResponse } from 'next/server';

import {
  isVietnamOverviewMapTilerTile,
  VIETNAM_MAPTILER_TILE_VIEW,
} from '../../../../../../vietnam-overview/vietnam-overview-model';
import { requireAdminWebAccess } from '../../../../../../../lib/admin-session';
import { verifyAdminWebSessionWithApi } from '../../../../../../../lib/admin-session-api';

const tileCacheSeconds = 60 * 60 * 24;
const noStoreHeaders = { 'cache-control': 'no-store' };

type RouteContext = {
  params: Promise<{
    x: string;
    y: string;
    z: string;
  }>;
};

export const runtime = 'nodejs';

export async function GET(request: Request, context: RouteContext) {
  const access = requireAdminWebAccess(request);
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { headers: noStoreHeaders, status: access.status });
  }
  if (access.session && !(await verifyAdminWebSessionWithApi(access.session))) {
    return NextResponse.json(
      { error: 'ADMIN_WEB_ACCESS_REQUIRED' },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const params = await context.params;
  const z = parseTileCoordinate(params.z);
  const x = parseTileCoordinate(params.x);
  const y = parseTileCoordinate(params.y);

  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
    return NextResponse.json({ error: 'INVALID_TILE_COORDINATES' }, { status: 400 });
  }

  if (!isVietnamOverviewMapTilerTile(z, x, y)) {
    return NextResponse.json({ error: 'TILE_OUTSIDE_VIETNAM_OVERVIEW' }, { status: 404 });
  }

  const apiKey = process.env.MAPTILER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'MAPTILER_API_KEY_MISSING' }, { status: 503 });
  }

  const tileUrl = new URL(
    `https://api.maptiler.com/maps/${VIETNAM_MAPTILER_TILE_VIEW.style}/256/${z}/${x}/${y}.png`,
  );
  tileUrl.searchParams.set('key', apiKey);

  const response = await fetch(tileUrl, {
    headers: {
      accept: 'image/png,image/*;q=0.8,*/*;q=0.5',
    },
    next: {
      revalidate: tileCacheSeconds,
    },
  });

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: 'MAPTILER_TILE_UNAVAILABLE' }, { status: response.status });
  }

  return new Response(response.body, {
    headers: {
      'cache-control': `public, max-age=${tileCacheSeconds}, stale-while-revalidate=${tileCacheSeconds * 7}`,
      'content-type': response.headers.get('content-type') ?? 'image/png',
    },
    status: 200,
  });
}

function parseTileCoordinate(value: string) {
  return Number(value.replace(/\.png$/, ''));
}
