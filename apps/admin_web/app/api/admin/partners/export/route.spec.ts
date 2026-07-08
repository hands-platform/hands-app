import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminProvider } from '../../../../../lib/admin-api';
import { adminGet } from '../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../lib/admin-api')>('../../../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
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

const mockedAdminGet = vi.mocked(adminGet);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('partner export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
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
    expect(mockedAdminGet).not.toHaveBeenCalled();
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
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/partners/list-providers')) {
        return [provider];
      }

      if (href.startsWith('/admin/operational-policy?keys=')) {
        return [];
      }

      return fallback;
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/partners/export?pageSize=10&q=linh'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('"display_name"');
    expect(body).toContain('"Linh Partner"');
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).toContain(
      '/admin/partners/list-providers?take=10&q=linh',
    );
  });
});
