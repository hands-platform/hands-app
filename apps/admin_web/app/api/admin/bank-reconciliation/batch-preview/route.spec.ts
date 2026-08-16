import { adminPostOrThrow } from '../../../../../lib/admin-api';
import {
  ADMIN_WEB_SESSION_COOKIE_NAME,
  createAdminWebSessionCookieValue,
} from '../../../../../lib/admin-session';

vi.mock('../../../../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {},
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);

describe('Admin bank statement batch proxy routes', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires an Admin Web session before previewing bank statement rows', async () => {
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: 'test-bank-batch-session-secret-with-32-chars',
      NODE_ENV: 'production',
    };
    const { POST } = await import('./route');
    const response = await POST(
      new Request('http://localhost/api/admin/bank-reconciliation/batch-preview', {
        body: JSON.stringify({ rows: [] }),
        headers: { origin: 'http://localhost' },
        method: 'POST',
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
  });

  it('forwards reviewed preview and import payloads through server-only Admin API access', async () => {
    const sessionSecret = 'test-bank-batch-session-secret-with-32-chars';
    process.env = {
      ...process.env,
      ADMIN_WEB_SESSION_COOKIE_SECRET: sessionSecret,
      NODE_ENV: 'production',
    };
    const sessionCookie = createAdminWebSessionCookieValue({
      expiresAtMs: Date.now() + 60_000,
      secret: sessionSecret,
      sub: 'finance.operator@hands.vn',
    });
    const headers = {
      cookie: `${ADMIN_WEB_SESSION_COOKIE_NAME}=${sessionCookie}`,
      origin: 'http://localhost',
    };
    const previewPayload = { rows: [{ amount: '100000', rowNumber: 2 }] };
    const importPayload = { ...previewPayload, approvalAdminId: 'finance-admin-2' };
    mockedAdminPostOrThrow
      .mockResolvedValueOnce({ rows: [], summary: { total: 0 } })
      .mockResolvedValueOnce({ importedCount: 1, skippedCount: 0 });
    const previewRoute = await import('./route');
    const importRoute = await import('../batch-import/route');

    const previewResponse = await previewRoute.POST(
      new Request('http://localhost/api/admin/bank-reconciliation/batch-preview', {
        body: JSON.stringify(previewPayload),
        headers,
        method: 'POST',
      }),
    );
    const importResponse = await importRoute.POST(
      new Request('http://localhost/api/admin/bank-reconciliation/batch-import', {
        body: JSON.stringify(importPayload),
        headers,
        method: 'POST',
      }),
    );

    expect(previewResponse.status).toBe(200);
    expect(importResponse.status).toBe(200);
    expect(mockedAdminPostOrThrow).toHaveBeenNthCalledWith(
      1,
      '/admin/bank-reconciliation/transactions/batch-preview',
      previewPayload,
    );
    expect(mockedAdminPostOrThrow).toHaveBeenNthCalledWith(
      2,
      '/admin/bank-reconciliation/transactions/batch-import',
      importPayload,
    );
  });
});
