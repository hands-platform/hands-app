describe('Admin web session logout route', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('clears the admin session cookie with no-store headers', async () => {
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: { accept: 'application/json' },
        method: 'POST',
      }),
    );
    const body = (await response.json()) as { ok?: boolean };
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(setCookie).toContain('hands_admin_session=');
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Path=/');
  });

  it('clears the admin session cookie as Secure in production', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');

    const response = await POST(
      new Request('http://localhost/api/admin/session/logout', {
        headers: { accept: 'application/json' },
        method: 'POST',
      }),
    );
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(200);
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Path=/');
  });
});
