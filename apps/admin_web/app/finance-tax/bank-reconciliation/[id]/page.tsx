import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import type {
  AdminBankReconciliationMatch,
  AdminBankReconciliationTransactionDetail,
  AdminUser,
} from '../../../../lib/admin-api';
import {
  AdminApiRequestError,
  AdminOperatorAccessDeniedError,
  adminGet,
  adminGetResult,
  adminPostOrThrow,
} from '../../../../lib/admin-api';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormActionRow,
  AdminFormGrid,
  AdminFormInput,
  AdminFormSearch,
  AdminFormSelect,
  AdminFormShell,
  AdminFormTextarea,
} from '../../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../../components/admin-inline-fallback';
import {
  AdminFinanceOperatorEvidence,
  adminOperatorLabel,
} from '../../../../components/admin-finance-operator-evidence';
import { AdminInlineNotice } from '../../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { ConfirmDialog } from '../../../../components/confirm-dialog';
import { AdminBasicTimeline, AdminDisclosure, AdminErrorState } from '../../../../components/admin-surface';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadge, StatusBadgeFromPillClass } from '../../../../components/status-badge';
import { formatMoney, readPlainRecord, shortId } from '../../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import {
  financeBankReconciliationStatusPill,
  financeBankReconciliationStatusModel,
  financeBankReconciliationStatusTone,
} from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  bankReconciliationDetailHref,
  buildBankReconciliationDetailApiHref,
  generalLedgerDetailHref,
  paymentClearingDetailHref,
  safeBankReconciliationReturnTo,
} from '../../tax-settlement-page-model';
import { buildBankReconciliationAssignmentTimeline } from '../bank-reconciliation-assignment-timeline-model';
import {
  BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH,
  isConfirmedBankReconciliationAction,
} from '../bank-reconciliation-action-validation';
import { BankReconciliationConfirmationDisclosure } from '../bank-reconciliation-confirmation-disclosure';
import { buildBankReconciliationReviewOwnerOptions } from '../bank-reconciliation-review-owner-model';

type BankReconciliationDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: BankReconciliationDetailPageProps): Promise<Metadata> {
  const id = (params ? await params : {})?.id;
  return { title: id ? `Bank Transaction ${shortId(id)}` : 'Payment Matching' };
}

