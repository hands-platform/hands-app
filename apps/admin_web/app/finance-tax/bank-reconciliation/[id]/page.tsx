import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import type {
  AdminBankReconciliationMatch,
  AdminBankReconciliationTransactionDetail,
  AdminBookingPaymentClearingEntry,
} from '../../../../lib/admin-api';
import {
  AdminApiRequestError,
  AdminOperatorAccessDeniedError,
  adminGet,
  adminPostOrThrow,
} from '../../../../lib/admin-api';
import { AdminDataTable, AdminTableScroll } from '../../../../components/admin-data-table';
import {
  AdminFormControlButton,
  AdminFormInput,
  AdminFormSelect,
  AdminFormTextarea,
} from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { formatDateTime, formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bankReconciliationHref,
  buildBankReconciliationDetailApiHref,
  buildBookingPaymentClearingApiHref,
  generalLedgerDetailHref,
  paymentClearingDetailHref,
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
  const latestActiveMatch = matches.find((match) => match.status !== 'REVERSED') ?? null;
  const latestReversedMatch = matches.find((match) => match.status === 'REVERSED') ?? null;
  const matchedAmount = matches.reduce((total, match) => {
    return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
  }, 0);
  const remainingAmount = Math.max(0, Math.abs(transaction.amount) - matchedAmount);
  const canCreateManualMatch = canCreateBankReconciliationMatch(transaction.status);
  const paymentClearingCandidates = canCreateManualMatch
    ? await adminGet<AdminBookingPaymentClearingEntry[]>(
        buildBookingPaymentClearingApiHref({ page: 1, range: '30d', review: 'open', take: 50 }),
        [],
      )
    : [];
  const paymentClearingOptions = paymentClearingCandidates
    .filter((entry) => entry.currency === transaction.currency)
    .sort(paymentClearingCandidateComparator(remainingAmount || Math.abs(transaction.amount)))
    .map((entry) => ({
      label: paymentClearingCandidateLabel(entry, remainingAmount || Math.abs(transaction.amount)),
      value: entry.id,
    }));

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
      <FinanceTablePanel
        description={`${transaction.transferRef ?? shortId(transaction.sourceKey)} · Occurred ${formatDateTime(transaction.occurredAt)}`}
        resultLabel={transaction.status}
        resultTone={statusTone(transaction.status)}
        title="Bank transaction overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Bank account" value={transaction.bankAccount?.name ?? 'Unknown account'} />
          <FinanceDetailInfoItem label="Bank" value={transaction.bankAccount?.bankName ?? '-'} />
          <FinanceDetailInfoItem label="Counterparty" value={transaction.counterpartyName ?? '-'} />
          <FinanceDetailInfoItem label="Value date" value={transaction.valueDate ? formatDateTime(transaction.valueDate) : '-'} />
          <FinanceDetailInfoItem label="Transfer reference" value={transaction.transferRef ?? '-'} />
          <FinanceDetailInfoItem label="Source key" value={transaction.sourceKey} />
          <FinanceDetailInfoItem label="Description" value={transaction.description ?? '-'} />
          <FinanceDetailInfoItem label="Matched amount" value={formatMoney(matchedAmount, transaction.currency)} />
          <FinanceDetailInfoItem label="Remaining amount" value={formatMoney(remainingAmount, transaction.currency)} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Quick route from this bank transaction to the matched finance source, clearing evidence, and journal evidence."
        resultLabel={remainingAmount > 0 ? 'Unmatched remainder' : 'Fully reconciled'}
        resultTone={remainingAmount > 0 ? 'warning' : 'success'}
        title="Bank evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="Bank reconciliation operating path"
          steps={[
            {
              detail: transaction.status,
              label: 'Bank row',
              value: formatMoney(transaction.amount, transaction.currency),
            },
            {
              detail: latestActiveMatch ? latestActiveMatch.status : 'Waiting for match',
              label: 'Finance source',
              value: reconciliationSourceLabel(latestActiveMatch),
            },
            {
              detail: latestActiveMatch?.accountingJournalEntry ? 'GL linked' : 'No active GL link',
              label: 'Ledger evidence',
              value: reconciliationLedgerLabel(latestActiveMatch),
            },
            {
              detail: bankReconciliationNextAction(transaction.status, remainingAmount, latestReversedMatch),
              label: 'Closeout state',
              value: remainingAmount > 0 ? formatMoney(remainingAmount, transaction.currency) : 'Clear',
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Matched finance source"
            value={
              latestActiveMatch
                ? `${latestActiveMatch.status} · ${shortId(latestActiveMatch.sourceKey)}`
                : 'No active matched source'
            }
          />
          <FinanceDetailInfoItem
            label="Payment clearing evidence"
            value={
              latestActiveMatch?.paymentClearingEntry ? (
                <div className="admin-table-substack">
                  <Link className="text-link" href={paymentClearingDetailHref(latestActiveMatch.paymentClearingEntry.id)}>
                    {latestActiveMatch.paymentClearingEntry.type}
                  </Link>
                  <span className="muted">{latestActiveMatch.paymentClearingEntry.status}</span>
                </div>
              ) : (
                'No active payment clearing link'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Journal evidence"
            value={
              latestActiveMatch?.accountingJournalEntry ? (
                <div className="admin-table-substack">
                  <Link className="text-link" href={generalLedgerDetailHref(latestActiveMatch.accountingJournalEntry.batchId)}>
                    {latestActiveMatch.accountingJournalEntry.accountCode}
                  </Link>
                  <span className="muted">{latestActiveMatch.accountingJournalEntry.accountName}</span>
                </div>
              ) : (
                'No active journal link'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Last reversed source"
            value={
              latestReversedMatch
                ? `${latestReversedMatch.status} · ${shortId(latestReversedMatch.sourceKey)}`
                : 'No reversed match'
            }
          />
          <FinanceDetailInfoItem
            label="Reversal reason"
            value={latestReversedMatch ? (reversalReasonFromMatch(latestReversedMatch) ?? '-') : '-'}
          />
          <FinanceDetailInfoItem label="Unmatched remainder" value={formatMoney(remainingAmount, transaction.currency)} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Create one explicit match against a payment clearing, journal, withdrawal, or payout record. The Admin API writes the audit log."
        resultLabel={manualMatchResultLabel({ matchError, matchNotice, reverseError, reverseNotice })}
        resultTone={manualMatchResultTone({ matchError, matchNotice, reverseError, reverseNotice })}
        title="Manual reconciliation match"
      >
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
        {canCreateManualMatch ? (
          <>
            <form action={createBankReconciliationMatchAction} className="form-grid compact-form admin-mt-16">
              <input name="bankTransactionId" type="hidden" value={transaction.id} />
              <input name="sourceType" type="hidden" value="payment-clearing" />
              <AdminFormSelect
                disabled={!paymentClearingOptions.length}
                label="Payment clearing candidate"
                labelVisibility="visible"
                name="sourceId"
                options={
                  paymentClearingOptions.length
                    ? paymentClearingOptions
                    : [{ label: 'No open payment clearing candidate for this currency', value: '' }]
                }
                required
              />
              <AdminFormInput
                defaultValue={remainingAmount || Math.abs(transaction.amount)}
                label="Match amount"
                labelVisibility="visible"
                min={1}
                name="amount"
                required
                step={1}
                type="number"
              />
              <AdminFormInput
                defaultValue={transaction.currency}
                label="Currency"
                labelVisibility="visible"
                name="currency"
                required
              />
              <AdminFormInput
                label="Approving admin ID"
                labelVisibility="visible"
                name="approvalAdminId"
                placeholder="Finance approver admin id"
                required
              />
              <AdminFormTextarea
                className="admin-grid-span-2"
                label="Operator notes"
                labelVisibility="visible"
                maxLength={500}
                name="notes"
                placeholder="Why this bank row matches the selected payment clearing evidence"
                rows={3}
              />
              <AdminFormControlButton disabled={!paymentClearingOptions.length}>Create match</AdminFormControlButton>
            </form>

            <details className="finance-reconciliation-import-disclosure admin-mt-16">
              <summary>
                <span>Advanced source match</span>
                <small>Use only for journal, withdrawal, or payout evidence that is not in payment clearing.</small>
              </summary>
              <form action={createBankReconciliationMatchAction} className="form-grid compact-form admin-mt-16">
                <input name="bankTransactionId" type="hidden" value={transaction.id} />
                <AdminFormSelect
                  label="Match source"
                  labelVisibility="visible"
                  name="sourceType"
                  options={reconciliationSourceOptions.filter((option) => option.value !== 'payment-clearing')}
                />
                <AdminFormInput
                  label="Source id"
                  labelVisibility="visible"
                  name="sourceId"
                  placeholder="journal, withdrawal, or payout id"
                  required
                />
                <AdminFormInput
                  defaultValue={remainingAmount || Math.abs(transaction.amount)}
                  label="Match amount"
                  labelVisibility="visible"
                  min={1}
                  name="amount"
                  required
                  step={1}
                  type="number"
                />
                <AdminFormInput
                  defaultValue={transaction.currency}
                  label="Currency"
                  labelVisibility="visible"
                  name="currency"
                  required
                />
                <AdminFormInput
                  label="Approving admin ID"
                  labelVisibility="visible"
                  name="approvalAdminId"
                  placeholder="Finance approver admin id"
                  required
                />
                <AdminFormTextarea
                  className="admin-grid-span-2"
                  label="Operator notes"
                  labelVisibility="visible"
                  maxLength={500}
                  name="notes"
                  placeholder="Why this bank row matches the selected finance source"
                  rows={3}
                />
                <AdminFormControlButton>Create advanced match</AdminFormControlButton>
              </form>
            </details>
          </>
        ) : (
          <p className="muted admin-mt-8">
            This bank transaction is already fully reconciled. Reverse an existing match before creating a new one.
          </p>
        )}
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
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
      </FinanceTablePanel>
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
  } catch (error) {
    logBankReconciliationActionError('create match', error);
    redirect(`${returnHref}?matchError=${bankReconciliationActionErrorCode(error)}`);
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
  } catch (error) {
    logBankReconciliationActionError('reverse match', error);
    redirect(`${returnHref}?reverseError=${bankReconciliationActionErrorCode(error)}`);
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

function manualMatchResultLabel({
  matchError,
  matchNotice,
  reverseError,
  reverseNotice,
}: {
  readonly matchError: string;
  readonly matchNotice: string;
  readonly reverseError: string;
  readonly reverseNotice: string;
}) {
  if (reverseNotice === '1') {
    return 'Match reversed';
  }
  if (matchNotice === '1') {
    return 'Match saved';
  }
  if (matchError || reverseError) {
    return 'Match failed';
  }
  return 'Manual review';
}

function manualMatchResultTone({
  matchError,
  matchNotice,
  reverseError,
  reverseNotice,
}: {
  readonly matchError: string;
  readonly matchNotice: string;
  readonly reverseError: string;
  readonly reverseNotice: string;
}): 'danger' | 'info' | 'success' {
  if (reverseNotice === '1' || matchNotice === '1') {
    return 'success';
  }
  if (matchError || reverseError) {
    return 'danger';
  }
  return 'info';
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

function statusTone(status: string): 'danger' | 'info' | 'success' | 'warning' {
  if (status === 'MATCHED' || status === 'CLEARED') {
    return 'success';
  }
  if (status === 'PARTIALLY_MATCHED' || status === 'PARTIALLY_CLEARED') {
    return 'info';
  }
  if (status === 'REVERSED') {
    return 'danger';
  }
  return 'warning';
}

function paymentClearingCandidateComparator(targetAmount: number) {
  return (left: AdminBookingPaymentClearingEntry, right: AdminBookingPaymentClearingEntry) => {
    const leftDelta = Math.abs(Math.abs(left.amount) - targetAmount);
    const rightDelta = Math.abs(Math.abs(right.amount) - targetAmount);
    if (leftDelta !== rightDelta) {
      return leftDelta - rightDelta;
    }
    return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
  };
}

function paymentClearingCandidateLabel(entry: AdminBookingPaymentClearingEntry, targetAmount: number) {
  const baseLabel = `${entry.type} - ${formatMoney(entry.amount, entry.currency)} - booking ${shortId(entry.bookingId)}`;
  if (Math.abs(Math.abs(entry.amount) - targetAmount) === 0) {
    return `Exact amount - ${baseLabel}`;
  }
  return baseLabel;
}

function reconciliationSourceLabel(match: AdminBankReconciliationMatch | null) {
  if (!match) {
    return 'No active source';
  }
  if (match.paymentClearingEntry) {
    return `Payment clearing ${shortId(match.paymentClearingEntry.id)}`;
  }
  if (match.accountingJournalEntry) {
    return `Journal ${match.accountingJournalEntry.accountCode}`;
  }
  if (match.withdrawalRequest) {
    return `Withdrawal ${shortId(match.withdrawalRequest.id)}`;
  }
  if (match.payoutBatch) {
    return `Payout ${shortId(match.payoutBatch.id)}`;
  }
  return shortId(match.sourceKey);
}

function reconciliationLedgerLabel(match: AdminBankReconciliationMatch | null) {
  if (!match?.accountingJournalEntry) {
    return 'Pending journal evidence';
  }
  return `${match.accountingJournalEntry.accountCode} · ${match.accountingJournalEntry.accountName}`;
}

function bankReconciliationNextAction(
  status: string,
  remainingAmount: number,
  latestReversedMatch: AdminBankReconciliationMatch | null,
) {
  if (remainingAmount <= 0 || status === 'MATCHED') {
    return 'Ready for closeout';
  }
  if (latestReversedMatch) {
    return 'Review reversed evidence';
  }
  if (status === 'PARTIALLY_MATCHED') {
    return 'Match remaining amount';
  }
  return 'Create explicit match';
}

function canCreateBankReconciliationMatch(status: string) {
  return status === 'UNMATCHED' || status === 'PARTIALLY_MATCHED';
}

function readRecordString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function reversalReasonFromMatch(match: { readonly metadata?: unknown }) {
  const record = readPlainRecord(match.metadata);
  return readRecordString(record, 'reversalReason') ?? readRecordString(record, 'reason');
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

function bankReconciliationActionErrorCode(error: unknown) {
  if (error instanceof AdminOperatorAccessDeniedError) {
    return 'access-denied';
  }
  if (error instanceof AdminApiRequestError) {
    return `api-${error.status}`;
  }
  if (error instanceof Error && error.message.startsWith('ADMIN_ACCESS_TOKEN')) {
    return 'admin-token';
  }
  if (error instanceof TypeError) {
    return 'request';
  }
  return 'failed';
}

function logBankReconciliationActionError(action: string, error: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const details =
    error instanceof Error
      ? { message: error.message, name: error.name }
      : { message: String(error), name: typeof error };
  console.warn(`[bank-reconciliation] ${action} failed`, details);
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}
