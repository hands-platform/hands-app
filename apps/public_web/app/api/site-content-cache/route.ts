import { timingSafeEqual } from 'node:crypto';

import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

import {
  isPublicSiteLocale,
  publicSiteCacheTags,
  type PublicSiteKey,
} from '../../../lib/site-content';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const secret = process.env.SITE_CONTENT_CACHE_INVALIDATION_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ code: 'CACHE_INVALIDATION_NOT_CONFIGURED' }, { status: 503 });
  }
  const bearer = bearerToken(request.headers.get('authorization'));
  if (!bearer || !sameSecret(secret, bearer)) {
    return NextResponse.json({ code: 'CACHE_INVALIDATION_UNAUTHORIZED' }, { status: 401 });
  }
  const input = await request.json().catch(() => null) as {
    locale?: unknown;
    path?: unknown;
    site?: unknown;
  } | null;
  const site = input?.site;
  const locale = input?.locale;
  const path = typeof input?.path === 'string' ? input.path.trim() : '';
  if (
    (site !== 'MAIN' && site !== 'PARTNER_RECRUITMENT') ||
    typeof locale !== 'string' ||
    !isPublicSiteLocale(locale) ||
    !validTemplatePath(path)
  ) {
    return NextResponse.json({ code: 'CACHE_INVALIDATION_INVALID_INPUT' }, { status: 400 });
  }
  const tags = publicSiteCacheTags(site as PublicSiteKey, locale, path);
  for (const tag of tags) revalidateTag(tag, 'max');
  return NextResponse.json({ ok: true, invalidatedTagCount: tags.length });
}

function bearerToken(value: string | null) {
  const match = value?.match(/^Bearer\s+([^\s]+)$/iu);
  return match?.[1] ?? null;
}

function sameSecret(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function validTemplatePath(path: string) {
  return path.length <= 512 && /^\/(?:[-a-z0-9[\]]+(?:\/[-a-z0-9[\]]+)*)?$/u.test(path);
}
