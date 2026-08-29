import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag }));

import { POST } from './route';

const secret = 'cache-invalidation-secret-at-least-32-characters';

beforeEach(() => {
  process.env.SITE_CONTENT_CACHE_INVALIDATION_SECRET = secret;
  revalidateTag.mockClear();
});

afterEach(() => {
  delete process.env.SITE_CONTENT_CACHE_INVALIDATION_SECRET;
});

it('requires an independently configured 32 character server secret', async () => {
  delete process.env.SITE_CONTENT_CACHE_INVALIDATION_SECRET;
  const response = await POST(cacheRequest(secret));
  expect(response.status).toBe(503);
  expect(revalidateTag).not.toHaveBeenCalled();
});

it('rejects unauthenticated and malformed invalidation requests', async () => {
  expect((await POST(cacheRequest('wrong'))).status).toBe(401);
  expect((await POST(cacheRequest(secret, { site: 'MAIN', locale: 'vi', path: '//unsafe' }))).status).toBe(400);
  expect(revalidateTag).not.toHaveBeenCalled();
});

it('invalidates only the route, route index, and applicable news tags', async () => {
  const response = await POST(cacheRequest(secret, { site: 'MAIN', locale: 'vi', path: '/news/story' }));
  expect(response.status).toBe(200);
  expect(revalidateTag.mock.calls).toEqual([
    ['public-site:page:MAIN:vi:%2Fnews%2Fstory', 'max'],
    ['public-site:routes:MAIN:vi', 'max'],
    ['public-site:news:MAIN:vi', 'max'],
  ]);
});

function cacheRequest(token: string, body = { site: 'MAIN', locale: 'vi', path: '/about' }) {
  return new NextRequest('http://localhost:3200/api/site-content-cache', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
