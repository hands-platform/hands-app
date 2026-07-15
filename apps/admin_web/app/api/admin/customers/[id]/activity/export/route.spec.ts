import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminCustomerDetail } from '../../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../../lib/admin-api')>(
    '../../../../../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../../../../../lib/admin-session', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../../lib/admin-session')>(
    '../../../../../../../lib/admin-session',
  );

  return {
    ...actual,
    requireAdminWebAccess: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('customer activity export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting customer activity CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/customers/customer-1/activity/export'),
      { params: Promise.resolve({ id: 'customer-1' }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns a no-store CSV for the selected customer activity rows', async () => {
    mockedAdminGet.mockResolvedValue({
      bookings: [
        {
          createdAt: '2026-07-12T01:00:00.000Z',
          id: 'booking-1',
          status: 'CREATED',
          updatedAt: '2026-07-12T02:00:00.000Z',
        },
      ],
      id: 'customer-1',
      user: {
        createdAt: '2026-07-01T00:00:00.000Z',
        fullName: 'Smoke Customer',
        id: 'user-1',
        phone: '+84900000000',
      },
    } as unknown as AdminCustomerDetail);

    const response = await GET(
      new NextRequest('http://localhost/api/admin/customers/customer-1/activity/export?range=7d&type=BOOKING'),
      { params: Promise.resolve({ id: 'customer-1' }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-customer-customer-activity.csv');
    expect(body).toContain('"type","date","title","detail","href","record_id","customer_id","customer_phone"');
    expect(body).toContain('"BOOKING"');
    expect(body).toContain('"booking-1"');
    expect(body).not.toContain('"at"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/customers/customer-1?includeDiagnostics=false', null);
  });
});
