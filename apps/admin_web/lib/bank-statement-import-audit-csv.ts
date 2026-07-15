import type { AdminCompanyBankTransactionImportBatchDetail } from './admin-api';
import { buildCsvContent, type CsvRow } from './csv-export';

const BANK_STATEMENT_IMPORT_AUDIT_COLUMNS = [
  'batch_import_id',
  'source_file_name',
  'source_file_sha256',
  'mapping_preset',
  'imported_at',
  'operator_id',
  'operator_name',
  'operator_email',
  'approval_admin_id',
  'approver_name',
  'approver_email',
  'requested_count',
  'imported_count',
  'skipped_count',
  'csv_row',
  'classification',
  'result',
  'transaction_id',
  'transfer_reference',
  'transaction_type',
  'amount',
  'currency',
  'occurred_at',
  'reconciliation_status',
] as const;

export function buildBankStatementImportAuditCsv(
  batch: AdminCompanyBankTransactionImportBatchDetail,
) {
  const provenance = bankStatementImportProvenance(batch);
  const rows: CsvRow[] = batch.rows.length
    ? batch.rows.map((row) => ({
        ...provenance,
        amount: row.transaction?.amount,
        classification: row.classification,
        csv_row: row.rowNumber,
        currency: row.transaction?.currency,
        occurred_at: row.transaction?.occurredAt,
        reconciliation_status: row.transaction?.status,
        result: row.status,
        transaction_id: row.transactionId,
        transaction_type: row.transaction?.type,
        transfer_reference: row.transaction?.transferRef,
      }))
    : [provenance];

  return buildCsvContent(rows, [...BANK_STATEMENT_IMPORT_AUDIT_COLUMNS]);
}

function bankStatementImportProvenance(
  batch: AdminCompanyBankTransactionImportBatchDetail,
): CsvRow {
  return {
    approval_admin_id: batch.approvalAdminId,
    approver_email: batch.approver?.email,
    approver_name: batch.approver?.fullName,
    batch_import_id: batch.batchImportId,
    imported_at: batch.createdAt,
    imported_count: batch.importedCount,
    mapping_preset: batch.mappingPreset,
    operator_email: batch.operator?.email,
    operator_id: batch.operator?.id,
    operator_name: batch.operator?.fullName,
    requested_count: batch.requestedCount,
    skipped_count: batch.skippedCount,
    source_file_name: batch.sourceFileName,
    source_file_sha256: batch.sourceFileSha256,
  };
}
