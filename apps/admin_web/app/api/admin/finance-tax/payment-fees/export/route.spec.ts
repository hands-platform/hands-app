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

describe('payment fees export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting payment fee CSV', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(new NextRequest('http://localhost/api/admin/finance-tax/payment-fees/export'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns payment fee CSV from the selected period summary', async () => {
    mockedAdminGet.mockResolvedValue({
      byPayer: [],
      byPaymentMethod: [
        {
          customerPaymentAmountTotal: 1000,
          paymentMethod: 'CARD',
          paymentProcessingFeeTotal: 30,
          settlementCount: 1,
          evidenceReviewCount: 1,
          evidenceCustomerPaymentAmountTotal: 1000,
          evidenceRecordedFeeTotal: 30,
          remediationExpectedFeeTotal: null,
          remediationDelta: null,
        },
      ],
      byTreatment: [],
      currency: 'VND',
      customerPaymentAmountTotal: 1000,
      paymentProcessingFeeTotal: 30,
      period: '2026-06',
      remediationPreview: {
        status: 'BLOCKED',
        policyVersionId: null,
        blockers: [],
        evidenceReviewCount: 1,
        evidenceCustomerPaymentAmountTotal: 1000,
        recordedFeeTotal: 30,
        expectedFeeTotal: null,
        delta: null,
      },
      settlementCount: 1,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/payment-fees/export?period=2026-06'),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain('hands-payment-fees-2026-06.csv');
    expect(body).toContain('"method_breakdown"');
    expect(body).toContain('"CARD"');
    expect(body).not.toContain('data:text/csv');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/payment-fees/summary?period=2026-06', expect.anything());
  });
});
