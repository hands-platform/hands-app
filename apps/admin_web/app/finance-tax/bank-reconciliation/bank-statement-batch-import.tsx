'use client';

import { Download, FileCheck2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  AdminFormActionRow,
  AdminFormCheckbox,
  AdminFormControlButton,
  AdminFormFile,
  AdminFormGridFields,
  AdminFormInput,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../../components/admin-inline-notice';
import { AdminTextLink } from '../../../components/admin-text-link';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../components/status-badge';
import type {
  AdminCompanyBankAccount,
  AdminCompanyBankTransactionBatchImportResult,
  AdminCompanyBankTransactionBatchInputRow,
  AdminCompanyBankTransactionBatchPreview,
} from '../../../lib/admin-api';
import {
  bankStatementCsvIssueReport,
  bankStatementCsvPresetLabel,
  bankStatementCsvRetryFile,
  bankStatementCsvTemplate,
  parseBankStatementCsv,
  type BankStatementCsvPreset,
} from '../../../lib/bank-statement-csv';
import { bankReconciliationDetailHref } from '../tax-settlement-page-model';
import { FinanceDataTable } from '../finance-data-table';
import { BankReconciliationConfirmationDisclosure } from './bank-reconciliation-confirmation-disclosure';

type BankStatementBatchImportProps = {
  readonly companyBankAccounts: AdminCompanyBankAccount[];
};

export function BankStatementBatchImport({ companyBankAccounts }: BankStatementBatchImportProps) {
  const router = useRouter();
  const [bankAccountId, setBankAccountId] = useState(companyBankAccounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<AdminCompanyBankTransactionBatchImportResult | null>(null);
  const [inputRows, setInputRows] = useState<AdminCompanyBankTransactionBatchInputRow[]>([]);
  const [operatorReason, setOperatorReason] = useState('');
  const [preview, setPreview] = useState<AdminCompanyBankTransactionBatchPreview | null>(null);
  const [preset, setPreset] = useState<BankStatementCsvPreset>('GENERIC');
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [sourceFileSha256, setSourceFileSha256] = useState('');
  const [type, setType] = useState<'INFLOW' | 'OUTFLOW'>('INFLOW');
  const selectedAccount = companyBankAccounts.find((account) => account.id === bankAccountId);
  const normalizedPreviewRows = preview?.rows.filter((row) => row.normalized).map((row) => row.normalized!) ?? [];
  const previewCurrencies = [...new Set(normalizedPreviewRows.map((row) => row.currency))];
  const previewDates = normalizedPreviewRows.map((row) => row.occurredAt).sort();
  const previewTotalAmount = normalizedPreviewRows.reduce((total, row) => total + row.amount, 0);

  async function previewFile() {
    if (!file || !bankAccountId) {
      setError('Choose an active bank account and CSV file first.');
      return;
    }
    setBusy(true);
    setError('');
    setImportResult(null);
    try {
      const fileContents = await readBankStatementFile(file);
      const rows = parseBankStatementCsv(fileContents.text, { bankAccountId, type }, preset);
      const response = await fetch('/api/admin/bank-reconciliation/batch-preview', {
        body: JSON.stringify({ rows }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('Bank statement preview failed.');
      const nextPreview = (await response.json()) as AdminCompanyBankTransactionBatchPreview;
      setInputRows(rows);
      setPreview(nextPreview);
      setSourceFileSha256(fileContents.sha256);
      setSelectedRows(new Set(nextPreview.rows.filter((row) => row.classification === 'NEW').map((row) => row.rowNumber)));
    } catch (previewError) {
      setPreview(null);
      setInputRows([]);
      setSelectedRows(new Set());
      setSourceFileSha256('');
      setError(previewError instanceof Error ? previewError.message : 'Bank statement preview failed.');
    } finally {
      setBusy(false);
    }
  }

  async function importReviewedRows() {
    if (!preview || !file || !sourceFileSha256 || operatorReason.trim().length < 12) {
      setError('Enter at least 12 characters of import evidence.');
      return;
    }
    const rows = inputRows
      .filter((row) => selectedRows.has(row.rowNumber))
      .map((row) => ({
        ...row,
        confirmPotentialDuplicate:
          preview.rows.find((previewRow) => previewRow.rowNumber === row.rowNumber)?.classification ===
          'POTENTIAL_DUPLICATE',
      }));
    if (rows.length === 0) {
      setError('Select at least one new or reviewed potential duplicate row.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/bank-reconciliation/batch-import', {
        body: JSON.stringify({
          mappingPreset: preset,
          operatorReason: operatorReason.trim(),
          rows,
          sourceFileName: file.name,
          sourceFileSha256,
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      });
      if (!response.ok) throw new Error('Reviewed bank statement import failed.');
      const result = (await response.json()) as AdminCompanyBankTransactionBatchImportResult;
      setImportResult(result);
      router.refresh();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Reviewed bank statement import failed.');
    } finally {
      setBusy(false);
    }
  }

  function toggleRow(rowNumber: number, selected: boolean) {
    setSelectedRows((current) => {
      const next = new Set(current);
      if (selected) next.add(rowNumber);
      else next.delete(rowNumber);
      return next;
    });
  }

  return (
    <div className="bank-statement-batch-import">
      <AdminFormGridFields className="compact-form">
        <AdminFormSelect
          disabled={!companyBankAccounts.length || busy}
          label="Bank account"
          labelVisibility="visible"
          name="batchBankAccountId"
          onChange={(event) => {
            setBankAccountId(event.target.value);
            setPreview(null);
          }}
          options={companyBankAccounts.map((account) => ({
            label: [account.name, account.bankName, account.currency].filter(Boolean).join(' - '),
            value: account.id,
          }))}
          value={bankAccountId}
        />
        <AdminFormSelect
          disabled={busy}
          label="Statement direction"
          labelVisibility="visible"
          name="batchTransactionType"
          onChange={(event) => {
            setType(event.target.value === 'OUTFLOW' ? 'OUTFLOW' : 'INFLOW');
            setPreview(null);
          }}
          options={[
            { label: 'Inflow', value: 'INFLOW' },
            { label: 'Outflow', value: 'OUTFLOW' },
          ]}
          value={type}
        />
        <AdminFormSelect
          disabled={busy}
          label="CSV mapping"
          labelVisibility="visible"
          name="batchCsvPreset"
          onChange={(event) => {
            setPreset(asBankStatementCsvPreset(event.target.value));
            setPreview(null);
            setImportResult(null);
          }}
          options={(['GENERIC', 'VCB', 'MOMO', 'VNPAY'] as const).map((value) => ({
            label: bankStatementCsvPresetLabel(value),
            value,
          }))}
          value={preset}
        />
        <AdminFormFile
          accept=".csv,text/csv"
          disabled={busy}
          displayValue={file?.name ?? 'Choose CSV file'}
          icon={<Upload aria-hidden="true" size={18} />}
          label="CSV statement"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setPreview(null);
            setImportResult(null);
            setSourceFileSha256('');
          }}
        />
        <AdminFormActionRow>
          <AdminFormControlButton
            className="button-secondary"
            disabled={busy}
            onClick={() => downloadBankStatementTemplate(preset)}
            type="button"
          >
            <Download aria-hidden="true" size={16} />
            Download template
          </AdminFormControlButton>
          <AdminFormControlButton
            className="button-secondary"
            disabled={busy || !file || !bankAccountId}
            onClick={previewFile}
            type="button"
          >
            <FileCheck2 aria-hidden="true" size={16} />
            {busy ? 'Checking...' : 'Preview statement'}
          </AdminFormControlButton>
        </AdminFormActionRow>
      </AdminFormGridFields>

      <p className="muted admin-mt-8">
        {bankStatementCsvPresetLabel(preset)} is selected. Amount and transaction date are required. Optional values
        include value date, transfer reference, counterparty, description, currency, and source key. Preview never
        saves data and is limited to 50 rows.
      </p>
      {error ? (
        <AdminInlineNotice className="admin-mt-8" role="alert" tone="danger">
          {error}
        </AdminInlineNotice>
      ) : null}
      {importResult ? (
        <div className="admin-mt-8">
          <p className="admin-form-success">
            Imported {importResult.importedCount} row(s); skipped {importResult.skippedCount} row(s).
          </p>
          <p className="muted admin-mt-6">Batch ID: <code>{importResult.batchImportId}</code></p>
          {retryRowsForImport(inputRows, importResult).length > 0 ? (
            <AdminFormControlButton
              className="button-secondary admin-mt-8"
              onClick={() =>
                downloadBankStatementCsv(
                  'hands-bank-statement-retry.csv',
                  bankStatementCsvRetryFile(retryRowsForImport(inputRows, importResult)),
                )
              }
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Download retry file
            </AdminFormControlButton>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <div className="admin-mt-16">
          <dl className="bank-statement-preview-facts" aria-label="Statement import preview facts">
            <div>
              <dt>Account</dt>
              <dd>{selectedAccount?.name ?? 'Unknown account'}</dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{previewCurrencies.join(', ') || selectedAccount?.currency || 'Unknown'}</dd>
            </div>
            <div>
              <dt>Statement period</dt>
              <dd>
                {previewDates.length > 0 ? (
                  <><DateTimeText value={previewDates[0]} /> - <DateTimeText value={previewDates.at(-1)} /></>
                ) : 'No valid dates'}
              </dd>
            </div>
            <div>
              <dt>Upload file</dt>
              <dd>{file ? `${file.name} · ${formatFileSize(file.size)}` : 'No file'}</dd>
            </div>
            <div>
              <dt>Statement rows</dt>
              <dd>{preview.summary.total}</dd>
            </div>
            <div>
              <dt>Total parsed amount</dt>
              <dd>
                {previewCurrencies.length === 1 ? (
                  <MoneyText amount={previewTotalAmount} currency={previewCurrencies[0]} />
                ) : `${previewTotalAmount.toLocaleString()} mixed currency`}
              </dd>
            </div>
            <div>
              <dt>Duplicate candidates</dt>
              <dd>{preview.summary.potentialDuplicate + preview.summary.exactDuplicate}</dd>
            </div>
            <div>
              <dt>Parsing errors</dt>
              <dd>{preview.summary.invalid}</dd>
            </div>
            <div>
              <dt>Expected creations</dt>
              <dd>{selectedRows.size}</dd>
            </div>
            <div>
              <dt>File fingerprint</dt>
              <dd>{sourceFileSha256 ? `${sourceFileSha256.slice(0, 12)}...` : 'Unavailable'}</dd>
            </div>
          </dl>
          <div className="bank-statement-batch-summary" aria-label="Bank statement preview summary">
            <span>{preview.summary.new} New</span>
            <span>{preview.summary.potentialDuplicate} Potential duplicate</span>
            <span>{preview.summary.exactDuplicate} Exact duplicate</span>
            <span>{preview.summary.invalid} Invalid</span>
          </div>
          {preview.summary.total - preview.summary.new > 0 ? (
            <AdminFormControlButton
              className="button-secondary admin-mb-12"
              onClick={() =>
                downloadBankStatementCsv(
                  'hands-bank-statement-issue-report.csv',
                  bankStatementCsvIssueReport(preview.rows),
                )
              }
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Download issue report
            </AdminFormControlButton>
          ) : null}
          <FinanceDataTable
            emptyMessage="No statement rows were found."
            headers={['Import', 'CSV row', 'Transaction', 'Amount', 'Classification', 'Evidence']}
            rowCount={preview.rows.length}
          >
            {preview.rows.map((row) => {
              const canSelect = row.classification === 'NEW' || row.classification === 'POTENTIAL_DUPLICATE';
              return (
                <tr key={row.rowNumber}>
                  <td>
                    <AdminFormCheckbox
                      checked={selectedRows.has(row.rowNumber)}
                      disabled={!canSelect || busy}
                      label={`Import CSV row ${row.rowNumber}`}
                      onChange={(event) => toggleRow(row.rowNumber, event.target.checked)}
                    />
                  </td>
                  <td>
                    <strong>{row.rowNumber}</strong>
                  </td>
                  <td>
                    {row.normalized ? (
                      <>
                        <strong>{row.normalized.transferRef ?? 'No transfer reference'}</strong>
                        <div className="muted"><DateTimeText value={row.normalized.occurredAt} /></div>
                        <div className="muted">{row.normalized.counterpartyName ?? 'No counterparty'}</div>
                      </>
                    ) : (
                      <>
                        <strong>{row.raw.transferRef || `CSV row ${row.rowNumber}`}</strong>
                        <div className="muted">{row.raw.occurredAt || 'Missing transaction date'}</div>
                        <div className="muted">{row.raw.counterpartyName || 'No counterparty'}</div>
                      </>
                    )}
                  </td>
                  <td>
                    {row.normalized ? (
                      <MoneyText amount={row.normalized.amount} currency={row.normalized.currency} />
                    ) : (
                      <AdminInlineFallback>{row.raw.amount || 'Missing amount'}</AdminInlineFallback>
                    )}
                  </td>
                  <td>
                    <StatusBadgeFromPillClass pillClass={batchClassificationPill(row.classification)}>
                      {batchClassificationLabel(row.classification)}
                    </StatusBadgeFromPillClass>
                    {row.classification === 'POTENTIAL_DUPLICATE' ? (
                      <div className="muted admin-mt-6">Select only after reviewing linked rows.</div>
                    ) : null}
                  </td>
                  <td>
                    {row.errors.map((message) => (
                      <AdminInlineNotice key={message} tone="danger">{message}</AdminInlineNotice>
                    ))}
                    {row.candidates.map((candidate) => (
                      <div key={candidate.id}>
                        <AdminTextLink href={bankReconciliationDetailHref(candidate.id)}>
                          Existing {candidate.transferRef ?? candidate.id.slice(-8)}
                        </AdminTextLink>
                      </div>
                    ))}
                    {row.batchCandidateRowNumbers.map((candidateRow) => (
                      <div className="muted" key={candidateRow}>CSV row {candidateRow}</div>
                    ))}
                    {row.errors.length === 0 && row.candidates.length === 0 && row.batchCandidateRowNumbers.length === 0 ? (
                      <AdminInlineFallback>No duplicate evidence</AdminInlineFallback>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </FinanceDataTable>
          <AdminFormGridFields className="compact-form admin-mt-16">
            <AdminFormInput
              disabled={busy}
              label="Import evidence"
              labelVisibility="visible"
              minLength={12}
              name="batchOperatorReason"
              onChange={(event) => setOperatorReason(event.target.value)}
              placeholder="Why these reviewed statement rows should be imported"
              required
              value={operatorReason}
            />
            <BankReconciliationConfirmationDisclosure
              auditDetail="Submitting records the file hash, mapping preset, selected row decisions, signed-in importing operator, and import evidence. A separate signed-in Finance approver is required later when a review owner resolves each row."
              buttonType="button"
              className="admin-grid-span-2"
              confirmLabel={busy ? 'Importing...' : `Confirm import of ${selectedRows.size} row(s)`}
              detail={`${file?.name ?? 'Selected CSV file'} · ${selectedRows.size} reviewed row(s) · ${bankStatementCsvPresetLabel(preset)} mapping. Exact duplicates and unselected rows remain blocked.`}
              disabled={
                busy ||
                selectedRows.size === 0 ||
                operatorReason.trim().length < 12
              }
              onConfirm={importReviewedRows}
              title="Review bank statement batch import"
              tone="danger"
            />
          </AdminFormGridFields>
        </div>
      ) : null}
    </div>
  );
}

async function readBankStatementFile(file: File) {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
  return { sha256, text: new TextDecoder().decode(bytes) };
}

function batchClassificationPill(classification: AdminCompanyBankTransactionBatchPreview['rows'][number]['classification']) {
  if (classification === 'NEW') return 'pill-success';
  if (classification === 'POTENTIAL_DUPLICATE') return 'pill-warn';
  if (classification === 'EXACT_DUPLICATE') return 'pill-danger';
  return 'pill-neutral';
}

function batchClassificationLabel(classification: AdminCompanyBankTransactionBatchPreview['rows'][number]['classification']) {
  return classification.replaceAll('_', ' ').toLowerCase().replace(/^./u, (value) => value.toUpperCase());
}

function asBankStatementCsvPreset(value: string): BankStatementCsvPreset {
  if (value === 'VCB' || value === 'MOMO' || value === 'VNPAY') return value;
  return 'GENERIC';
}

function downloadBankStatementTemplate(preset: BankStatementCsvPreset) {
  downloadBankStatementCsv(
    `hands-bank-statement-${preset.toLowerCase()}-template.csv`,
    bankStatementCsvTemplate(preset),
  );
}

function downloadBankStatementCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function retryRowsForImport(
  inputRows: AdminCompanyBankTransactionBatchInputRow[],
  result: AdminCompanyBankTransactionBatchImportResult,
) {
  const retryRowNumbers = new Set(
    result.results
      .filter((row) => row.status === 'SKIPPED' && row.classification !== 'EXACT_DUPLICATE')
      .map((row) => row.rowNumber),
  );
  return inputRows.filter((row) => retryRowNumbers.has(row.rowNumber));
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}
