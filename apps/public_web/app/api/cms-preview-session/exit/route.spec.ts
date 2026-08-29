import { NextRequest } from 'next/server';
import { expect, it } from 'vitest';

import { POST } from './route';

it('clears the route-scoped preview cookie and returns to the same public path', async () => {
  const response = await POST(exitRequest('http://localhost:3200', '/vi/about'));

  expect(response.status).toBe(303);
  expect(response.headers.get('location')).toBe('http://localhost:3200/vi/about');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('set-cookie')).toContain('hands_cms_preview=');
  expect(response.headers.get('set-cookie')).toContain('Path=/vi/about');
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});

it('rejects cross-site or unsafe preview exits', async () => {
  expect((await POST(exitRequest('https://attacker.example', '/vi/about'))).status).toBe(403);
  expect((await POST(exitRequest('http://localhost:3200', '//attacker.example'))).status).toBe(400);
});

function exitRequest(origin: string, returnTo: string) {
  const body = new URLSearchParams({ returnTo });
  return new NextRequest('http://localhost:3200/api/cms-preview-session/exit', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin },
    body,
  });
}
