import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import type { AdminBankReconciliationTransactionDetail } from '../../../../lib/admin-api';
import { adminGet, adminPostOrThrow } from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../../components/admin-filter-panel';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../../components/admin-form-controls';
import { AdminPageTemplate, AdminSectionHeader } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDetailInfoItem } from '../../finance-detail-info-item';
import {
  bankReconciliationHref,
  buildBankReconciliationDetailApiHref,
  generalLedgerDetailHref,
} from '../../tax-settlement-page-model';

type BankReconciliationDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const reconciliationSourceOptions = [
  { label: 'Payment clearing entry', value: 'payment-clearing' },
  { label: 'Accounting journal entry', value: 'accounting-journal' },
  { label: 'Withdrawal request', value: 'withdrawal' },
  { label: 'Payout batch', value: 'payout-batch' },
];

export default async function BankReconciliationDetailPage({
  params,
  searchParams,
}: BankReconciliationDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }
  const noticeParams = searchParams ? await searchParams : {};
  const matchNotice = readParam(noticeParams, 'matched');
  const matchError = readParam(noticeParams, 'matchError');
  const reverseNotice = readParam(noticeParams, 'matchReversed');
  const reverseError = readParam(noticeParams, 'reverseError');

  const transaction = await adminGet<AdminBankReconciliationTransactionDetail | null>(
    buildBankReconciliationDetailApiHref(id),
    null,
  );
  if (!transaction) {
    notFound();
  }

  const matches = transaction.reconciliationMatches ?? [];

  return (
    <AdminPageTemplate
      actions={
        <Link className="button button-secondary" href={bankReconciliationHref({ page: 1, range: '30d', review: 'unmatched', take: 25 })}>
          Back to bank reconciliation
        </Link>
      }
      description="Bank transaction evidence for manual reconciliation against payment clearing, journal, withdrawal, and payout records."
      metrics={[
        { helper: 'Bank transaction state.', label: 'Status', value: transaction.status },
        { helper: 'Bank transaction amount.', label: 'Amount', value: formatMoney(transaction.amount, transaction.currency) },
        { helper: 'Linked reconciliation matches.', label: 'Matches', value: matches.length },
        { helper: 'Bank flow direction.', label: 'Type', value: transaction.type },
      ]}
      title="Bank Reconciliation Detail"
    >
      <section className="card admin-mb-16">
        <AdminSectionHeader
          description={`${transaction.transferRef ?? shortId(transaction.sourceKey)} · Occurred ${formatDateTime(transaction.occurredAt)}`}
          status={<span className={`pill ${statusPill(transaction.status)}`}>{transaction.status}</span>}
          title="Bank transaction overview"
        />
        <div className="detail-grid admin-mt-16">
          <FinanceDetailInfoItem label="Bank account" value={transaction.bankAccount?.name ?? 'Unknown account'} />
          <FinanceDetailInfoItem label="Bank" value={transaction.bankAccount?.bankName ?? '-'} />
          <FinanceDetailInfoItem label="Counterparty" value={transaction.counterpartyName ?? '-'} />
          <FinanceDetailInfoItem label="Value date" value={transaction.valueDate ? formatDateTime(transaction.valueDate) : '-'} />
        </div>
      </section>

      <section className="card admin-mb-16">
        <AdminSectionHeader
          description="Create one explicit match against a payment clearing, journal, withdrawal, or payout record. The Admin API writes the audit log."
          status={
            reverseNotice === '1' ? (
              <span className="pill pill-success">Match reversed</span>
            ) : matchNotice === '1' ? (
              <span className="pill pill-success">Match saved</span>
            ) : matchError || reverseError ? (
              <span className="pill pill-danger">Match failed</span>
            ) : null
          }
          title="Manual reconciliation match"
        />
        {matchError ? (
          <p className="muted admin-mt-8">
            No match was saved. Check the source id, amount, currency, approval admin, and current transaction state before trying again.
          </p>
        ) : null}
        {reverseError ? (
          <p className="muted admin-mt-8">
            No match was reversed. Check the approval admin and whether the match already belongs to this bank row and is not already reversed.
          </p>
        ) : null}
        <form action={createBankReconciliationMatchAction} className="form-grid compact-form admin-mt-16">
          <input name="bankTransactionId" type="hidden" value={transaction.id} />
          <AdminFormSelect
            label="Match source"
            name="sourceType"
            options={reconciliationSourceOptions}
          />
          <AdminFormInput
            label="Source id"
            name="sourceId"
            placeholder="clearing, journal, withdrawal, or payout id"
            required
          />
          <AdminFormInput
            defaultValue={Math.abs(transaction.amount)}
            label="Match amount"
            min={1}
            name="amount"
            required
            step={1}
            type="number"
          />
          <AdminFormInput
            defaultValue={transaction.currency}
            label="Currency"
            name="currency"
            required
          />
          <AdminFormInput
            label="Approving admin ID"
            name="approvalAdminId"
            placeholder="Finance approver admin id"
            required
          />
          <AdminFormTextarea
            className="admin-grid-span-2"
            label="Operator notes"
            maxLength={500}
            name="notes"
            placeholder="Why this bank row matches the selected finance source"
            rows={3}
          />
          <AdminFormControlButton>Create match</AdminFormControlButton>
        </form>
      </section>

      <AdminFilterPanel
        className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"
        description="Each match points to the finance source used to reconcile this bank row."
        resultLabel={`${matches.length} match(es)`}
        resultTone="info"
        title="Reconciliation matches"
      >
        <AdminTableScroll>
          <AdminDataTable
            className="vuexy-booking-table"
            emptyMessage="No reconciliation matches are linked to this bank transaction."
            headers={[
              'Matched source',
              'Accounting entry',
              'Payment clearing',
              'Withdrawal / payout',
              'Amount',
              'Status',
              'Audit trail',
              'Action',
            ]}
            rowCount={matches.length}
          >
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  <strong>{shortId(match.sourceKey)}</strong>
                  <div className="muted">{formatDateTime(match.matchedAt)}</div>
                </td>
                <td>
                  {match.accountingJournalEntry ? (
                    <>
                      <Link className="text-link" href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                        {match.accountingJournalEntry.accountCode}
                      </Link>
                      <div className="muted">{match.accountingJournalEntry.accountName}</div>
                    </>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {match.paymentClearingEntry ? (
                    <Link className="text-link" href={`/finance-tax/payment-clearing/${match.paymentClearingEntry.id}`}>
                      {match.paymentClearingEntry.type}
                    </Link>
                  ) : (
                    <span className="muted">-</span>
                  )}
                  <div className="muted">{match.paymentClearingEntry?.bookingId ? shortId(match.paymentClearingEntry.bookingId) : '-'}</div>
                </td>
                <td>
                  {match.withdrawalRequest ? <strong>Withdrawal {shortId(match.withdrawalRequest.id)}</strong> : null}
                  {match.payoutBatch ? <strong>Payout {shortId(match.payoutBatch.id)}</strong> : null}
                  {!match.withdrawalRequest && !match.payoutBatch ? <span className="muted">-</span> : null}
                </td>
                <td>
                  <strong>{formatMoney(match.amount, match.currency)}</strong>
                </td>
                <td>
                  <span className={`pill ${statusPill(match.status)}`}>{match.status}</span>
                </td>
                <td>
                  <ReconciliationAuditTrail metadata={match.metadata} />
                </td>
                <td>
                  {match.status === 'REVERSED' ? (
                    <span className="muted">Reversed</span>
                  ) : (
                    <form action={reverseBankReconciliationMatchAction} className="admin-inline-form">
                      <input name="bankTransactionId" type="hidden" value={transaction.id} />
                      <input name="matchId" type="hidden" value={match.id} />
                      <input
                        name="reason"
                        type="hidden"
                        value="Operator reversed incorrect reconciliation match from Admin detail."
                      />
                      <AdminFormInput
                        className="admin-inline-approval-input"
                        label="Approving admin ID"
                        name="approvalAdminId"
                        placeholder="Approver id"
                        required
                      />
                      <AdminFormControlButton className="button button-secondary admin-inline-action">
                        Reverse
                      </AdminFormControlButton>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </AdminDataTable>
        </AdminTableScroll>
      </AdminFilterPanel>
    </AdminPageTemplate>
  );
}

async function createBankReconciliationMatchAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const sourceType = readFormString(formData, 'sourceType');
  const sourceId = readFormString(formData, 'sourceId');
  const amount = Number(readFormString(formData, 'amount'));
  const currency = readFormString(formData, 'currency');
  const approvalAdminId = readFormString(formData, 'approvalAdminId');
  const notes = readFormString(formData, 'notes');
  const sourceField = bankReconciliationSourceField(sourceType);
  const returnHref = bankTransactionId
    ? `/finance-tax/bank-reconciliation/${encodeURIComponent(bankTransactionId)}`
    : '/finance-tax/bank-reconciliation';

  if (!bankTransactionId || !sourceField || !sourceId || !approvalAdminId || !Number.isFinite(amount) || amount <= 0) {
    redirect(`${returnHref}?matchError=invalid`);
  }

  try {
    await adminPostOrThrow(`/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/matches`, {
      amount,
      approvalAdminId,
      ...(currency ? { currency } : {}),
      ...(notes ? { notes } : {}),
      [sourceField]: sourceId,
    });
  } catch {
    redirect(`${returnHref}?matchError=failed`);
  }

  redirect(`${returnHref}?matched=1`);
}

async function reverseBankReconciliationMatchAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const matchId = readFormString(formData, 'matchId');
  const approvalAdminId = readFormString(formData, 'approvalAdminId');
  const reason = readFormString(formData, 'reason');
  const returnHref = bankTransactionId
    ? `/finance-tax/bank-reconciliation/${encodeURIComponent(bankTransactionId)}`
    : '/finance-tax/bank-reconciliation';

  if (!bankTransactionId || !matchId || !approvalAdminId) {
    redirect(`${returnHref}?reverseError=invalid`);
  }

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/matches/${encodeURIComponent(
        matchId,
      )}/reverse`,
      { approvalAdminId, ...(reason ? { reason } : {}) },
    );
  } catch {
    redirect(`${returnHref}?reverseError=failed`);
  }

  redirect(`${returnHref}?matchReversed=1`);
}

function ReconciliationAuditTrail({ metadata }: { readonly metadata: unknown }) {
  const record = readPlainRecord(metadata);
  const bankBefore = readRecordString(record, 'bankStatusBefore');
  const bankAfter = readRecordString(record, 'bankStatusAfter');
  const clearingBefore = readRecordString(record, 'paymentClearingStatusBefore');
  const clearingAfter = readRecordString(record, 'paymentClearingStatusAfter');

  if (!bankBefore && !bankAfter && !clearingBefore && !clearingAfter) {
    return <span className="muted">-</span>;
  }

  return (
    <div className="admin-table-substack">
      {bankBefore || bankAfter ? (
        <span>
          Bank: {bankBefore ?? '-'}{' -> '}
          {bankAfter ?? '-'}
        </span>
      ) : null}
      {clearingBefore || clearingAfter ? (
        <span className="muted">
          Clearing: {clearingBefore ?? '-'}{' -> '}
          {clearingAfter ?? '-'}
        </span>
      ) : null}
    </div>
  );
}

function statusPill(status: string) {
  if (status === 'MATCHED' || status === 'CLEARED') {
    return 'pill-success';
  }
  if (status === 'PARTIALLY_MATCHED' || status === 'PARTIALLY_CLEARED') {
    return 'pill-info';
  }
  if (status === 'REVERSED') {
    return 'pill-danger';
  }
  return 'pill-warn';
}

function readRecordString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function bankReconciliationSourceField(sourceType: string) {
  if (sourceType === 'payment-clearing') {
    return 'paymentClearingEntryId';
  }
  if (sourceType === 'accounting-journal') {
    return 'accountingJournalEntryId';
  }
  if (sourceType === 'withdrawal') {
    return 'withdrawalRequestId';
  }
  if (sourceType === 'payout-batch') {
    return 'payoutBatchId';
  }
  return null;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
