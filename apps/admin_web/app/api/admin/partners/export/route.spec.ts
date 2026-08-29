import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../lib/admin-api')>(
    '../../../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../../../../lib/admin-session', async () => {
  const actual = await vi.importActual<typeof import('../../../../../lib/admin-session')>(
    '../../../../../lib/admin-session',
  );

  return {
    ...actual,
    requireAdminWebAccess: vi.fn(),
  };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('partner export route', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting partner CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/partners/export'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('returns a bounded partner CSV from the current list filters', async () => {
    const provider = {
      gender: 'female',
      id: 'partner-export-row',
      kyc: { status: 'APPROVED' },
      level: 'LEVEL_2_VERIFIED',
      status: 'ONLINE_AVAILABLE',
      user: {
        createdAt: '2026-06-01T00:00:00.000Z',
        fullName: 'Linh Partner',
        id: 'partner-user',
        phone: '+84900001111',
      },
      userId: 'partner-user',
      verification: { status: 'APPROVED' },
    } as AdminProvider;
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers')) {
        return { data: [provider], ok: true, status: 200 };
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return { data: [], ok: true, status: 200 };
      }

      return { data: fallback, ok: true, status: 200 };
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/partners/export?pageSize=10&q=linh'),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('"display_name"');
    expect(body).toContain('"Linh Partner"');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/partners/list-providers?take=10&q=linh',
    );
  });

  it('returns a valid header-only CSV when the current page has no rows', async () => {
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({
      data: fallback,
      ok: true,
      status: 200,
    }));

    const response = await GET(new NextRequest('http://localhost/api/admin/partners/export'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('x-export-row-count')).toBe('0');
    expect(response.headers.get('x-export-scope')).toBe('current-page');
    expect(body).toContain('"display_name"');
  });

  it('exports the same frozen wallet debt cursor page shown in the directory', async () => {
    const provider = {
      activitySummary: { walletBalance: -305000 },
      displayName: 'Snapshot Debt Partner',
      id: 'snapshot-debt-partner',
      status: 'OFFLINE',
      user: {
        createdAt: '2026-06-01T00:00:00.000Z',
        fullName: 'Snapshot Debt Partner',
        id: 'snapshot-debt-user',
        phone: '+84900001111',
      },
      userId: 'snapshot-debt-user',
    } as AdminProvider;
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/partners/wallet-debt-page?take=10&cursor=cursor-2') {
        return {
          data: {
            generatedAt: '2026-08-24T10:01:00.000Z',
            items: [provider],
            page: {
              currentCursor: 'cursor-2',
              hasNextPage: false,
              nextCursor: null,
              offset: 10,
              returned: 1,
              snapshotCursor: 'snapshot-current',
              totalCount: 11,
            },
            snapshotAt: '2026-08-24T10:00:00.000Z',
          },
          ok: true,
          status: 200,
        };
      }
      if (href.startsWith('/admin/operational-policy?keys=')) {
        return { data: [], ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/partners/export?review=unsettled&sort=wallet-debt&cursor=cursor-2&page=2',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"Snapshot Debt Partner"');
    expect(mockedAdminGetResult.mock.calls.map(([href]) => href)).toContain(
      '/admin/partners/wallet-debt-page?take=10&cursor=cursor-2',
    );
  });

  it('returns a clear upstream error instead of an empty CSV', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/partners/list-providers')
        ? { data: fallback, ok: false, status: 503 }
        : { data: fallback, ok: true, status: 200 },
    );

    const response = await GET(new NextRequest('http://localhost/api/admin/partners/export'));

    expect(response.status).toBe(502);
    expect(response.headers.get('content-type')).toContain('application/json');
    await expect(response.json()).resolves.toEqual({
      error: 'Partner export records could not be loaded. Retry the export.',
    });
  });
});
