import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminBookingSettlementSnapshot } from '../../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../../lib/admin-api';
import { recordAdminOperatorActivity } from '../../../../../../lib/admin-operator-access';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
import { emptyBookingSettlementSummary } from '../../../../../finance-tax/tax-settlement-page-model';
import { GET } from './route';

vi.mock('../../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../lib/admin-api')>(
    '../../../../../../lib/admin-api',
  );
  return { ...actual, adminGetResult: vi.fn() };
});

vi.mock('../../../../../../lib/admin-operator-access', () => ({
  recordAdminOperatorActivity: vi.fn(),
}));

vi.mock('../../../../../../lib/admin-session', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../lib/admin-session')>(
    '../../../../../../lib/admin-session',
  );
  return { ...actual, requireAdminWebAccess: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRecordAdminOperatorActivity = vi.mocked(recordAdminOperatorActivity);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

describe('booking settlement audit export route', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedRecordAdminOperatorActivity.mockReset();
    mockedRecordAdminOperatorActivity.mockResolvedValue({ ok: true });
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: true,
      mode: 'session-cookie',
      session: {
        exp: 2_000_000_000,
        iat: 1_999_900_000,
        jti: 'session-1',
        role: 'ADMIN',
        sessionVersion: 1,
        sub: 'finance@example.com',
      },
    });
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
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('exports every filtered row across server pages with scope and actor metadata', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => snapshotFixture(`snapshot-${index + 1}`));
    firstPage[99] = { ...firstPage[99], auditCursor: 'cursor-100' };
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.includes('/summary?')) {
        return { data: { ...emptyBookingSettlementSummary(), count: 101 }, ok: true, status: 200 };
      }
      if (href.includes('cursor=cursor-100')) {
        return { data: [{ ...snapshotFixture('snapshot-101'), auditCursor: 'cursor-101' }], ok: true, status: 200 };
      }
      if (href.includes('/admin/booking-settlement-snapshots?')) {
        return { data: firstPage, ok: true, status: 200 };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/booking-settlement-audit/export?range=all&review=integrity-exceptions&q=Demo+Customer&sort=oldest',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body).toContain('"snapshot-1"');
    expect(body).toContain('"snapshot-101"');
    expect(body).toContain('"finance@example.com"');
    expect(body).toContain('"Asia/Ho_Chi_Minh"');
    expect(body).toContain('"range=all;review=integrity-exceptions;q=Demo Customer"');
    expect(body).not.toContain('+84900000042');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/booking-settlement-snapshots?range=all&review=integrity-exceptions&q=Demo+Customer&sort=oldest&take=100',
      [],
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/booking-settlement-snapshots?range=all&review=integrity-exceptions&q=Demo+Customer&sort=oldest&take=100&cursor=cursor-100',
      [],
    );
    expect(mockedRecordAdminOperatorActivity).toHaveBeenCalledWith(
      'finance.booking_settlement_audit.export',
      '/finance-tax/booking-settlement-audit',
      expect.objectContaining({ rowCount: 101, sort: 'oldest' }),
    );
  });

  it('fails closed when the next cursor is missing from a partial export page', async () => {
    mockedAdminGetResult
      .mockResolvedValueOnce({
        data: { ...emptyBookingSettlementSummary(), count: 101 },
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, index) => snapshotFixture(`snapshot-${index + 1}`)),
        ok: true,
        status: 200,
      });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/booking-settlement-audit/export?range=all&review=integrity-exceptions',
      ),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'SETTLEMENT_AUDIT_EXPORT_CURSOR_INVALID',
      expectedRows: 101,
      receivedRows: 100,
    });
    expect(mockedRecordAdminOperatorActivity).toHaveBeenCalledWith(
      'finance.booking_settlement_audit.export_partial',
      '/finance-tax/booking-settlement-audit',
      expect.objectContaining({ expectedRows: 101, receivedRows: 100 }),
    );
  });

  it('returns a non-CSV error when the authoritative summary is unavailable', async () => {
    mockedAdminGetResult.mockResolvedValue({ data: emptyBookingSettlementSummary(), ok: false, status: 503 });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/booking-settlement-audit/export?range=all&review=open'),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'SETTLEMENT_AUDIT_SUMMARY_UNAVAILABLE',
      upstreamStatus: 503,
    });
    expect(mockedRecordAdminOperatorActivity).toHaveBeenCalledWith(
      'finance.booking_settlement_audit.export_failed',
      '/finance-tax/booking-settlement-audit',
      expect.objectContaining({ upstreamStatus: 503 }),
    );
  });
});

function snapshotFixture(id: string): AdminBookingSettlementSnapshot {
  return {
    bookingId: `booking-${id}`,
    closedAt: null,
    companyOutputVat: 10_000,
    currency: 'VND',
    customerPaymentAmount: 500_000,
    customerProfile: {
      id: 'customer-1',
      user: { fullName: 'Demo Customer', id: 'customer-user-1', phone: '+84900000042' },
    },
    customerProfileId: 'customer-1',
    id,
    monthlyPeriod: '2026-06',
    partnerPitAmount: 30_000,
    partnerPayoutAmount: 320_000,
    partnerTaxableRevenue: 400_000,
    partnerVatAmount: 50_000,
    partnerWithholdingTotal: 80_000,
    paymentMethod: 'CARD',
    paymentProcessingFee: 12_000,
    platformFeeGross: 100_000,
    platformFeeNetRevenue: 90_000,
    postedAt: '2026-06-10T10:00:00.000Z',
    providerProfileId: 'provider-1',
    settlementAuditHealth: {
      allocation: {
        companyCouponExpense: 0,
        customerPaymentAmount: 500_000,
        delta: 0,
        partnerPayoutAmount: 320_000,
        partnerWithholdingTotal: 80_000,
        platformFeeGross: 100_000,
      },
      blockers: [],
      checkedAt: '2026-08-09T00:00:00.000Z',
      checks: {
        allocation: 'PASS',
        bankMatch: 'PASS',
        canonicalClearing: 'PASS',
        canonicalJournal: 'PASS',
        couponPolicy: 'NOT_APPLICABLE',
        paymentFeePolicy: 'PASS',
        reversal: 'NOT_APPLICABLE',
        taxPeriod: 'PASS',
      },
      evidence: {
        canonicalClearing: {
          count: 1,
          ids: ['clearing-1'],
          matchedAmount: 500_000,
          required: true,
          state: 'PASS',
          unmatchedAmount: 0,
        },
        canonicalJournal: { count: 1, ids: ['journal-1'], state: 'PASS' },
        reversal: {
          clearingCount: 0,
          count: 0,
          ids: [],
          journalCount: 0,
          lifecycle: 'NONE',
          state: 'NOT_APPLICABLE',
        },
      },
      formulaVersion: 'CUSTOMER_PLUS_COMPANY_COUPON_V1',
      state: 'CLEAR',
    },
    settlementStatus: 'POSTED',
    taxStatus: 'CLOSED',
  };
}
