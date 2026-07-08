import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import { adminGet } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../lib/admin-api')>(
    '../../../../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../../../../lib/admin-session', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../lib/admin-session')>(
    '../../../../../../lib/admin-session',
  );

  return {
    ...actual,
    requireAdminWebAccess: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('partner withholding tax export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting partner withholding CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/partner-withholding-tax/export'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns partner withholding CSV from the current bounded list filters', async () => {
    mockedAdminGet.mockResolvedValue([
      {
        completedBookingCount: 3,
        currency: 'VND',
        grossServiceRevenue: 1000000,
        partnerName: 'Linh Partner',
        partnerPayoutTotal: 820000,
        partnerPhone: '+84900001111',
        partnerPitWithheldTotal: 30000,
        partnerVatWithheldTotal: 50000,
        period: '2026-06',
        providerProfileId: 'provider-1',
        totalPartnerTaxWithheld: 80000,
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/partner-withholding-tax/export?period=2026-06&take=25',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-partner-withholding-tax-2026-06.csv');
    expect(body).toContain('"provider_profile_id"');
    expect(body).toContain('"Linh Partner"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/partner-withholding-tax?period=2026-06&take=25', []);
  });
});
