import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import { emptyCouponFinanceSummary } from '../../../../../finance-tax/tax-settlement-page-model';
import { GET } from './route';

vi.mock('../../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../lib/admin-api')>(
    '../../../../../../lib/admin-api',
  );

  return {
    ...actual,
    adminGetResult: vi.fn(),
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

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('coupon finance export route', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting coupon finance CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/coupon-finance/export'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it.each([25, 50, 100])('returns %s visible coupon rows with reproducible export metadata', async (take) => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: true,
      mode: 'session-cookie',
      session: {
        exp: 1_800_000_000,
        iat: 1_700_000_000,
        jti: 'export-session-123456',
        role: 'ADMIN',
        sessionVersion: 1,
        sub: 'finance.admin@example.com',
      },
    });
    mockedAdminGetResult.mockImplementation(async (href) => ({
      data: String(href).includes('coupon-finance-summary')
        ? {
            ...emptyCouponFinanceSummary(),
            couponActivityCount: 125,
            couponSettlementCount: 125,
          }
        : Array.from({ length: take }, (_, index) => couponSnapshot(index + 1)),
      ok: true,
      status: 200,
    }));

    const response = await GET(
      new NextRequest(
        `http://localhost/api/admin/finance-tax/coupon-finance/export?range=30d&review=all&take=${take}`,
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-coupon-finance-30d-all.csv');
    expect(body.trimEnd().split('\n')).toHaveLength(take + 1);
    expect(body).toContain('"generated_at"');
    expect(body).toContain('"Asia/Ho_Chi_Minh"');
    expect(body).toContain('session:export-sessi');
    expect(body).not.toContain('finance.admin@example.com');
    expect(body).toContain('visible_rows_only=true');
    expect(body).toContain('truncated=true');
    expect(body).toContain(',"125",');
    expect(body).toContain('"snapshot_id"');
    expect(body).toContain('"coupon-snapshot-1"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      `/admin/booking-settlement-snapshots/coupon-finance?range=30d&take=${take}`,
      [],
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/booking-settlement-snapshots/coupon-finance-summary?range=30d',
      expect.any(Object),
    );
  });

  it.each([
    [403, 403],
    [500, 502],
    [null, 502],
  ] as const)(
    'returns a non-2xx error when the upstream export read fails with %s',
    async (upstream, expected) => {
      mockedAdminGetResult.mockResolvedValue({ data: [], ok: false, status: upstream });

      const response = await GET(
        new NextRequest('http://localhost/api/admin/finance-tax/coupon-finance/export?range=all&review=all'),
      );

      expect(response.status).toBe(expected);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('content-type')).toContain('application/json');
      await expect(response.json()).resolves.toEqual({
        error: 'COUPON_FINANCE_EXPORT_UPSTREAM_UNAVAILABLE',
      });
    },
  );
});

function couponSnapshot(index: number) {
  return {
    bookingId: `booking-coupon-${index}`,
    closedAt: null,
    companyOutputVat: 8000,
    currency: 'VND',
    customerPaymentAmount: 450000,
    customerProfileId: `customer-${index}`,
    id: `coupon-snapshot-${index}`,
    monthlyPeriod: '2026-06',
    partnerPitAmount: 30000,
    partnerTaxableRevenue: 400000,
    partnerVatAmount: 50000,
    partnerWithholdingTotal: 80000,
    paymentMethod: 'CARD' as const,
    paymentProcessingFee: 12000,
    platformFeeGross: 80000,
    platformFeeNetRevenue: 72000,
    postedAt: '2026-06-10T10:00:00.000Z',
    providerProfileId: `provider-${index}`,
    settlementStatus: 'POSTED' as const,
    taxStatus: 'DECLARED' as const,
  };
}
