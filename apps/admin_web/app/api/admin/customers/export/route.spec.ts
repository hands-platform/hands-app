import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminCustomer } from '../../../../../lib/admin-api';
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

describe('customer export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting customer CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/customers/export'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns a bounded customer CSV from the current list filters', async () => {
    const customer = {
      gender: 'female',
      id: 'customer-export-row',
      user: {
        createdAt: '2026-06-01T00:00:00.000Z',
        email: 'mai@example.test',
        fullName: 'Mai Customer',
        id: 'customer-user',
        phone: '+84900003333',
      },
      userId: 'customer-user',
    } as AdminCustomer;
    mockedAdminGet.mockResolvedValue([customer]);

    const response = await GET(new NextRequest('http://localhost/api/admin/customers/export?pageSize=10&q=mai'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toContain('"customer_id"');
    expect(body).toContain('"Mai Customer"');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/customers?q=mai&take=10&skip=0', []);
  });
});
