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
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../../components/admin-inline-fallback';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminDisclosure } from '../../../../components/admin-surface';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../../components/status-badge';
import { formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import {
  financeBankReconciliationStatusPill,
  financeBankReconciliationStatusTone,
} from '../../finance-status-badge-model';
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
  const suggestedMatchAmount = remainingAmount || Math.abs(transaction.amount);
  const canCreateManualMatch = canCreateBankReconciliationMatch(transaction.status);
  const paymentClearingCandidates = canCreateManualMatch
    ? await adminGet<AdminBookingPaymentClearingEntry[]>(
        buildBookingPaymentClearingApiHref({ page: 1, range: '30d', review: 'open', take: 50 }),
        [],
      )
    : [];
  const paymentClearingOptions = paymentClearingCandidates
    .filter((entry) => entry.currency === transaction.currency)
    .sort(paymentClearingCandidateComparator(suggestedMatchAmount))
    .map((entry) => ({
      label: paymentClearingCandidateLabel(entry, suggestedMatchAmount),
      value: entry.id,
    }));

  return (
    <AdminPageTemplate
      actions={
        <AdminFormControlLink className="button-secondary" href={bankReconciliationHref({ page: 1, range: '30d', review: 'unmatched', take: 25 })}>
          Back to bank reconciliation
        </AdminFormControlLink>
      }
      description="Bank transaction evidence for manual reconciliation against payment clearing, journal, withdrawal, and payout records."
      metrics={[
        { helper: 'Bank transaction state.', label: 'Status', value: transaction.status },
        {
          helper: 'Bank transaction amount.',
          label: 'Amount',
          value: <MoneyText amount={transaction.amount} currency={transaction.currency} />,
        },
        { helper: 'Linked reconciliation matches.', label: 'Matches', value: matches.length },
        { helper: 'Bank flow direction.', label: 'Type', value: transaction.type },
      ]}
      title="Bank Reconciliation Detail"
    >
      <FinanceTablePanel
        description={
          <>
            {transaction.transferRef ?? shortId(transaction.sourceKey)} · Occurred{' '}
            <DateTimeText value={transaction.occurredAt} />
          </>
        }
        resultLabel={transaction.status}
        resultTone={financeBankReconciliationStatusTone(transaction.status)}
        title="Bank transaction overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Bank account" value={transaction.bankAccount?.name ?? 'Unknown account'} />
          <FinanceDetailInfoItem label="Bank" value={transaction.bankAccount?.bankName ?? '-'} />
          <FinanceDetailInfoItem label="Counterparty" value={transaction.counterpartyName ?? '-'} />
          <FinanceDetailInfoItem
            label="Value date"
            value={transaction.valueDate ? <DateTimeText value={transaction.valueDate} /> : '-'}
          />
          <FinanceDetailInfoItem label="Transfer reference" value={transaction.transferRef ?? '-'} />
          <FinanceDetailInfoItem label="Source key" value={transaction.sourceKey} />
          <FinanceDetailInfoItem label="Description" value={transaction.description ?? '-'} />
          <FinanceDetailInfoItem label="Matched amount" value={<MoneyText amount={matchedAmount} currency={transaction.currency} />} />
          <FinanceDetailInfoItem
            label="Remaining amount"
            value={<MoneyText amount={remainingAmount} currency={transaction.currency} />}
          />
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
              value: <MoneyText amount={transaction.amount} currency={transaction.currency} />,
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
              value:
                remainingAmount > 0 ? (
                  <MoneyText amount={remainingAmount} currency={transaction.currency} />
                ) : (
                  'Clear'
                ),
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
                <AdminTableSubstack>
                  <AdminTextLink href={paymentClearingDetailHref(latestActiveMatch.paymentClearingEntry.id)}>
                    {latestActiveMatch.paymentClearingEntry.type}
                  </AdminTextLink>
                  <span className="muted">{latestActiveMatch.paymentClearingEntry.status}</span>
                </AdminTableSubstack>
              ) : (
                'No active payment clearing link'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Journal evidence"
            value={
              latestActiveMatch?.accountingJournalEntry ? (
                <AdminTableSubstack>
                  <AdminTextLink href={generalLedgerDetailHref(latestActiveMatch.accountingJournalEntry.batchId)}>
                    {latestActiveMatch.accountingJournalEntry.accountCode}
                  </AdminTextLink>
                  <span className="muted">{latestActiveMatch.accountingJournalEntry.accountName}</span>
                </AdminTableSubstack>
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
          <FinanceDetailInfoItem
            label="Unmatched remainder"
            value={<MoneyText amount={remainingAmount} currency={transaction.currency} />}
          />
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
          <div className="finance-reconciliation-match-board admin-mt-16">
            <div className="finance-reconciliation-match-primary">
              <div className="finance-reconciliation-match-heading">
                <div>
                  <strong>Recommended payment clearing match</strong>
                  <span>Use this first when the bank row belongs to a customer payment or booking settlement clearing entry.</span>
                </div>
                <StatusBadge tone={paymentClearingOptions.length > 0 ? 'success' : 'warning'}>
                  {paymentClearingOptions.length} candidate(s)
                </StatusBadge>
              </div>
              <AdminFormGrid action={createBankReconciliationMatchAction} className="compact-form">
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
                  defaultValue={suggestedMatchAmount}
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
                <AdminFormActionRow className="finance-reconciliation-form-actions admin-grid-span-2">
                  <AdminFormControlButton disabled={!paymentClearingOptions.length}>Create match</AdminFormControlButton>
                  <span className="muted">
                    Suggested amount: <MoneyText amount={suggestedMatchAmount} currency={transaction.currency} />
                  </span>
                </AdminFormActionRow>
              </AdminFormGrid>
            </div>

            <AdminDisclosure className="finance-reconciliation-import-disclosure admin-mt-16">
              <summary>
                <span>Advanced source match</span>
                <small>Use only for journal, withdrawal, or payout evidence that is not in payment clearing.</small>
              </summary>
              <AdminFormGrid action={createBankReconciliationMatchAction} className="compact-form admin-mt-16">
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
                  defaultValue={suggestedMatchAmount}
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
                <AdminFormActionRow className="finance-reconciliation-form-actions admin-grid-span-2">
                  <AdminFormControlButton>Create advanced match</AdminFormControlButton>
                  <span className="muted">Requires explicit source id and approver evidence.</span>
                </AdminFormActionRow>
              </AdminFormGrid>
            </AdminDisclosure>
          </div>
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
        <FinanceDataTable
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
                  <ReconciliationMatchedSourceCell match={match} />
                </td>
                <td>
                  <ReconciliationJournalCell match={match} />
                </td>
                <td>
                  <ReconciliationPaymentClearingCell match={match} />
                </td>
                <td>
                  <ReconciliationPayoutCell match={match} />
                </td>
                <td>
                  <strong>
                    <MoneyText amount={match.amount} currency={match.currency} />
                  </strong>
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={financeBankReconciliationStatusPill(match.status)}>
                    {match.status}
                  </StatusBadgeFromPillClass>
                </td>
                <td>
                  <ReconciliationAuditTrail metadata={match.metadata} />
                </td>
                <td>
                  <ReconciliationMatchActionCell match={match} transactionId={transaction.id} />
                </td>
              </tr>
            ))}
          </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function ReconciliationMatchedSourceCell({ match }: { readonly match: AdminBankReconciliationMatch }) {
  return (
    <div className="finance-reconciliation-source-cell">
      <strong>{shortId(match.sourceKey)}</strong>
      <span className="muted">
        <DateTimeText value={match.matchedAt} />
      </span>
    </div>
  );
}

function ReconciliationJournalCell({ match }: { readonly match: AdminBankReconciliationMatch }) {
  if (!match.accountingJournalEntry) {
    return <AdminInlineFallback>No journal entry</AdminInlineFallback>;
  }

  return (
    <AdminTableSubstack>
      <AdminTextLink href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
        {match.accountingJournalEntry.accountCode}
      </AdminTextLink>
      <span className="muted">{match.accountingJournalEntry.accountName}</span>
    </AdminTableSubstack>
  );
}

function ReconciliationPaymentClearingCell({ match }: { readonly match: AdminBankReconciliationMatch }) {
  if (!match.paymentClearingEntry) {
    return <AdminInlineFallback>No clearing entry</AdminInlineFallback>;
  }

  return (
    <AdminTableSubstack>
      <AdminTextLink href={paymentClearingDetailHref(match.paymentClearingEntry.id)}>
        {match.paymentClearingEntry.type}
      </AdminTextLink>
      <span className="muted">{match.paymentClearingEntry.bookingId ? shortId(match.paymentClearingEntry.bookingId) : '-'}</span>
    </AdminTableSubstack>
  );
}

function ReconciliationPayoutCell({ match }: { readonly match: AdminBankReconciliationMatch }) {
  if (!match.withdrawalRequest && !match.payoutBatch) {
    return <AdminInlineFallback>No payout evidence</AdminInlineFallback>;
  }

  return (
    <AdminTableSubstack>
      {match.withdrawalRequest ? <strong>Withdrawal {shortId(match.withdrawalRequest.id)}</strong> : null}
      {match.payoutBatch ? <strong>Payout {shortId(match.payoutBatch.id)}</strong> : null}
    </AdminTableSubstack>
  );
}

function ReconciliationMatchActionCell({
  match,
  transactionId,
}: {
  readonly match: AdminBankReconciliationMatch;
  readonly transactionId: string;
}) {
  if (match.status === 'REVERSED') {
    return <span className="muted">Reversed</span>;
  }

  return (
    <AdminFormShell action={reverseBankReconciliationMatchAction} className="finance-reconciliation-reverse-form">
      <input name="bankTransactionId" type="hidden" value={transactionId} />
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
      <div className="finance-reconciliation-reverse-actions">
        <AdminFormControlButton className="button-secondary admin-inline-action">
          Reverse
        </AdminFormControlButton>
        <span className="muted">Requires approver ID before reversal.</span>
      </div>
    </AdminFormShell>
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
    return <AdminInlineFallback>No audit trail</AdminInlineFallback>;
  }

  return (
    <AdminTableSubstack>
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
    </AdminTableSubstack>
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
