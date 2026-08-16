import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';

import { POST } from './route';

afterEach(() => {
  vi.unstubAllGlobals();
});

it('rejects cross-site attempts before validating a preview token', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  const request = previewRequest('https://attacker.example');

  const response = await POST(request);

  expect(response.status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('validates the fragment token server-side and stores it in a short-lived HttpOnly cookie', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ id: 'preview-page' }),
  });
  vi.stubGlobal('fetch', fetchMock);
  const request = previewRequest('http://localhost:3200');

  const response = await POST(request);

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledWith(
    expect.stringMatching(/\/public\/site-pages\/preview$/),
    expect.objectContaining({
      headers: { authorization: 'Bearer signed-preview-token' },
    }),
  );
  expect(fetchMock.mock.calls[0]?.[0]).not.toContain('signed-preview-token');
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('samesite=strict');
  expect(response.headers.get('set-cookie')).toContain('Path=/vi/about');
});

function previewRequest(origin: string) {
  return new NextRequest('http://localhost:3200/api/cms-preview-session', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ path: '/vi/about', token: 'signed-preview-token' }),
  });
}
