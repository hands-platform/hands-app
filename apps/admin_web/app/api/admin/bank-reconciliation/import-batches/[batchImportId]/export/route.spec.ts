import { NextRequest } from 'next/server';
import { vi } from 'vitest';

import type { AdminCompanyBankTransactionImportBatchDetail } from '../../../../../../../lib/admin-api';
import { adminGet } from '../../../../../../../lib/admin-api';
import { requireAdminWebAccess } from '../../../../../../../lib/admin-session';
import { GET } from './route';

vi.mock('../../../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../../lib/admin-api')>(
    '../../../../../../../lib/admin-api',
  );
  return { ...actual, adminGet: vi.fn() };
});

vi.mock('../../../../../../../lib/admin-session', async () => {
  const actual = await vi.importActual<typeof import('../../../../../../../lib/admin-session')>(
    '../../../../../../../lib/admin-session',
  );
  return { ...actual, requireAdminWebAccess: vi.fn() };
});

const mockedAdminGet = vi.mocked(adminGet);
const mockedRequireAdminWebAccess = vi.mocked(requireAdminWebAccess);

const batch: AdminCompanyBankTransactionImportBatchDetail = {
  approvalAdminId: 'approver-1',
  approver: { email: 'approver@example.com', fullName: 'Finance Approver', id: 'approver-1' },
  assignee: null,
  assigneeAdminId: null,
  assignedAt: null,
  assignedByAdminId: null,
  batchImportId: 'batch-1',
  createdAt: '2026-07-14T02:00:00.000Z',
  importedCount: 1,
  mappingPreset: 'VCB',
  operator: { email: 'maker@example.com', fullName: 'Finance Maker', id: 'maker-1' },
  reconciliationNeedsActionCount: 1,
  reconciliationProgressPercent: 0,
  reconciliationSlaStatus: 'WITHIN_24H',
  reconciliationTransactionCount: 1,
  reconciliationWaitingHours: 2,
  reconciledTransactionCount: 0,
  requestedCount: 1,
  rows: [
    {
      classification: 'NEW',
      rowNumber: 2,
      status: 'IMPORTED',
      transaction: {
        amount: 900000,
        currency: 'VND',
        id: 'bank-tx-1',
        occurredAt: '2026-07-14T02:00:00.000Z',
        status: 'UNMATCHED',
        transferRef: 'VCB-1',
        type: 'INFLOW',
      },
      transactionId: 'bank-tx-1',
    },
  ],
  skippedCount: 0,
  sourceFileName: 'VCB-July.csv',
  sourceFileSha256: 'a'.repeat(64),
};

describe('bank statement import audit export route', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedRequireAdminWebAccess.mockReset();
    mockedRequireAdminWebAccess.mockReturnValue({ allowed: true, mode: 'session-cookie' });
  });

  it('requires Admin Web access before exporting audit evidence', async () => {
    mockedRequireAdminWebAccess.mockReturnValue({
      allowed: false,
      error: 'ADMIN_WEB_ACCESS_REQUIRED',
      status: 401,
    });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/bank-reconciliation/import-batches/batch-1/export'),
      { params: Promise.resolve({ batchImportId: 'batch-1' }) },
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('rejects malformed batch identifiers before calling the API', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/admin/bank-reconciliation/import-batches/invalid/export'),
      { params: Promise.resolve({ batchImportId: '../invalid' }) },
    );

    expect(response.status).toBe(400);
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('returns a no-store audit CSV without original statement contents', async () => {
    mockedAdminGet.mockResolvedValue(batch);

    const response = await GET(
      new NextRequest('http://localhost/api/admin/bank-reconciliation/import-batches/batch-1/export'),
      { params: Promise.resolve({ batchImportId: 'batch-1' }) },
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toContain('hands-bank-statement-import-batch-1.csv');
    expect(body).toContain('"batch_import_id"');
    expect(body).toContain('"Finance Maker"');
    expect(body).toContain('"VCB-1"');
    expect(body).not.toContain('original_csv');
    expect(body).not.toContain('counterparty_name');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/bank-reconciliation/import-batches/batch-1', null);
  });

  it('returns not found when the retained batch does not exist', async () => {
    mockedAdminGet.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/admin/bank-reconciliation/import-batches/missing/export'),
      { params: Promise.resolve({ batchImportId: 'missing' }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
