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

describe('booking settlement audit export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting settlement audit CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/booking-settlement-audit/export'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns settlement audit CSV from the current bounded filters', async () => {
    mockedAdminGet.mockResolvedValue([
      {
        bookingId: 'booking-1',
        closedAt: null,
        companyOutputVat: 10000,
        currency: 'VND',
        customerPaymentAmount: 500000,
        customerProfileId: 'customer-1',
        id: 'snapshot-1',
        monthlyPeriod: '2026-06',
        partnerPitAmount: 30000,
        partnerTaxableRevenue: 400000,
        partnerVatAmount: 50000,
        partnerWithholdingTotal: 80000,
        paymentMethod: 'CARD',
        paymentProcessingFee: 12000,
        platformFeeGross: 100000,
        platformFeeNetRevenue: 90000,
        postedAt: '2026-06-10T10:00:00.000Z',
        providerProfileId: 'provider-1',
        settlementStatus: 'POSTED',
        taxStatus: 'DECLARED',
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/booking-settlement-audit/export?range=7d&review=open&take=25',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-booking-settlement-audit-7d-open.csv');
    expect(body).toContain('"snapshot_id"');
    expect(body).toContain('"snapshot-1"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/booking-settlement-snapshots?range=7d&review=open&take=25',
      [],
    );
  });
});