const reconciliationSourceOptions = [
  { label: 'Payment clearing entry', value: 'payment-clearing' },
  { label: 'Partner bank deposit request', value: 'partner-bank-deposit' },
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
  const ignoreNotice = readParam(noticeParams, 'ignored');
  const ignoreError = readParam(noticeParams, 'ignoreError');
  const reviewAssignmentNotice = readParam(noticeParams, 'reviewAssignmentNotice');
  const confirmAction = readParam(noticeParams, 'confirm');
  const candidateQuery = readParam(noticeParams, 'candidateQ').trim();
  const candidatePage = boundedCandidatePage(readParam(noticeParams, 'candidatePage'));
  const candidateTake = boundedCandidateTake(readParam(noticeParams, 'candidateTake'));
  const returnTo = safeBankReconciliationReturnTo(readParam(noticeParams, 'returnTo'));
  const detailApiParams = new URLSearchParams({
    candidatePage: String(candidatePage),
    candidateTake: String(candidateTake),
  });
  if (candidateQuery) detailApiParams.set('candidateQ', candidateQuery);
  const detailApiHref = `${buildBankReconciliationDetailApiHref(id)}?${detailApiParams.toString()}`;
  const requestedDetailHref = bankCandidateStateHref(bankReconciliationDetailHref(id, returnTo), {
    candidatePage,
    candidateQuery,
    candidateTake,
  });

  const transactionResult = await adminGetResult<AdminBankReconciliationTransactionDetail | null>(
    detailApiHref,
    null,
  );
  if (!transactionResult.ok && transactionResult.status === 404) {
    notFound();
  }
  if (!transactionResult.ok || !transactionResult.data) {
    const errorCopy = bankReconciliationDetailErrorCopy(
      transactionResult.status,
      transactionResult.requestId,
    );
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to bank reconciliation</AdminFormControlLink>}
        description="The bank transaction API did not return authoritative reconciliation evidence."
        title="Bank Reconciliation Detail"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={requestedDetailHref}>Retry</AdminFormControlLink>}
          message={errorCopy.message}
          title={errorCopy.title}
        />
      </AdminPageTemplate>
    );
  }
  const transaction = transactionResult.data;

  const canAssignReviewOwner = canAssignBankTransactionReview(transaction.status);
  const requestedReviewOwnerConfirmation = confirmAction === 'review-owner' && canAssignReviewOwner;
  const [currentOperatorAccess, adminUsers] = await Promise.all([
    getCurrentAdminOperatorAccess(),
    adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
  ]);
  const matches = transaction.reconciliationMatches ?? [];
  const activeMatchCount =
    transaction.preflight?.activeMatchCount ?? matches.filter((match) => match.status !== 'REVERSED').length;
  const latestActiveMatch = matches.find((match) => match.status !== 'REVERSED') ?? null;
  const latestReversedMatch = matches.find((match) => match.status === 'REVERSED') ?? null;
  const matchedAmount =
    transaction.preflight?.matchedAmount ??
    matches.reduce((total, match) => {
      return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
    }, 0);
  const remainingAmount =
    transaction.preflight?.remainingAmount ?? Math.max(0, Math.abs(transaction.amount) - matchedAmount);
  const suggestedMatchAmount = remainingAmount || Math.abs(transaction.amount);
  const statusModel = financeBankReconciliationStatusModel(transaction.status);
  const reconciliationNextAction =
    latestReversedMatch && !statusModel.closed ? 'Review reversed evidence' : statusModel.nextAction;
  const canCreateManualMatch =
    transaction.preflight?.actions.createMatch.allowed ??
    canCreateBankReconciliationMatch(transaction.status);
  const canIgnoreBankTransaction =
    transaction.preflight?.actions.ignore.allowed ??
    (transaction.status === 'UNMATCHED' && !latestActiveMatch);
  const paymentClearingCandidates = transaction.paymentClearingCandidates ?? [];
  const eligiblePaymentClearingCandidates = paymentClearingCandidates.filter((entry) => entry.eligible);
  const recommendedPaymentClearingCandidateCount = eligiblePaymentClearingCandidates.filter(
    (entry) => entry.confidence === 'STRONG',
  ).length;
  const manualReviewPaymentClearingCandidateCount =
    eligiblePaymentClearingCandidates.length - recommendedPaymentClearingCandidateCount;
  const paymentClearingCandidateSummary = `${recommendedPaymentClearingCandidateCount} recommended · ${manualReviewPaymentClearingCandidateCount} manual review · ${paymentClearingCandidates.length} shown`;
  const paymentClearingOptions = [
    { label: 'Select a payment clearing candidate', value: '' },
    ...eligiblePaymentClearingCandidates.map((entry) => ({
      label: paymentClearingCandidateLabel(entry),
      value: entry.id,
    })),
  ];
  const withdrawalCandidates = transaction.withdrawalCandidates ?? [];
  const withdrawalOptions = withdrawalCandidates.map((candidate) => ({
    label: withdrawalCandidateLabel(candidate),
    value: candidate.id,
  }));
  const assignmentTimeline = buildBankReconciliationAssignmentTimeline(transaction.assignmentHistory);
  const currentAssignment = assignmentTimeline[0] ?? null;
  const reviewOwnerOptions = buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    currentAssignment?.assigneeId ?? null,
    currentOperatorAccess?.id ?? null,
  );
  const detailPath = `/finance-tax/bank-reconciliation/${encodeURIComponent(transaction.id)}`;
  const detailHref = bankCandidateStateHref(bankReconciliationDetailHref(transaction.id, returnTo), {
    candidatePage,
    candidateQuery,
    candidateTake,
  });
  const showReviewOwnerConfirmation = requestedReviewOwnerConfirmation && reviewOwnerOptions.length > 0;
  const paymentClearingCandidateEvidence = (
    <>
      <AdminFormShell action={detailPath} className="filter-form admin-mb-16" method="get">
        <input name="returnTo" type="hidden" value={returnTo} />
        <input name="candidatePage" type="hidden" value="1" />
        <input name="candidateTake" type="hidden" value={candidateTake} />
        <AdminFormSearch
          defaultValue={candidateQuery}
          label="Find another payment clearing record"
          name="candidateQ"
          placeholder="Booking, payment, customer, or Partner reference"
        />
        <AdminFormActionRow>
          <AdminFormControlButton className="button-secondary" type="submit">
            Search candidates
          </AdminFormControlButton>
          {candidateQuery ? (
            <AdminTextLink
              href={bankCandidateStateHref(detailHref, {
                candidatePage: 1,
                candidateQuery: '',
                candidateTake,
              })}
            >
              Clear search
            </AdminTextLink>
          ) : null}
        </AdminFormActionRow>
      </AdminFormShell>
      <FinanceDataTable
        ariaLabel="Payment clearing candidates"
        emptyMessage={
          candidateQuery
            ? 'No payment clearing evidence matches this search.'
            : 'No payment clearing evidence is close enough to this bank transaction. Search by an exact identifier or reference to look beyond the 45-day window.'
        }
        headers={['Candidate', 'Payment evidence', 'Amount', 'Why it is shown']}
        rowCount={paymentClearingCandidates.length}
      >
        {paymentClearingCandidates.map((candidate) => (
          <tr key={candidate.id}>
            <td>
              <AdminTableSubstack>
                <strong>{candidate.customerLabel}</strong>
                <span className="muted">
                  Booking {shortId(candidate.bookingId)} · {candidate.bookingStatus}
                </span>
                <span className="muted">Clearing {shortId(candidate.id)}</span>
                <span className="muted">
                  Payment {candidate.paymentId ? shortId(candidate.paymentId) : 'not linked'}
                </span>
              </AdminTableSubstack>
            </td>
            <td>
              <AdminTableSubstack>
                <strong>{candidate.paymentMethod ?? candidate.type}</strong>
                <span className="muted">{candidate.paymentStatus ?? 'No payment record status'}</span>
                <span className="muted">
                  {candidate.paymentProviderRef ?? 'No payment provider reference'}
                </span>
              </AdminTableSubstack>
            </td>
            <td>
              <AdminTableSubstack>
                <strong>
                  <MoneyText amount={candidate.amount} currency={candidate.currency} />
                </strong>
                <span className="muted">
                  Remaining <MoneyText amount={candidate.remainingAmount} currency={candidate.currency} />
                </span>
                <span className="muted">
                  Amount gap <MoneyText amount={candidate.amountDelta} currency={candidate.currency} />
                </span>
              </AdminTableSubstack>
            </td>
            <td>
              <AdminTableSubstack>
                <StatusBadge
                  tone={
                    !candidate.eligible
                      ? 'danger'
                      : candidate.confidence === 'STRONG'
                        ? 'success'
                        : 'warning'
                  }
                >
                  {!candidate.eligible
                    ? 'Not selectable'
                    : candidate.confidence === 'STRONG'
                      ? 'Recommended'
                      : 'Review'}
                </StatusBadge>
                <DateTimeText value={candidate.occurredAt} />
                <span className="muted">
                  {candidate.eligible ? (
                    <>
                      {candidate.transferRefMatch
                        ? 'Transfer reference matches the payment provider reference · '
                        : null}
                      {candidate.exactAmount ? (
                        'Remaining clearing amount matches exactly'
                      ) : (
                        <>
                          <MoneyText amount={candidate.amountDelta} currency={candidate.currency} /> amount gap
                        </>
                      )}
                      {' · '}
                      {candidate.dateDeltaDays} day date gap
                    </>
                  ) : (
                    (candidate.exclusionReasons ?? []).join(' · ')
                  )}
                </span>
              </AdminTableSubstack>
            </td>
          </tr>
        ))}
      </FinanceDataTable>
      {transaction.paymentClearingCandidatePage ? (
        <AdminFormActionRow className="admin-mt-12">
          {transaction.paymentClearingCandidatePage.hasPrevious ? (
            <AdminFormControlLink
              className="button-secondary"
              href={bankCandidateStateHref(detailHref, {
                candidatePage: candidatePage - 1,
                candidateQuery,
                candidateTake,
              })}
            >
              Previous candidates
            </AdminFormControlLink>
          ) : null}
          <span className="muted">
            Candidate page {transaction.paymentClearingCandidatePage.page} · up to{' '}
            {transaction.paymentClearingCandidatePage.take} per page
          </span>
          {transaction.paymentClearingCandidatePage.hasNext ? (
            <AdminFormControlLink
              className="button-secondary"
              href={bankCandidateStateHref(detailHref, {
                candidatePage: candidatePage + 1,
                candidateQuery,
                candidateTake,
              })}
            >
              Next candidates
            </AdminFormControlLink>
          ) : null}
        </AdminFormActionRow>
      ) : null}
    </>
  );

  return (
    <AdminPageTemplate
      actions={
        <AdminFormActionRow>
          <AdminFormControlLink className="button-secondary" href={returnTo}>
            {returnTo.startsWith('/finance-tax/payment-clearing/')
              ? 'Back to payment evidence'
              : 'Back to bank reconciliation'}
          </AdminFormControlLink>
          {canAssignReviewOwner ? (
            <AdminFormControlLink
              className="button-primary"
              href={appendDetailParam(detailHref, 'confirm', 'review-owner')}
            >
              {currentAssignment ? 'Reassign owner' : 'Assign owner'}
            </AdminFormControlLink>
          ) : null}
        </AdminFormActionRow>
      }
      description="Bank transaction evidence for manual reconciliation against payment clearing, journal, withdrawal, and payout records."
      metrics={[
        {
          helper: statusModel.closeoutLabel,
          kind: 'record',
          label: 'Status',
          scope: 'Record detail',
          value: statusModel.label,
        },
        {
          helper: 'Bank transaction amount.',
          kind: 'record',
          label: 'Amount',
          scope: 'Record detail',
          value: <MoneyText amount={transaction.amount} currency={transaction.currency} />,
        },
        {
          helper: `${matches.length} retained match record(s), including reversed history.`,
          kind: 'record',
          label: 'Active matches',
          scope: 'Record detail',
          value: activeMatchCount,
        },
        {
          helper: 'Bank flow direction.',
          kind: 'record',
          label: 'Type',
          scope: 'Record detail',
          value: transaction.type,
        },
      ]}
      title="Bank Reconciliation Detail"
    >
      {reviewAssignmentNotice === 'assigned' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="success">
          Review owner updated. The transaction remains open until matching or approved ignore is completed.
        </AdminInlineNotice>
      ) : reviewAssignmentNotice === 'failed' ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Review owner was not updated. Confirm the operator has Bank Reconciliation access and is not already
          assigned.
        </AdminInlineNotice>
      ) : null}

      {showReviewOwnerConfirmation ? (
        <ConfirmDialog
          action={assignBankTransactionReviewAction}
          cancelHref={detailHref}
          confirmLabel={currentAssignment ? 'Reassign owner' : 'Assign owner'}
          description={
            currentAssignment
              ? 'Transfer this open review to another eligible Finance operator. Existing ownership and SLA evidence remains in the audit timeline.'
              : 'Assign this open bank transaction to an eligible Finance operator without changing its reconciliation status.'
          }
          hiddenInputs={[
            { name: 'bankTransactionId', value: transaction.id },
            { name: 'candidatePage', value: candidatePage },
            { name: 'candidateQ', value: candidateQuery },
            { name: 'candidateTake', value: candidateTake },
            { name: 'confirmationBankTransactionId', value: transaction.id },
            { name: 'returnTo', value: returnTo },
          ]}
          id={`bank-review-owner-${transaction.id}`}
          selectInputs={[
            {
              defaultValue: reviewOwnerOptions[0]?.value,
              label: 'Review owner',
              name: 'assigneeAdminId',
              options: reviewOwnerOptions,
              required: true,
            },
          ]}
          textInputs={[
            {
              label: 'Assignment reason',
              maxLength: 500,
              minLength: 12,
              name: 'reason',
              placeholder: 'Why should this operator own the reconciliation review?',
              required: true,
            },
          ]}
          title={`${currentAssignment ? 'Reassign' : 'Assign'} bank reconciliation review?`}
          tone="warning"
        />
      ) : requestedReviewOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          No eligible Finance operator is available for this review. Check Admin Operator category access.
        </AdminInlineNotice>
      ) : null}

      {!statusModel.closed && transaction.preflight && !transaction.preflight.actions.createMatch.allowed ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          {transaction.preflight.actions.createMatch.blockers.map((blocker) => blocker.message).join(' ')}
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        description={
          <>
            {transaction.transferRef ?? shortId(transaction.sourceKey)} · Occurred{' '}
            <DateTimeText value={transaction.occurredAt} />
          </>
        }
        resultLabel={statusModel.label}
        resultTone={financeBankReconciliationStatusTone(transaction.status)}
        title="Bank transaction overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Bank account"
            value={transaction.bankAccount?.name ?? 'Unknown account'}
          />
          <FinanceDetailInfoItem label="Bank" value={transaction.bankAccount?.bankName ?? '-'} />
          <FinanceDetailInfoItem label="Counterparty" value={transaction.counterpartyName ?? '-'} />
          <FinanceDetailInfoItem
            label="Value date"
            value={transaction.valueDate ? <DateTimeText value={transaction.valueDate} /> : '-'}
          />
          <FinanceDetailInfoItem label="Transfer reference" value={transaction.transferRef ?? '-'} />
          <FinanceDetailInfoItem label="Source key" value={transaction.sourceKey} />
          <FinanceDetailInfoItem label="Description" value={transaction.description ?? '-'} />
          {transaction.creationEvidence ? (
            <>
              <FinanceDetailInfoItem
                label="Imported by"
                value={adminOperatorLabel(
                  transaction.creationEvidence.importedBy,
                  transaction.creationEvidence.importedByAdminId,
                )}
              />
              <FinanceDetailInfoItem
                label="Import approval stage"
                value={
                  transaction.creationEvidence.approvalAdminId
                    ? `Legacy import: ${adminOperatorLabel(
                        transaction.creationEvidence.approvalAdmin,
                        transaction.creationEvidence.approvalAdminId,
                      )}`
                    : 'Required when reconciling'
                }
              />
              <FinanceDetailInfoItem
                label="Import source"
                value={
                  transaction.creationEvidence.sourceFileName ??
                  transaction.creationEvidence.batchImportId ??
                  'Manual bank row'
                }
              />
              <FinanceDetailInfoItem
                label="Operator reason"
                value={transaction.creationEvidence.operatorReason ?? '-'}
              />
            </>
          ) : null}
          <FinanceDetailInfoItem
            label="Matched amount"
            value={<MoneyText amount={matchedAmount} currency={transaction.currency} />}
          />
          <FinanceDetailInfoItem
            label="Remaining amount"
            value={<MoneyText amount={remainingAmount} currency={transaction.currency} />}
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        description="Persisted review ownership evidence. The current SLA starts at the latest assignment; completed durations stop when the next owner was assigned."
        resultLabel={currentAssignment?.assigneeLabel ?? 'Unassigned'}
        resultTone={currentAssignment ? currentAssignment.tone : 'warning'}
        title="Review owner history"
      >
        {assignmentTimeline.length ? (
          <AdminBasicTimeline
            className="finance-bank-assignment-timeline admin-mt-16"
            compactMeta
            items={assignmentTimeline.map((assignment) => ({
              detail: assignment.detail,
              id: assignment.id,
              meta: [
                { label: 'Assigned by', value: assignment.assignedByLabel },
                { label: 'Previous owner', value: assignment.previousAssigneeLabel },
                { label: 'SLA elapsed', value: assignment.elapsedLabel },
              ],
              statusLabel: assignment.statusLabel,
              statusTone: assignment.tone,
              time: <DateTimeText value={assignment.assignedAt} />,
              title: assignment.assigneeLabel,
              tone: assignment.tone,
            }))}
          />
        ) : (
          <AdminInlineFallback>
            No review owner has been assigned. This transaction remains in the unassigned Finance queue.
          </AdminInlineFallback>
        )}
      </FinanceTablePanel>

      {transaction.status === 'UNMATCHED' || transaction.status === 'IGNORED' ? (
        <FinanceTablePanel
          description="Remove a confirmed duplicate or non-business bank row from the active reconciliation queue without changing any linked wallet, deposit, clearing, or ledger obligation."
          resultLabel={
            ignoreNotice === '1'
              ? 'Bank row ignored'
              : ignoreError
                ? 'Ignore failed'
                : transaction.status === 'IGNORED'
                  ? 'Ignored'
                  : 'Available after review'
          }
          resultTone={
            ignoreNotice === '1'
              ? 'success'
              : ignoreError
                ? 'danger'
                : financeBankReconciliationStatusTone(transaction.status)
          }
          title="Ignore bank transaction"
        >
          {ignoreError ? (
            <p className="muted admin-mt-8">
              {ignoreError === 'confirmation-required'
                ? 'The bank row was not ignored. Provide at least 12 characters of evidence before confirming.'
                : 'The bank row was not ignored. Confirm it has no active match, an assigned review owner, and a different signed-in Finance approver.'}
            </p>
          ) : null}
          {canIgnoreBankTransaction ? (
            <AdminFormGrid action={ignoreCompanyBankTransactionAction} className="compact-form admin-mt-16">
              <input name="bankTransactionId" type="hidden" value={transaction.id} />
              <input name="confirmationBankTransactionId" type="hidden" value={transaction.id} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <AdminFormTextarea
                className="admin-grid-span-2"
                label="Ignore reason"
                labelVisibility="visible"
                maxLength={500}
                minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
                name="reason"
                placeholder="Why this bank row is duplicate or outside HANDS reconciliation scope"
                required
                rows={3}
              />
              <BankReconciliationConfirmationDisclosure
                auditDetail="Submitting records the approving operator and ignore evidence without settling any linked finance obligation."
                className="admin-grid-span-2"
                confirmLabel="Confirm ignore"
                detail="This removes only the bank row from the active queue. It does not settle Partner deposit, wallet, tax, or GL evidence."
                title="Review ignored bank row"
                tone="danger"
              />
            </AdminFormGrid>
          ) : transaction.status === 'IGNORED' ? (
            <div className="admin-mt-8">
              <p className="muted">
                This bank row is ignored. Reason:{' '}
                {transaction.ignoreEvidence?.reason ?? 'Recorded in audit evidence'}.
              </p>
              <AdminFinanceOperatorEvidence
                lines={[
                  {
                    fallbackId: transaction.ignoreEvidence?.ignoredByAdminId,
                    key: 'ignored-by',
                    label: 'Action recorded by',
                    operator: transaction.ignoreEvidence?.ignoredBy,
                  },
                  {
                    fallbackId: transaction.ignoreEvidence?.approvalAdminId,
                    key: 'ignore-approved-by',
                    label: 'Finance approver',
                    operator: transaction.ignoreEvidence?.approvalAdmin,
                  },
                ]}
              />
              {transaction.ignoreEvidence?.ignoredAt ? (
                <p className="muted">
                  Ignored at <DateTimeText value={transaction.ignoreEvidence.ignoredAt} />
                </p>
              ) : null}
            </div>
          ) : (
            <AdminInlineNotice className="admin-mt-8" role="status" tone="warning">
              {transaction.preflight?.actions.ignore.blockers.map((blocker) => blocker.message).join(' ') ??
                'This bank transaction cannot be ignored in its current state.'}
            </AdminInlineNotice>
          )}
        </FinanceTablePanel>
      ) : null}

      <FinanceTablePanel
        description="Quick route from this bank transaction to the matched finance source, clearing evidence, and journal evidence."
        resultLabel={statusModel.closeoutLabel}
        resultTone={financeBankReconciliationStatusTone(transaction.status)}
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
              detail: latestActiveMatch
                ? latestActiveMatch.status
                : statusModel.closed
                  ? 'No active source required'
                  : 'Waiting for match',
              label: 'Finance source',
              value:
                !latestActiveMatch && statusModel.closed
                  ? 'No active matched source'
                  : reconciliationSourceLabel(latestActiveMatch),
            },
            {
              detail: latestActiveMatch?.accountingJournalEntry ? 'GL linked' : 'No active GL link',
              label: 'Ledger evidence',
              value: reconciliationLedgerLabel(latestActiveMatch),
            },
            {
              detail: reconciliationNextAction,
              label: 'Closeout state',
              value:
                !statusModel.closed && remainingAmount > 0 ? (
                  <MoneyText amount={remainingAmount} currency={transaction.currency} />
                ) : (
                  statusModel.label
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
                  <AdminTextLink
                    href={generalLedgerDetailHref(latestActiveMatch.accountingJournalEntry.batchId)}
                  >
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
            label={statusModel.closed ? 'Open remainder' : 'Unmatched remainder'}
            value={
              statusModel.closed ? (
                'Not applicable to this closed record'
              ) : (
                <MoneyText amount={remainingAmount} currency={transaction.currency} />
              )
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      {!statusModel.closed && !canCreateManualMatch ? (
        <FinanceTablePanel
          description="Search and inspect candidate evidence before assigning an owner. Matching remains unavailable until every preflight blocker is resolved."
          resultLabel={paymentClearingCandidateSummary}
          resultTone={recommendedPaymentClearingCandidateCount > 0 ? 'success' : 'warning'}
          title="Payment clearing candidates"
        >
          {paymentClearingCandidateEvidence}
        </FinanceTablePanel>
      ) : null}

      {!statusModel.closed ? (
        <FinanceTablePanel
          description="Create one explicit match against a payment clearing, Partner deposit, journal, withdrawal, or payout record. The Admin API writes the audit log."
          resultLabel={manualMatchResultLabel({ matchError, matchNotice, reverseError, reverseNotice })}
          resultTone={manualMatchResultTone({ matchError, matchNotice, reverseError, reverseNotice })}
          title="Manual reconciliation match"
        >
          {matchError ? (
            <p className="muted admin-mt-8">
              {matchError === 'confirmation-required'
                ? 'No match was saved. Review the exact bank transaction, source, amount, and at least 12 characters of accounting evidence before confirming.'
                : 'No match was saved. Check the source, amount, review owner, signed-in Finance approver, and current transaction state before trying again.'}
            </p>
          ) : null}
          {reverseError ? (
            <p className="muted admin-mt-8">
              {reverseError === 'confirmation-required'
                ? 'No match was reversed. Review the exact bank transaction and provide at least 12 characters of reversal evidence before confirming.'
                : 'No match was reversed. Check the review owner, signed-in Finance approver, and whether the match is still active.'}
            </p>
          ) : null}
          {canCreateManualMatch ? (
            <div className="finance-reconciliation-match-board admin-mt-16">
              {transaction.type === 'OUTFLOW' ? (
                <div className="finance-reconciliation-match-primary admin-mb-16">
                  <div className="finance-reconciliation-match-heading">
                    <div>
                      <strong>Recommended withdrawal match</strong>
                      <span>
                        Compare amount, paid date, and transfer reference. A candidate is never matched
                        automatically.
                      </span>
                    </div>
                    <StatusBadge tone={withdrawalOptions.length > 0 ? 'success' : 'warning'}>
                      {withdrawalOptions.length} candidate(s)
                    </StatusBadge>
                  </div>
                  <FinanceDataTable
                    emptyMessage="No unreconciled PAID withdrawal is close enough to this bank transaction."
                    headers={['Partner', 'Withdrawal', 'Paid', 'Transfer reference', 'Evidence']}
                    rowCount={withdrawalCandidates.length}
                  >
                    {withdrawalCandidates.map((candidate) => (
                      <tr key={candidate.id}>
                        <td>
                          <AdminTableSubstack>
                            <AdminTextLink
                              href={`/partners/${encodeURIComponent(candidate.providerProfileId)}?section=full#finance`}
                            >
                              {candidate.providerLabel}
                            </AdminTextLink>
                            <span className="muted">{shortId(candidate.id)}</span>
                          </AdminTableSubstack>
                        </td>
                        <td>
                          <strong>
                            <MoneyText amount={candidate.amount} currency={candidate.currency} />
                          </strong>
                          <span className="muted">
                            Amount gap <MoneyText amount={candidate.amountDelta} currency={candidate.currency} />
                          </span>
                        </td>
                        <td>
                          <DateTimeText value={candidate.paidAt ?? candidate.createdAt} />
                          <span className="muted">Date gap {candidate.dateDeltaDays} day(s)</span>
                        </td>
                        <td>
                          {candidate.transferRef ?? (
                            <AdminInlineFallback>No transfer ref</AdminInlineFallback>
                          )}
                        </td>
                        <td>
                          <AdminTableSubstack>
                            <StatusBadge tone={candidate.confidence === 'STRONG' ? 'success' : 'warning'}>
                              {candidate.confidence}
                            </StatusBadge>
                            <span className="muted">{withdrawalCandidateEvidence(candidate)}</span>
                          </AdminTableSubstack>
                        </td>
                      </tr>
                    ))}
                  </FinanceDataTable>
                  <AdminFormGrid
                    action={createBankReconciliationMatchAction}
                    className="compact-form admin-mt-16"
                  >
                    <input name="bankTransactionId" type="hidden" value={transaction.id} />
                    <input name="confirmationBankTransactionId" type="hidden" value={transaction.id} />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <input name="sourceType" type="hidden" value="withdrawal" />
                    <AdminFormSelect
                      disabled={!withdrawalOptions.length}
                      label="Withdrawal candidate"
                      labelVisibility="visible"
                      name="sourceId"
                      options={
                        withdrawalOptions.length
                          ? withdrawalOptions
                          : [{ label: 'No eligible withdrawal candidate', value: '' }]
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
                    <AdminFormTextarea
                      className="admin-grid-span-2"
                      label="Operator notes"
                      labelVisibility="visible"
                      maxLength={500}
                      minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
                      name="notes"
                      placeholder="Why the bank outflow matches this Partner withdrawal"
                      required
                      rows={3}
                    />
                    <BankReconciliationConfirmationDisclosure
                      className="admin-grid-span-2"
                      confirmLabel="Confirm withdrawal match"
                      detail="Creates a bank reconciliation match against the selected paid withdrawal. The signed-in Finance approver must differ from the assigned review owner."
                      disabled={!withdrawalOptions.length}
                      title="Review withdrawal match"
                    />
                  </AdminFormGrid>
                </div>
              ) : null}
              <div className="finance-reconciliation-match-primary">
                <div className="finance-reconciliation-match-heading">
                  <div>
                    <strong>Payment clearing match</strong>
                    <span>
                      Use this first when the bank row belongs to a customer payment or booking settlement
                      clearing entry.
                    </span>
                  </div>
                  <StatusBadge tone={recommendedPaymentClearingCandidateCount > 0 ? 'success' : 'warning'}>
                    {paymentClearingCandidateSummary}
                  </StatusBadge>
                </div>
                {paymentClearingCandidateEvidence}
                <AdminFormGrid
                  action={createBankReconciliationMatchAction}
                  className="compact-form admin-mt-16"
                >
                  <input name="bankTransactionId" type="hidden" value={transaction.id} />
                  <input name="confirmationBankTransactionId" type="hidden" value={transaction.id} />
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <input name="sourceType" type="hidden" value="payment-clearing" />
                  <AdminFormSelect
                    disabled={!eligiblePaymentClearingCandidates.length}
                    label="Payment clearing candidate"
                    labelVisibility="visible"
                    name="sourceId"
                    options={
                      eligiblePaymentClearingCandidates.length
                        ? paymentClearingOptions
                        : [{ label: 'No selectable payment clearing candidate available', value: '' }]
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
                  <AdminFormTextarea
                    className="admin-grid-span-2"
                    label="Operator notes"
                    labelVisibility="visible"
                    maxLength={500}
                    minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
                    name="notes"
                    placeholder="Why this bank row matches the selected payment clearing evidence"
                    required
                    rows={3}
                  />
                  <BankReconciliationConfirmationDisclosure
                    className="admin-grid-span-2"
                    confirmLabel="Confirm clearing match"
                    detail={
                      <>
                        Creates a reconciliation link for the entered amount. Suggested amount:{' '}
                        <MoneyText amount={suggestedMatchAmount} currency={transaction.currency} />.
                      </>
                    }
                    disabled={!eligiblePaymentClearingCandidates.length}
                    title="Review payment clearing match"
                  />
                </AdminFormGrid>
              </div>

              <AdminDisclosure className="finance-reconciliation-import-disclosure admin-mt-16">
                <summary>
                  <span>Advanced source match</span>
                  <small>
                    Use for a Partner deposit request, journal, withdrawal, or payout evidence that is not in
                    payment clearing.
                  </small>
                </summary>
                <AdminFormGrid
                  action={createBankReconciliationMatchAction}
                  className="compact-form admin-mt-16"
                >
                  <input name="bankTransactionId" type="hidden" value={transaction.id} />
                  <input name="confirmationBankTransactionId" type="hidden" value={transaction.id} />
                  <input name="returnTo" type="hidden" value={returnTo} />
                  <AdminFormSelect
                    label="Match source"
                    labelVisibility="visible"
                    name="sourceType"
                    options={reconciliationSourceOptions.filter(
                      (option) => option.value !== 'payment-clearing',
                    )}
                  />
                  <AdminFormInput
                    label="Source id"
                    labelVisibility="visible"
                    name="sourceId"
                    placeholder="deposit request, journal, withdrawal, or payout id"
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
                  <AdminFormTextarea
                    className="admin-grid-span-2"
                    label="Operator notes"
                    labelVisibility="visible"
                    maxLength={500}
                    minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
                    name="notes"
                    placeholder="Why this bank row matches the selected finance source"
                    required
                    rows={3}
                  />
                  <BankReconciliationConfirmationDisclosure
                    className="admin-grid-span-2"
                    confirmLabel="Confirm advanced match"
                    detail="Creates a reconciliation link to the explicit finance source ID. Verify the source record, currency, amount, and assigned review owner before submitting."
                    title="Review advanced source match"
                    tone="danger"
                  />
                </AdminFormGrid>
              </AdminDisclosure>
            </div>
          ) : (
            <p className="muted admin-mt-8">
              {transaction.preflight?.actions.createMatch.blockers
                .map((blocker) => blocker.message)
                .join(' ') ??
                'This bank transaction is already fully reconciled. Reverse an existing match before creating a new one.'}
            </p>
          )}
        </FinanceTablePanel>
      ) : null}

      <FinanceTablePanel
        grouped
        description="Each match points to the finance source used to reconcile this bank row."
        resultLabel={`${activeMatchCount} active · ${matches.length} history`}
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
                <ReconciliationMatchActionCell
                  canReverse={
                    transaction.preflight
                      ? transaction.preflight.actions.reverse.allowedMatchIds.includes(match.id)
                      : match.status !== 'REVERSED'
                  }
                  match={match}
                  returnTo={returnTo}
                  transactionId={transaction.id}
                />
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

  const partnerBankDepositRequestId = partnerBankDepositRequestIdFromJournalEntry(
    match.accountingJournalEntry,
  );

  return (
    <AdminTableSubstack>
      {partnerBankDepositRequestId ? (
        <AdminTextLink
          href={`/finance-tax/partner-bank-deposits/${encodeURIComponent(partnerBankDepositRequestId)}`}
        >
          Partner deposit
        </AdminTextLink>
      ) : null}
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
      <span className="muted">
        {match.paymentClearingEntry.bookingId ? shortId(match.paymentClearingEntry.bookingId) : '-'}
      </span>
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
  canReverse,
  match,
  returnTo,
  transactionId,
}: {
  readonly canReverse: boolean;
  readonly match: AdminBankReconciliationMatch;
  readonly returnTo: string;
  readonly transactionId: string;
}) {
  if (match.status === 'REVERSED') {
    return <span className="muted">Reversed</span>;
  }
  if (!canReverse) {
    return <StatusBadge tone="danger">Reversal blocked</StatusBadge>;
  }

  return (
    <AdminFormShell
      action={reverseBankReconciliationMatchAction}
      className="finance-reconciliation-reverse-form"
    >
      <input name="bankTransactionId" type="hidden" value={transactionId} />
      <input name="confirmationBankTransactionId" type="hidden" value={transactionId} />
      <input name="matchId" type="hidden" value={match.id} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <AdminFormInput
        label="Reversal reason"
        labelVisibility="visible"
        minLength={BANK_RECONCILIATION_EVIDENCE_MIN_LENGTH}
        name="reason"
        placeholder="Why this reconciliation match must be reversed"
        required
      />
      <BankReconciliationConfirmationDisclosure
        auditDetail="Submitting records the selected match, approving operator, and reversal evidence in the reconciliation audit trail."
        confirmLabel="Confirm reversal"
        detail="Reopens the matched amount for reconciliation and preserves the original match as reversed audit evidence."
        title="Review match reversal"
        tone="danger"
      />
    </AdminFormShell>
  );
}

async function createBankReconciliationMatchAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const confirmationBankTransactionId = readFormString(formData, 'confirmationBankTransactionId');
  const sourceType = readFormString(formData, 'sourceType');
  const sourceId = readFormString(formData, 'sourceId');
  const amount = Number(readFormString(formData, 'amount'));
  const currency = readFormString(formData, 'currency');
  const notes = readFormString(formData, 'notes');
  const sourceField = bankReconciliationSourceField(sourceType);
  const returnTo = safeBankReconciliationReturnTo(readFormString(formData, 'returnTo'));
  const returnHref = bankTransactionId ? bankReconciliationDetailHref(bankTransactionId, returnTo) : returnTo;

  if (
    !isConfirmedBankReconciliationAction({
      bankTransactionId,
      confirmationBankTransactionId,
      evidence: notes,
    }) ||
    !sourceField ||
    !sourceId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return redirect(appendDetailParam(returnHref, 'matchError', 'confirmation-required'));
  }

  try {
    await adminPostOrThrow(`/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/matches`, {
      amount,
      ...(currency ? { currency } : {}),
      ...(notes ? { notes } : {}),
      [sourceField]: sourceId,
    });
  } catch (error) {
    logBankReconciliationActionError('create match', error);
    return redirect(appendDetailParam(returnHref, 'matchError', bankReconciliationActionErrorCode(error)));
  }

  return redirect(appendDetailParam(returnHref, 'matched', '1'));
}

async function assignBankTransactionReviewAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const candidatePage = boundedCandidatePage(readFormString(formData, 'candidatePage'));
  const candidateQuery = readFormString(formData, 'candidateQ');
  const candidateTake = boundedCandidateTake(readFormString(formData, 'candidateTake'));
  const confirmationBankTransactionId = readFormString(formData, 'confirmationBankTransactionId');
  const assigneeAdminId = readFormString(formData, 'assigneeAdminId');
  const reason = readFormString(formData, 'reason');
  const returnTo = safeBankReconciliationReturnTo(readFormString(formData, 'returnTo'));
  const detailHref = bankTransactionId
    ? bankCandidateStateHref(bankReconciliationDetailHref(bankTransactionId, returnTo), {
        candidatePage,
        candidateQuery,
        candidateTake,
      })
    : returnTo;
  if (
    !isConfirmedBankReconciliationAction({
      bankTransactionId,
      confirmationBankTransactionId,
      evidence: reason,
    }) ||
    !assigneeAdminId
  ) {
    return redirect(appendDetailParam(detailHref, 'reviewAssignmentNotice', 'failed'));
  }

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/review-assignment`,
      { assigneeAdminId, reason },
    );
  } catch (error) {
    logBankReconciliationActionError('review assignment', error);
    return redirect(appendDetailParam(detailHref, 'reviewAssignmentNotice', 'failed'));
  }

  return redirect(appendDetailParam(detailHref, 'reviewAssignmentNotice', 'assigned'));
}

async function reverseBankReconciliationMatchAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const confirmationBankTransactionId = readFormString(formData, 'confirmationBankTransactionId');
  const matchId = readFormString(formData, 'matchId');
  const reason = readFormString(formData, 'reason');
  const returnTo = safeBankReconciliationReturnTo(readFormString(formData, 'returnTo'));
  const returnHref = bankTransactionId ? bankReconciliationDetailHref(bankTransactionId, returnTo) : returnTo;

  if (
    !isConfirmedBankReconciliationAction({
      bankTransactionId,
      confirmationBankTransactionId,
      evidence: reason,
    }) ||
    !matchId
  ) {
    return redirect(appendDetailParam(returnHref, 'reverseError', 'confirmation-required'));
  }

  try {
    await adminPostOrThrow(
      `/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/matches/${encodeURIComponent(
        matchId,
      )}/reverse`,
      { reason },
    );
  } catch (error) {
    logBankReconciliationActionError('reverse match', error);
    return redirect(appendDetailParam(returnHref, 'reverseError', bankReconciliationActionErrorCode(error)));
  }

  return redirect(appendDetailParam(returnHref, 'matchReversed', '1'));
}

async function ignoreCompanyBankTransactionAction(formData: FormData) {
  'use server';

  const bankTransactionId = readFormString(formData, 'bankTransactionId');
  const confirmationBankTransactionId = readFormString(formData, 'confirmationBankTransactionId');
  const reason = readFormString(formData, 'reason');
  const returnTo = safeBankReconciliationReturnTo(readFormString(formData, 'returnTo'));
  const returnHref = bankTransactionId ? bankReconciliationDetailHref(bankTransactionId, returnTo) : returnTo;

  if (
    !isConfirmedBankReconciliationAction({
      bankTransactionId,
      confirmationBankTransactionId,
      evidence: reason,
    })
  ) {
    return redirect(appendDetailParam(returnHref, 'ignoreError', 'confirmation-required'));
  }

  try {
    await adminPostOrThrow(`/admin/bank-reconciliation/${encodeURIComponent(bankTransactionId)}/ignore`, {
      reason,
    });
  } catch (error) {
    logBankReconciliationActionError('ignore bank transaction', error);
    return redirect(appendDetailParam(returnHref, 'ignoreError', bankReconciliationActionErrorCode(error)));
  }

  return redirect(appendDetailParam(returnHref, 'ignored', '1'));
}

function ReconciliationAuditTrail({ metadata }: { readonly metadata: unknown }) {
  const record = readPlainRecord(metadata);
  const bankBefore = readRecordString(record, 'bankStatusBefore');
  const bankAfter = readRecordString(record, 'bankStatusAfter');
  const clearingBefore = readRecordString(record, 'paymentClearingStatusBefore');
  const clearingAfter = readRecordString(record, 'paymentClearingStatusAfter');
  const auditAction = readRecordString(record, 'auditAction');
  const auditActorId = readRecordString(record, 'auditActorId');
  const auditActorName = readRecordString(record, 'auditActorName');
  const auditActorEmail = readRecordString(record, 'auditActorEmail');
  const auditAt = readRecordString(record, 'auditAt');
  const approvalAdminId = readRecordString(record, 'approvalAdminId');
  const approvalAdminName = readRecordString(record, 'approvalAdminName');
  const approvalAdminEmail = readRecordString(record, 'approvalAdminEmail');
  const matchActorId = readRecordString(record, 'matchActorId');
  const matchActorName = readRecordString(record, 'matchActorName');
  const matchActorEmail = readRecordString(record, 'matchActorEmail');
  const matchAuditAt = readRecordString(record, 'matchAuditAt');
  const matchApprovalAdminId = readRecordString(record, 'matchApprovalAdminId');
  const matchApprovalAdminName = readRecordString(record, 'matchApprovalAdminName');
  const matchApprovalAdminEmail = readRecordString(record, 'matchApprovalAdminEmail');
  const reversedByAdminId = readRecordString(record, 'reversedByAdminId');
  const reversedByAdminName = readRecordString(record, 'reversedByAdminName');
  const reversedByAdminEmail = readRecordString(record, 'reversedByAdminEmail');
  const reversedAuditAt = readRecordString(record, 'reversedAuditAt');
  const reversalApprovalAdminId = readRecordString(record, 'reversalApprovalAdminId');
  const reversalApprovalAdminName = readRecordString(record, 'reversalApprovalAdminName');
  const reversalApprovalAdminEmail = readRecordString(record, 'reversalApprovalAdminEmail');
  const reversalReason = readRecordString(record, 'reversalReason');
  const actorLabel = auditActorName ?? auditActorEmail ?? auditActorId;
  const approverLabel = approvalAdminName ?? approvalAdminEmail ?? approvalAdminId;
  const matchActorLabel = matchActorName ?? matchActorEmail ?? matchActorId;
  const matchApproverLabel = matchApprovalAdminName ?? matchApprovalAdminEmail ?? matchApprovalAdminId;
  const reversedByLabel = reversedByAdminName ?? reversedByAdminEmail ?? reversedByAdminId;
  const reversalApproverLabel =
    reversalApprovalAdminName ?? reversalApprovalAdminEmail ?? reversalApprovalAdminId;
  const hasSeparatedOperatorEvidence = Boolean(matchActorLabel || reversedByLabel);

  if (!bankBefore && !bankAfter && !clearingBefore && !clearingAfter && !auditAction) {
    return <AdminInlineFallback>No audit trail</AdminInlineFallback>;
  }

  return (
    <AdminTableSubstack>
      {auditAction ? <strong>{reconciliationAuditActionLabel(auditAction)}</strong> : null}
      {!hasSeparatedOperatorEvidence && (actorLabel || auditAt) ? (
        <span className="muted">
          {actorLabel ?? 'Unknown operator'}
          {auditAt ? (
            <>
              {' · '}
              <DateTimeText value={auditAt} />
            </>
          ) : null}
        </span>
      ) : null}
      {!hasSeparatedOperatorEvidence && approverLabel ? (
        <span className="muted">Finance approver: {approverLabel}</span>
      ) : null}
      {matchActorLabel ? (
        <span className="muted">
          Matched by {matchActorLabel}
          {matchAuditAt ? (
            <>
              {' · '}
              <DateTimeText value={matchAuditAt} />
            </>
          ) : null}
        </span>
      ) : null}
      {matchApproverLabel ? <span className="muted">Match approved by {matchApproverLabel}</span> : null}
      {reversedByLabel ? (
        <span className="muted">
          Reversed by {reversedByLabel}
          {reversedAuditAt ? (
            <>
              {' · '}
              <DateTimeText value={reversedAuditAt} />
            </>
          ) : null}
        </span>
      ) : null}
      {reversalApproverLabel ? (
        <span className="muted">Reversal approved by {reversalApproverLabel}</span>
      ) : null}
      {reversalReason ? <span className="muted">Reversal reason: {reversalReason}</span> : null}
      {bankBefore || bankAfter ? (
        <span>
          Bank: {bankBefore ?? '-'}
          {' -> '}
          {bankAfter ?? '-'}
        </span>
      ) : null}
      {clearingBefore || clearingAfter ? (
        <span className="muted">
          Clearing: {clearingBefore ?? '-'}
          {' -> '}
          {clearingAfter ?? '-'}
        </span>
      ) : null}
    </AdminTableSubstack>
  );
}

function reconciliationAuditActionLabel(action: string) {
  if (action === 'bank_reconciliation.match.create') return 'Match created';
  if (action === 'bank_reconciliation.match.reverse') return 'Match reversed';
  return action;
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

function paymentClearingCandidateLabel(
  entry: NonNullable<AdminBankReconciliationTransactionDetail['paymentClearingCandidates']>[number],
) {
  const evidence = entry.transferRefMatch
    ? 'Reference match'
    : entry.exactAmount
      ? 'Exact amount'
      : 'Review amount';
  return `${evidence} - ${entry.customerLabel} - ${formatMoney(entry.remainingAmount, entry.currency)} - booking ${shortId(entry.bookingId)}`;
}

function withdrawalCandidateLabel(
  candidate: NonNullable<AdminBankReconciliationTransactionDetail['withdrawalCandidates']>[number],
) {
  const evidence = candidate.transferRefMatch
    ? 'Reference match'
    : candidate.exactAmount
      ? 'Exact amount'
      : `${formatMoney(candidate.amountDelta, candidate.currency)} delta`;
  return `${candidate.providerLabel} - ${formatMoney(candidate.amount, candidate.currency)} - ${evidence}`;
}

function withdrawalCandidateEvidence(
  candidate: NonNullable<AdminBankReconciliationTransactionDetail['withdrawalCandidates']>[number],
) {
  const evidence = [
    candidate.transferRefMatch ? 'Reference match' : null,
    candidate.exactAmount ? 'Exact amount' : null,
    `${candidate.dateDeltaDays} day date gap`,
  ].filter(Boolean);
  return evidence.join(' / ');
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

function canCreateBankReconciliationMatch(status: string) {
  return status === 'UNMATCHED' || status === 'PARTIALLY_MATCHED';
}

function canAssignBankTransactionReview(status: string) {
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
  if (sourceType === 'partner-bank-deposit') {
    return 'partnerBankDepositRequestId';
  }
  if (sourceType === 'withdrawal') {
    return 'withdrawalRequestId';
  }
  if (sourceType === 'payout-batch') {
    return 'payoutBatchId';
  }
  return null;
}

function partnerBankDepositRequestIdFromJournalEntry(
  entry: AdminBankReconciliationMatch['accountingJournalEntry'],
) {
  if (!entry || entry.sourceType !== 'PROVIDER_BANK_DEPOSIT') {
    return null;
  }
  return readRecordString(readPlainRecord(entry.metadata), 'partnerBankDepositRequestId');
}

function bankReconciliationActionErrorCode(error: unknown) {
  if (error instanceof AdminOperatorAccessDeniedError) {
    return 'access-denied';
  }
  if (error instanceof AdminApiRequestError) {
    return `api-${error.status}`;
  }
  if (error instanceof Error && error.message.startsWith('Admin Web session')) {
    return 'admin-session';
  }
  if (error instanceof TypeError) {
    return 'request';
  }
  return 'failed';
}

function bankReconciliationDetailErrorCopy(status: number | null, requestId?: string | null) {
  const supportReference = requestId ? ` Support reference: ${requestId}.` : '';
  if (status === 403) {
    return {
      message: `Your operator account cannot load this bank reconciliation evidence.${supportReference}`,
      title: 'Bank reconciliation access denied',
    };
  }
  if (status === 400) {
    return {
      message: `The candidate search was rejected. Clear or revise the search before retrying.${supportReference}`,
      title: 'Bank reconciliation request rejected',
    };
  }
  return {
    message: `Retry before making a reconciliation or closeout decision.${supportReference}`,
    title: 'Bank reconciliation evidence unavailable',
  };
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

function boundedCandidatePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

function boundedCandidateTake(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 50) : 25;
}

function bankCandidateStateHref(
  detailHref: string,
  state: {
    readonly candidatePage: number;
    readonly candidateQuery: string;
    readonly candidateTake: number;
  },
) {
  const url = new URL(detailHref, 'http://admin.local');
  url.searchParams.set('candidatePage', String(Math.max(1, state.candidatePage)));
  url.searchParams.set('candidateTake', String(state.candidateTake));
  if (state.candidateQuery) {
    url.searchParams.set('candidateQ', state.candidateQuery);
  } else {
    url.searchParams.delete('candidateQ');
  }
  return `${url.pathname}${url.search}`;
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function appendDetailParam(href: string, key: string, value: string) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}
