import type { AdminCompanyBankTransactionImportBatchDetail } from './admin-api';
import { buildBankStatementImportAuditCsv } from './bank-statement-import-audit-csv';

function batchDetail(
  overrides: Partial<AdminCompanyBankTransactionImportBatchDetail> = {},
): AdminCompanyBankTransactionImportBatchDetail {
  return {
    approvalAdminId: 'approver-1',
    approver: {
      email: 'approver@example.com',
      fullName: 'Finance Approver',
      id: 'approver-1',
    },
    assignee: null,
    assigneeAdminId: null,
    assignedAt: null,
    assignedByAdminId: null,
    batchImportId: 'batch-1',
    createdAt: '2026-07-14T02:00:00.000Z',
    importedCount: 1,
    mappingPreset: 'VCB',
    operator: {
      email: 'maker@example.com',
      fullName: 'Finance Maker',
      id: 'maker-1',
    },
    reconciliationNeedsActionCount: 1,
    reconciliationProgressPercent: 0,
    reconciliationSlaStatus: 'WITHIN_24H',
    reconciliationTransactionCount: 1,
    reconciliationWaitingHours: 2,
    reconciledTransactionCount: 0,
    requestedCount: 2,
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
    skippedCount: 1,
    sourceFileName: 'VCB, "July".csv',
    sourceFileSha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('buildBankStatementImportAuditCsv', () => {
  it('exports retained provenance and row outcomes without original statement contents', () => {
    const csv = buildBankStatementImportAuditCsv(batchDetail());

    expect(csv).toContain('"batch_import_id"');
    expect(csv).toContain('"VCB, ""July"".csv"');
    expect(csv).toContain('"Finance Maker"');
    expect(csv).toContain('"Finance Approver"');
    expect(csv).toContain('"2","NEW","IMPORTED","bank-tx-1"');
    expect(csv).toContain('"900000","VND"');
    expect(csv).not.toContain('counterparty_name');
    expect(csv).not.toContain('description');
    expect(csv).not.toContain('original_csv');
  });

  it('keeps one provenance row when a legacy batch has no retained row outcomes', () => {
    const csv = buildBankStatementImportAuditCsv(
      batchDetail({ importedCount: 0, requestedCount: 0, rows: [], skippedCount: 0 }),
    );

    expect(csv.split('\r\n')).toHaveLength(2);
    expect(csv).toContain('"batch-1"');
    expect(csv).toContain('"VCB"');
  });

  it('neutralizes spreadsheet formulas in retained identity fields', () => {
    const csv = buildBankStatementImportAuditCsv(
      batchDetail({ sourceFileName: '=HYPERLINK("https://invalid.example")' }),
    );

    expect(csv).toContain('"\'=HYPERLINK(""https://invalid.example"")"');
  });
});
