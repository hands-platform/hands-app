import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../../../lib/admin-operator-access';
import BankStatementImportBatchDetailPage from './page';

vi.mock('../../../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../lib/admin-api')>('../../../../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});
vi.mock('../../../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

describe('BankStatementImportBatchDetailPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockReset();
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue(null);
  });

  it('renders retained provenance and row outcomes without edit actions', async () => {
    mockedAdminGet.mockResolvedValue({
      approvalAdminId: 'approver-1',
      approver: { id: 'approver-1', email: 'approver@example.com', fullName: 'Finance Approver' },
      batchImportId: 'batch-1',
      createdAt: '2026-07-14T02:00:00.000Z',
      importedCount: 2,
      mappingPreset: 'VCB',
      operator: { id: 'maker-1', email: 'maker@example.com', fullName: 'Finance Maker' },
      requestedCount: 2,
      rows: [
        {
          classification: 'NEW',
          rowNumber: 2,
          status: 'IMPORTED',
          transactionId: 'bank-tx-1',
          transaction: {
            amount: 900000,
            currency: 'VND',
            id: 'bank-tx-1',
            occurredAt: '2026-07-14T02:00:00.000Z',
            status: 'UNMATCHED',
            transferRef: 'VCB-1',
            type: 'INFLOW',
          },
        },
        {
          classification: 'NEW',
          rowNumber: 3,
          status: 'IMPORTED',
          transactionId: 'bank-tx-2',
          transaction: {
            amount: 500000,
            currency: 'VND',
            id: 'bank-tx-2',
            occurredAt: '2026-07-14T03:00:00.000Z',
            status: 'MATCHED',
            transferRef: 'VCB-2',
            type: 'INFLOW',
          },
        },
        {
          classification: 'EXACT_DUPLICATE',
          rowNumber: 4,
          status: 'SKIPPED',
          transactionId: null,
          transaction: null,
        },
      ],
      skippedCount: 1,
      sourceFileName: 'VCB-July.csv',
      sourceFileSha256: 'a'.repeat(64),
    } as never);

    const page = await BankStatementImportBatchDetailPage({
      params: Promise.resolve({ batchImportId: 'batch-1' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank Statement Import Batch');
    expect(markup).toContain('VCB-July.csv');
    expect(markup).toContain('Original CSV');
    expect(markup).toContain('Not stored');
    expect(markup).toContain('Row outcomes');
    expect(markup).toContain('VCB-1');
    expect(markup).toContain('VCB-2');
    expect(markup).toContain('Needs reconciliation (1)');
    expect(markup).toContain('Reconciled (1)');
    expect(markup).toContain('Skipped (1)');
    expect(markup).toContain('50%');
    expect(markup).toContain('UNMATCHED');
    expect(markup).toContain('MATCHED');
    expect(markup).toContain('Export audit CSV');
    expect(markup).toContain('/api/admin/bank-reconciliation/import-batches/batch-1/export');
    expect(markup).not.toContain('Import again');
  });

  it('shows only open reconciliation rows when the work queue filter is selected', async () => {
    mockedAdminGet.mockResolvedValue({
      approvalAdminId: 'approver-1',
      approver: null,
      batchImportId: 'batch-1',
      createdAt: '2026-07-14T02:00:00.000Z',
      importedCount: 2,
      mappingPreset: 'VCB',
      operator: null,
      requestedCount: 2,
      rows: [
        {
          classification: 'NEW',
          rowNumber: 2,
          status: 'IMPORTED',
          transactionId: 'open-tx',
          transaction: {
            amount: 100000,
            currency: 'VND',
            id: 'open-tx',
            occurredAt: '2026-07-14T02:00:00.000Z',
            status: 'UNMATCHED',
            transferRef: 'OPEN-REF',
            type: 'INFLOW',
          },
        },
        {
          classification: 'NEW',
          rowNumber: 3,
          status: 'IMPORTED',
          transactionId: 'matched-tx',
          transaction: {
            amount: 200000,
            currency: 'VND',
            id: 'matched-tx',
            occurredAt: '2026-07-14T03:00:00.000Z',
            status: 'MATCHED',
            transferRef: 'MATCHED-REF',
            type: 'INFLOW',
          },
        },
      ],
      skippedCount: 0,
      sourceFileName: 'VCB-July.csv',
      sourceFileSha256: 'a'.repeat(64),
    } as never);

    const page = await BankStatementImportBatchDetailPage({
      params: Promise.resolve({ batchImportId: 'batch-1' }),
      searchParams: Promise.resolve({ review: 'needs-reconciliation' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('OPEN-REF');
    expect(markup).not.toContain('MATCHED-REF');
    expect(markup).toContain('1 visible row(s)');
    expect(markup).toContain('Queue: Needs reconciliation (1)');
  });

  it('opens protected owner reassignment without offering the current owner again', async () => {
    const batch = {
      approvalAdminId: 'approver-1',
      approver: null,
      assignee: { id: 'owner-current', email: 'current@hands.test', fullName: 'Current Owner' },
      assigneeAdminId: 'owner-current',
      assignedAt: '2026-07-14T03:00:00.000Z',
      assignedByAdminId: 'master-1',
      assignmentHistory: [
        {
          id: 'assignment-1',
          assignedAt: '2026-07-14T03:00:00.000Z',
          assignee: { id: 'owner-current', email: 'current@hands.test', fullName: 'Current Owner' },
          assignedBy: { id: 'master-1', email: 'master@hands.test', fullName: 'Master Admin' },
          previousAssignee: null,
          reason: 'Initial statement review owner.',
        },
      ],
      batchImportId: 'batch-1',
      createdAt: '2026-07-14T02:00:00.000Z',
      importedCount: 1,
      mappingPreset: 'VCB',
      operator: null,
      requestedCount: 1,
      rows: [
        {
          classification: 'NEW',
          rowNumber: 2,
          status: 'IMPORTED',
          transactionId: 'open-tx',
          transaction: {
            amount: 100000,
            currency: 'VND',
            id: 'open-tx',
            occurredAt: '2026-07-14T02:00:00.000Z',
            status: 'UNMATCHED',
            transferRef: 'OPEN-REF',
            type: 'INFLOW',
          },
        },
      ],
      skippedCount: 0,
      sourceFileName: 'VCB-July.csv',
      sourceFileSha256: 'a'.repeat(64),
    };
    mockedAdminGet.mockImplementation(async (href) => {
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            id: 'owner-current',
            email: 'current@hands.test',
            fullName: 'Current Owner',
            roles: ['ADMIN'],
            adminOperatorPermission: { categories: ['FINANCE_BANK_RECONCILIATION'] },
          },
          {
            id: 'operator-session',
            email: 'session@hands.test',
            fullName: 'Session Operator',
            roles: ['MASTER_ADMIN'],
          },
        ] as never;
      }
      return batch as never;
    });
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_BANK_RECONCILIATION'],
      email: 'session@hands.test',
      id: 'operator-session',
      isMasterAdmin: true,
      roles: ['MASTER_ADMIN'],
    } as never);

    const page = await BankStatementImportBatchDetailPage({
      params: Promise.resolve({ batchImportId: 'batch-1' }),
      searchParams: Promise.resolve({ confirm: 'review-owner' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reassign statement batch review?');
    expect(markup).toContain('Batch review owner history');
    expect(markup).toContain('Session Operator · session@hands.test');
    expect(markup).not.toContain('<option value="owner-current"');
    expect(markup).toContain('Assignment reason');
    expect(source).toContain('/assignment`');
    expect(source).toContain("reason.length < 12");
  });
});
