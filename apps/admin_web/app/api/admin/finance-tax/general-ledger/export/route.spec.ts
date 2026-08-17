import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminAccountingJournalBatch } from '../../../../../../lib/admin-api';
import { adminGetResult } from '../../../../../../lib/admin-api';
import { recordAdminOperatorActivity } from '../../../../../../lib/admin-operator-access';
import { requireAdminWebAccess } from '../../../../../../lib/admin-session';
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

describe('journal batch export route', () => {
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

  it('requires Admin Web access before exporting journal batches', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/general-ledger/export'),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'ADMIN_WEB_ACCESS_REQUIRED' });
    expect(mockedAdminGetResult).not.toHaveBeenCalled();
  });

  it('exports every filtered row from one bounded API request with integrity and actor metadata', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => journalFixture(`journal-${index + 1}`));
    mockedAdminGetResult.mockResolvedValue({
      data: {
        rows: [...firstPage, journalFixture('journal-101')],
        totalRows: 101,
        truncated: false,
      },
      ok: true,
      status: 200,
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/admin/finance-tax/general-ledger/export?range=all&review=all&source=BOOKING_SETTLEMENT&period=2026-07&q=booking+42&sort=largest-discrepancy',
      ),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body).toContain('"journal-1"');
    expect(body).toContain('"journal-101"');
    expect(body).toContain('"finance@example.com"');
    expect(body).toContain('"Asia/Ho_Chi_Minh"');
    expect(body).toContain('"range=all;review=all;source=BOOKING_SETTLEMENT;period=2026-07;q=booking 42"');
    expect(body).toContain('"BLOCKED"');
    expect(body).toContain('"HEADER_ENTRY_MISMATCH|FORMULA_DELTA"');
    expect(body).toContain('"2026-08-09T00:00:00.000Z"');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/accounting-journal-batches/export?range=all&period=2026-07&q=booking+42&review=all&source=BOOKING_SETTLEMENT&sort=largest-discrepancy',
      { rows: [], totalRows: 0, truncated: false },
    );
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(mockedRecordAdminOperatorActivity).toHaveBeenCalledWith(
      'finance.journal_batches.export',
      '/finance-tax/general-ledger',
      expect.objectContaining({ rowCount: 101, sort: 'largest-discrepancy' }),
    );
  });

  it('returns a non-CSV error when the authoritative summary is unavailable', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { rows: [], totalRows: 0, truncated: false },
      ok: false,
      status: 503,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/general-ledger/export?range=all&review=all'),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: 'JOURNAL_BATCH_ROWS_UNAVAILABLE',
      upstreamStatus: 503,
    });
    expect(mockedRecordAdminOperatorActivity).not.toHaveBeenCalled();
  });

  it('rejects an export above the audited row limit without loading rows', async () => {
    mockedAdminGetResult.mockResolvedValue({
      data: { rows: [], totalRows: 100_001, truncated: true },
      ok: true,
      status: 200,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/finance-tax/general-ledger/export?range=all&review=all'),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: 'JOURNAL_BATCH_EXPORT_TOO_LARGE',
      limit: 100_000,
      totalRows: 100_001,
    });
    expect(mockedAdminGetResult).toHaveBeenCalledTimes(1);
    expect(mockedRecordAdminOperatorActivity).not.toHaveBeenCalled();
  });
});

function journalFixture(id: string): AdminAccountingJournalBatch {
  return {
    bookingId: `booking-${id}`,
    createdAt: '2026-07-10T10:00:00.000Z',
    currency: 'VND',
    id,
    integrity: {
      blockerCodes: ['HEADER_ENTRY_MISMATCH', 'FORMULA_DELTA'],
      checkedAt: '2026-08-09T00:00:00.000Z',
      checks: {
        entriesBalanced: 'PASS',
        formula: 'FAIL',
        headerBalanced: 'PASS',
        headerMatchesEntries: 'FAIL',
        monthlyPeriod: 'PASS',
        postedEntries: 'PASS',
      },
      discrepancyAmount: 110_000,
      entryCount: 2,
      entryCredit: 390_000,
      entryDebit: 390_000,
      formulaDelta: 12_000,
      state: 'BLOCKED',
    },
    monthlyPeriod: '2026-07',
    postedAt: '2026-07-10T10:00:00.000Z',
    sourceId: `settlement-${id}`,
    sourceKey: `journal:settlement:${id}`,
    sourceType: 'BOOKING_SETTLEMENT',
    status: 'POSTED',
    totalCredit: 500_000,
    totalDebit: 500_000,
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}
