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

describe('monthly tax closing export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting monthly tax CSVs', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/monthly-tax-closing/export?kind=summary'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns summary CSV without exposing a data URI in page HTML', async () => {
    mockedAdminGet.mockResolvedValue({
      cashDebtTotal: 0,
      companyCouponExpenseTotal: 0,
      companyOutputVatTotal: 10000,
      couponDiscountAmountTotal: 0,
      couponReviewFlagCount: 0,
      couponSettlementCount: 0,
      currency: 'VND',
      customerPaymentAmountTotal: 500000,
      id: 'closing-summary',
      netRevenueDelta: 0,
      nonCashPartnerPayoutTotal: 390000,
      openTaxCount: 0,
      paidTaxCount: 4,
      partnerCountWithRevenue: 2,
      partnerFundedCouponAmountTotal: 0,
      partnerPitWithheldTotal: 30000,
      partnerPayoutTotal: 390000,
      partnerVatWithheldTotal: 50000,
      partnerWithholdingTotal: 80000,
      paymentProcessingFeeTotal: 12000,
      period: '2026-06',
      platformFeeDiscountAmountTotal: 0,
      platformFeeGrossTotal: 100000,
      platformFeeNetRevenueTotal: 90000,
      reconciliationDelta: 0,
      settlementCount: 4,
      status: 'DRAFT',
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/monthly-tax-closing/export?kind=summary&period=2026-06'),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-monthly-tax-closing-2026-06-summary.csv');
    expect(body).toContain('"period"');
    expect(body).toContain('"2026-06"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/monthly-tax-closings/summary?period=2026-06', expect.anything());
  });

  it('returns rows CSV from the current bounded list filters', async () => {
    mockedAdminGet.mockResolvedValue([
      {
        cashDebtTotal: 0,
        closedAt: null,
        companyOutputVatTotal: 10000,
        createdAt: '2026-07-01T00:00:00.000Z',
        currency: 'VND',
        declaredAt: null,
        id: 'closing-1',
        nonCashPartnerPayoutTotal: 390000,
        notes: null,
        paidAt: null,
        partnerPitWithheldTotal: 30000,
        partnerVatWithheldTotal: 50000,
        partnerWithholdingTotal: 80000,
        paymentProcessingFeeTotal: 12000,
        period: '2026-06',
        platformFeeGrossTotal: 100000,
        platformFeeNetRevenueTotal: 90000,
        settlementCount: 4,
        status: 'DRAFT',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ]);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/monthly-tax-closing/export?kind=rows&period=2026-06&take=25',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('"id"');
    expect(body).toContain('"closing-1"');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/monthly-tax-closings?period=2026-06&take=25', []);
  });

  it('rejects unknown export kinds', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/monthly-tax-closing/export?kind=debug'),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'INVALID_EXPORT_KIND' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });
});
