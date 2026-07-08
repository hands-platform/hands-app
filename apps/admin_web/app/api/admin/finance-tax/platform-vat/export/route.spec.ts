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

describe('platform VAT export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting platform VAT CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/finance-tax/platform-vat/export'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns platform VAT CSV from the selected period summary', async () => {
    mockedAdminGet.mockResolvedValue({
      companyOutputVatTotal: 10000,
      currency: 'VND',
      netRevenueDelta: 0,
      period: '2026-06',
      platformFeeGrossTotal: 100000,
      platformFeeNetRevenueTotal: 90000,
      rateBreakdown: [
        {
          category: 'STANDARD_10',
          companyOutputVatTotal: 10000,
          platformFeeGrossTotal: 100000,
          platformFeeNetRevenueTotal: 90000,
          platformVatRateBps: 1000,
          settlementCount: 4,
        },
      ],
      settlementCount: 4,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/platform-vat/export?period=2026-06'),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-platform-vat-2026-06.csv');
    expect(body).toContain('"section"');
    expect(body).toContain('"STANDARD_10"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/platform-vat/summary?period=2026-06', expect.anything());
  });
});
