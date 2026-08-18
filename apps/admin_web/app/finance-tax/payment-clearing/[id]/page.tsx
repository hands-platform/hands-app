import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import type { AdminBookingPaymentClearingEntryDetail, AdminUser } from '../../../../lib/admin-api';
import { adminGet, adminGetResult, adminPostOrThrow } from '../../../../lib/admin-api';
import { AdminFormActionRow, AdminFormControlLink } from '../../../../components/admin-form-controls';
import { AdminInlineFallback } from '../../../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../../../components/admin-inline-notice';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { ConfirmDialog } from '../../../../components/confirm-dialog';
import { AdminTableSubstack } from '../../../../components/admin-data-table';
import { AdminErrorState } from '../../../../components/admin-surface';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadgeFromPillClass } from '../../../../components/status-badge';
import { shortId } from '../../../../lib/admin-format';
import { getCurrentAdminOperatorAccess } from '../../../../lib/admin-operator-access';
import { FinanceBankMatchEvidence } from '../../finance-bank-match-evidence';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceOperatingPath } from '../../finance-operating-path';
import {
  financeBankReconciliationStatusPill,
  financePaymentClearingStatusTone,
} from '../../finance-status-badge-model';
import { FinanceTablePanel } from '../../finance-table-panel';
import { buildPaymentClearingReviewOwnerOptions } from '../../bank-reconciliation/bank-reconciliation-review-owner-model';
import { paymentClearingStateModel } from '../payment-clearing-state-model';
import {
  bankReconciliationDetailHref,
  buildBookingPaymentClearingDetailApiHref,
  buildFinanceSettlementTraceLinks,
  generalLedgerDetailHref,
  paymentClearingDetailHref,
  safePaymentClearingDetailReturnTo,
} from '../../tax-settlement-page-model';

type PaymentClearingDetailPageProps = {
  readonly params?: Promise<{ readonly id?: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: PaymentClearingDetailPageProps): Promise<Metadata> {
  const id = (params ? await params : {})?.id;
  return { title: id ? `Payment Evidence ${shortId(id)}` : 'Payment Matching' };
}

export default async function PaymentClearingDetailPage({
  params,
  searchParams,
}: PaymentClearingDetailPageProps) {
  const id = (await params)?.id;
  if (!id) {
    notFound();
  }

  const query = searchParams ? await searchParams : {};
  const returnTo = safePaymentClearingDetailReturnTo(readParam(query, 'returnTo'));
  const detailHref = paymentClearingDetailHref(id, returnTo);
  const entryResult = await adminGetResult<AdminBookingPaymentClearingEntryDetail | null>(
    buildBookingPaymentClearingDetailApiHref(id),
    null,
  );
  if (!entryResult.ok && entryResult.status === 404) {
    notFound();
  }
  if (!entryResult.ok || !entryResult.data) {
    const errorCopy = paymentClearingDetailErrorCopy(entryResult.status, entryResult.requestId);
    return (
      <AdminPageTemplate
        actions={<AdminFormControlLink href={returnTo}>Back to clearing</AdminFormControlLink>}
        description="The payment clearing API did not return authoritative finance evidence."
        title="Payment Clearing Detail"
      >
        <AdminErrorState
          action={<AdminFormControlLink href={detailHref}>Retry</AdminFormControlLink>}
          message={errorCopy.message}
          title={errorCopy.title}
        />
      </AdminPageTemplate>
    );
  }
  const entry = entryResult.data;

  const matches = entry.bankReconciliationMatches ?? [];
  const activeMatchCount = matches.filter((match) => match.status !== 'REVERSED').length;
  const latestActiveMatch = matches.find((match) => match.status !== 'REVERSED') ?? null;
  const matchedAmount =
    entry.matchedAmount ??
    matches.reduce((total, match) => {
      return match.status === 'REVERSED' ? total : total + Math.abs(match.amount);
    }, 0);
  const remainingAmount = entry.remainingAmount ?? Math.max(0, Math.abs(entry.amount) - matchedAmount);
  const clearingState = paymentClearingStateModel(entry.status, remainingAmount);
  const assignmentNotice = readParam(query, 'assignmentNotice');
  const requestedOwnerConfirmation = readParam(query, 'confirm') === 'review-owner' && clearingState.isMatchable;
  const closedAt =
    entry.status === 'REVERSED'
      ? (entry.settlementReversalEntry?.occurredAt ?? entry.clearedAt)
      : entry.clearedAt;
  const bankTransactionCandidates = entry.bankTransactionCandidates ?? [];
  const assignmentHistory = entry.assignmentHistory ?? [];
  const settlementRecordLinks = buildFinanceSettlementTraceLinks(entry);
  const settlementPaymentFee = paymentFeePolicyInfo(entry.settlementSnapshot, entry.currency);
  const [currentOperatorAccess, adminUsers] = requestedOwnerConfirmation
    ? await Promise.all([
        getCurrentAdminOperatorAccess(),
        adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', []),
      ])
    : [null, [] as AdminUser[]];
  const reviewOwnerOptions = buildPaymentClearingReviewOwnerOptions(
    adminUsers,
    entry.reviewAssignment?.assigneeAdminId ?? null,
    currentOperatorAccess?.id ?? null,
  );
  const showOwnerConfirmation = requestedOwnerConfirmation && reviewOwnerOptions.length > 0;

  return (
    <AdminPageTemplate
      actions={
        <AdminFormActionRow>
          <AdminFormControlLink className="button-secondary" href={returnTo}>
            Back to clearing
          </AdminFormControlLink>
          {clearingState.isMatchable ? (
            <AdminFormControlLink
              className="button-secondary"
              href={appendDetailParam(detailHref, 'confirm', 'review-owner')}
            >
              {entry.reviewAssignment ? 'Reassign owner' : 'Assign owner'}
            </AdminFormControlLink>
          ) : null}
          {clearingState.isMatchable && bankTransactionCandidates.length > 0 ? (
            <AdminFormControlLink
              className="button-primary"
              href="#matching-bank-candidates"
            >
              Compare candidate evidence
            </AdminFormControlLink>
          ) : clearingState.isMatchable ? (
            <AdminFormControlLink
              className="button-primary"
              href="/finance-tax/bank-reconciliation?range=all&review=unmatched"
            >
              Find matching bank transaction
            </AdminFormControlLink>
          ) : null}
        </AdminFormActionRow>
      }
      description="Evidence for one booking payment clearing row. Open this only when finance needs payment, settlement, or bank matching detail."
      metrics={[
        { helper: 'Clearing state.', kind: 'record', label: 'Status', scope: 'Clearing record', value: entry.status },
        { helper: 'Original payment evidence amount.', kind: 'record', label: 'Original amount', scope: 'Clearing record', value: <MoneyText amount={entry.amount} currency={entry.currency} /> },
        {
          helper: clearingState.isTerminal
            ? 'Reference balance retained with this terminal evidence. It is not available for a new match.'
            : 'Authoritative amount still available to match.',
          kind: 'record',
          label: 'Remaining amount',
          scope: 'Clearing record',
          value: <MoneyText amount={remainingAmount} currency={entry.currency} />,
        },
        { helper: 'Expected direction for an eligible bank match.', kind: 'record', label: 'Bank direction', scope: 'Clearing record', value: entry.expectedBankDirection ?? 'Manual review required' },
      ]}
      title="Payment Clearing Detail"
    >
      {assignmentNotice === 'assigned' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="success">
          Review owner updated. The payment clearing status and matched amount are unchanged.
        </AdminInlineNotice>
      ) : assignmentNotice === 'failed' ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="danger">
          Review owner was not updated. Confirm the operator has Payment Clearing access and is not already
          assigned.
        </AdminInlineNotice>
      ) : null}

      {showOwnerConfirmation ? (
        <ConfirmDialog
          action={assignPaymentClearingDetailReviewAction}
          cancelHref={detailHref}
          confirmLabel={entry.reviewAssignment ? 'Reassign owner' : 'Assign owner'}
          description={
            entry.reviewAssignment
              ? 'Transfer this open payment evidence review to another eligible Finance operator. Existing ownership evidence remains in the history.'
              : 'Assign this open payment evidence review without changing its clearing status or matched amount.'
          }
          hiddenInputs={[
            { name: 'clearingEntryId', value: entry.id },
            { name: 'confirmationClearingEntryId', value: entry.id },
            { name: 'returnTo', value: returnTo },
          ]}
          id={`payment-clearing-review-owner-${entry.id}`}
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
              placeholder: 'Why should this operator own the payment evidence review?',
              required: true,
            },
          ]}
          title={`${entry.reviewAssignment ? 'Reassign' : 'Assign'} payment evidence review?`}
          tone="warning"
        />
      ) : requestedOwnerConfirmation ? (
        <AdminInlineNotice className="admin-mb-16" role="alert" tone="warning">
          No eligible Finance operator is available for this review. Check Admin Operator category access.
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        description={
          <>
            {entry.type} · Clearing {shortId(entry.id)} · Occurred <DateTimeText value={entry.occurredAt} />
          </>
        }
        resultLabel={entry.status}
        resultTone={financePaymentClearingStatusTone(entry.status)}
        title="Clearing overview"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Booking"
            value={
              <AdminTextLink href={`/bookings/${entry.bookingId}`}>
                {shortId(entry.bookingId)}
              </AdminTextLink>
            }
          />
          <FinanceDetailInfoItem label="Payment" value={entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : '-'} />
          <FinanceDetailInfoItem label="Clearing ID" value={entry.id} />
          <FinanceDetailInfoItem
            label="Record key"
            value={
              <code className="finance-evidence-key" title={entry.sourceKey}>
                {entry.sourceKey.split(':').map((segment, index, segments) => (
                  <span key={`${segment}-${index}`}>
                    {segment}
                    {index < segments.length - 1 ? ':' : null}
                    <wbr />
                  </span>
                ))}
              </code>
            }
          />
          <FinanceDetailInfoItem
            label="Current owner"
            value={
              entry.reviewAssignment
                ? entry.reviewAssignment.assignee?.fullName ??
                  entry.reviewAssignment.assignee?.email ??
                  shortId(entry.reviewAssignment.assigneeAdminId)
                : 'Unassigned'
            }
          />
          <FinanceDetailInfoItem
            label="Assignment evidence"
            value={
              entry.reviewAssignment ? (
                <AdminTableSubstack>
                  <span><DateTimeText value={entry.reviewAssignment.assignedAt} /></span>
                  <span className="muted">{entry.reviewAssignment.reason ?? 'No assignment reason recorded'}</span>
                </AdminTableSubstack>
              ) : (
                'No assignment recorded'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Expected bank direction"
            value={entry.expectedBankDirection ?? 'Manual review required'}
          />
          <FinanceDetailInfoItem
                label="Nearby bank candidates"
                value={clearingState.isTerminal ? 'Not applicable to terminal evidence' : `${bankTransactionCandidates.length} unresolved candidate(s)`}
          />
          <FinanceDetailInfoItem
            label="Settlement payment fee"
            value={
              entry.settlementSnapshot ? (
                <AdminTableSubstack>
                  <MoneyText
                    amount={entry.settlementSnapshot.paymentProcessingFee}
                    currency={entry.settlementSnapshot.currency ?? entry.currency}
                  />
                  <span className="muted">
                    {paymentFeeBasisLabel(
                      settlementPaymentFee,
                      entry.settlementSnapshot.currency ?? entry.currency,
                      entry.settlementSnapshot.paymentProcessingFee,
                    )}
                  </span>
                  <span className="muted">Policy {settlementPaymentFee.policyVersionId}</span>
                  <span className="muted">{settlementPaymentFee.payer} / {settlementPaymentFee.treatment}</span>
                </AdminTableSubstack>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Payment record"
            value={
              entry.paymentId ? (
                <AdminTextLink href={`/payments/${entry.paymentId}`}>
                  {shortId(entry.paymentId)}
                </AdminTextLink>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Settlement links"
            value={
              settlementRecordLinks.length > 0 ? (
                <AdminTableSubstack>
                  {settlementRecordLinks.map((link) => (
                    <AdminTextLink href={link.href} key={link.label}>
                      {link.label} <span className="muted">{link.value}</span>
                    </AdminTextLink>
                  ))}
                </AdminTableSubstack>
              ) : (
                '-'
              )
            }
          />
          <FinanceDetailInfoItem
            label={clearingState.closedAtLabel}
            value={closedAt ? <DateTimeText value={closedAt} /> : clearingState.isTerminal ? 'No close timestamp recorded' : 'Waiting'}
          />
          <FinanceDetailInfoItem label="Matched amount" value={<MoneyText amount={matchedAmount} currency={entry.currency} />} />
          <FinanceDetailInfoItem label="Remaining amount" value={<MoneyText amount={remainingAmount} currency={entry.currency} />} />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      {entry.settlementSnapshot && settlementPaymentFee.policyVersionId === 'Policy record missing' ? (
        <AdminInlineNotice className="admin-mb-16" role="status" tone="warning">
          Payment fee policy evidence is missing for this settlement snapshot. Verify the recorded fee before
          using it for closeout.
        </AdminInlineNotice>
      ) : null}

      <FinanceTablePanel
        grouped
        description="Persisted assignment evidence for this payment review. Assignment changes do not change the clearing status or amount."
        resultLabel={entry.reviewAssignment ? 'Assigned' : 'Unassigned'}
        resultTone={entry.reviewAssignment ? 'info' : 'warning'}
        title="Review owner history"
      >
        {assignmentHistory.length > 0 ? (
          <FinanceDataTable
            ariaLabel="Payment clearing assignment history"
            emptyMessage="No review owner has been assigned to this payment evidence."
            headers={['Owner', 'Assigned by', 'Reason', 'Assigned at']}
            rowCount={assignmentHistory.length}
          >
            {assignmentHistory.map((assignment) => (
              <tr key={assignment.id}>
                <td>{assignment.assignee.fullName ?? assignment.assignee.email ?? shortId(assignment.assignee.id)}</td>
                <td>
                  {assignment.assignedBy?.fullName ??
                    assignment.assignedBy?.email ??
                    (assignment.assignedBy ? shortId(assignment.assignedBy.id) : 'System')}
                </td>
                <td>{assignment.reason ?? <AdminInlineFallback>No reason recorded</AdminInlineFallback>}</td>
                <td><DateTimeText value={assignment.assignedAt} /></td>
              </tr>
            ))}
          </FinanceDataTable>
        ) : (
          <p className="muted">No review owner has been assigned. Use Assign owner before approving reconciliation evidence.</p>
        )}
      </FinanceTablePanel>

      {clearingState.isTerminal ? null : (
      <FinanceTablePanel
        grouped
        description="Recent unresolved bank rows with the same currency and authoritative direction within the candidate window. These are unranked leads, not match recommendations. Compare amount and occurrence-time gaps before opening a row."
        id="matching-bank-candidates"
        resultLabel={
          remainingAmount <= 0
            ? 'Fully matched'
            : `${bankTransactionCandidates.length} unranked candidate(s)`
        }
        resultTone={
          remainingAmount <= 0 ? 'success' : bankTransactionCandidates.length > 0 ? 'info' : 'warning'
        }
        title="Matching bank candidates"
      >
        <FinanceDataTable
          ariaLabel="Matching bank transaction candidates"
          emptyMessage={
            remainingAmount <= 0
              ? 'This payment evidence has no remaining amount to match.'
              : 'No nearby unresolved bank transaction has the required currency and direction. Open Bank transactions to search the wider queue.'
          }
          headers={['Bank transaction', 'Direction', 'Amount', 'Match comparison', 'Assessment', 'Action']}
          rowCount={bankTransactionCandidates.length}
        >
          {bankTransactionCandidates.map((candidate) => (
            <tr key={candidate.id}>
              <td>
                <strong>{candidate.transferRef ?? shortId(candidate.id)}</strong>
                <div className="muted">{candidate.counterpartyName ?? 'No counterparty'}</div>
              </td>
              <td>{candidate.type}</td>
              <td><MoneyText amount={candidate.amount} currency={candidate.currency} /></td>
              <td>
                <AdminTableSubstack>
                  <span>
                    Amount gap <MoneyText amount={Math.abs(Math.abs(candidate.amount) - remainingAmount)} currency={candidate.currency} />
                  </span>
                  <span className="muted">Date gap {formatDateGap(entry.occurredAt, candidate.occurredAt)}</span>
                  <span className="muted"><DateTimeText value={candidate.occurredAt} /></span>
                </AdminTableSubstack>
              </td>
              <td>
                <AdminTableSubstack>
                  <span>{candidate.status}</span>
                  <span className="muted">Manual comparison required</span>
                </AdminTableSubstack>
              </td>
              <td>
                <AdminTextLink href={bankCandidateReviewHref(candidate.id, detailHref, entry.id)}>
                  Review evidence
                </AdminTextLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        {clearingState.isMatchable && bankTransactionCandidates.length === 0 ? (
          <div className="admin-mt-12">
            <AdminFormControlLink
              className="button-secondary"
              href="/finance-tax/bank-reconciliation?range=all&review=unmatched"
            >
              Open Bank transactions
            </AdminFormControlLink>
          </div>
        ) : null}
      </FinanceTablePanel>
      )}

      <FinanceTablePanel
        description="Quick links from this clearing row to the payment record, settlement record, journal, and bank match evidence."
        resultLabel={clearingState.resultLabel}
        resultTone={clearingState.isMatchable ? 'warning' : 'success'}
        title="Clearing evidence hub"
      >
        <FinanceOperatingPath
          ariaLabel="Payment clearing operating path"
          steps={[
            {
              detail: `Booking ${shortId(entry.bookingId)}`,
              label: 'Payment record',
              value: entry.payment ? `${entry.payment.method} · ${entry.payment.status}` : entry.type,
            },
            {
              detail: entry.status,
              label: 'Clearing row',
              value: <MoneyText amount={entry.amount} currency={entry.currency} />,
            },
            {
              detail: settlementPaymentFee.policyVersionId,
              label: 'Settlement evidence',
              value: paymentClearingSettlementLabel(entry, settlementRecordLinks.length),
            },
            {
              detail: paymentClearingNextAction(entry.status, remainingAmount, latestActiveMatch),
              label: 'Bank closeout',
              value: clearingState.isTerminal
                ? clearingState.closeoutLabel
                : paymentClearingBankMatchLabel(latestActiveMatch, remainingAmount, entry.currency),
            },
          ]}
        />
        <FinanceDetailGrid>
          <FinanceDetailInfoItem
            label="Payment record"
            value={
              <AdminTableSubstack>
                {entry.paymentId ? (
                  <AdminTextLink href={`/payments/${entry.paymentId}`}>
                    Payment {shortId(entry.paymentId)}
                  </AdminTextLink>
                ) : (
                  <AdminInlineFallback>No payment record</AdminInlineFallback>
                )}
                <AdminTextLink href={`/bookings/${entry.bookingId}`}>
                  Booking {shortId(entry.bookingId)}
                </AdminTextLink>
              </AdminTableSubstack>
            }
          />
          <FinanceDetailInfoItem
            label="Linked settlement"
            value={
              settlementRecordLinks.length > 0 ? (
                <AdminTableSubstack>
                  {settlementRecordLinks.map((link) => (
                    <AdminTextLink href={link.href} key={link.label}>
                      {link.label} <span className="muted">{link.value}</span>
                    </AdminTextLink>
                  ))}
                </AdminTableSubstack>
              ) : (
                'No settlement link'
              )
            }
          />
          <FinanceDetailInfoItem
            label="Bank match status"
            value={
              <>
                {clearingState.isTerminal ? (
                  clearingState.closeoutLabel
                ) : (
                  <>{activeMatchCount} active · {matches.length} history · <MoneyText amount={remainingAmount} currency={entry.currency} /> remaining</>
                )}
              </>
            }
          />
          <FinanceDetailInfoItem
            label="Latest bank match"
            value={
              <FinanceBankMatchEvidence
                matches={matches[0] ? [matches[0]] : []}
                showAmount={false}
                showJournalLink
                showPaymentClearingLink={false}
              />
            }
          />
        </FinanceDetailGrid>
      </FinanceTablePanel>

      <FinanceTablePanel
        grouped
        description="Bank matches are loaded from this detail endpoint only. Open the bank transaction detail for full reconciliation evidence."
        resultLabel={`${activeMatchCount} active · ${matches.length} history`}
        resultTone="info"
        title="Bank reconciliation matches"
      >
        <FinanceDataTable
            ariaLabel="Bank reconciliation matches for this payment clearing"
            emptyMessage="No bank reconciliation matches are linked to this clearing row."
            headers={['Bank transaction', 'Journal entry', 'Counterparty', 'Amount', 'Matched', 'Status']}
            rowCount={matches.length}
          >
            {matches.map((match) => (
              <tr key={match.id}>
                <td>
                  {match.bankTransactionId ? (
                    <AdminTextLink href={bankReconciliationDetailHref(match.bankTransactionId, detailHref)}>
                      {match.bankTransaction?.transferRef ?? shortId(match.bankTransactionId)}
                    </AdminTextLink>
                  ) : (
                    <AdminInlineFallback>No bank transaction</AdminInlineFallback>
                  )}
                  {match.bankTransaction?.type ? (
                    <div className="muted">{match.bankTransaction.type}</div>
                  ) : (
                    <AdminInlineFallback className="admin-mt-6">No bank type</AdminInlineFallback>
                  )}
                </td>
                <td>
                  {match.accountingJournalEntry ? (
                    <>
                      <AdminTextLink href={generalLedgerDetailHref(match.accountingJournalEntry.batchId)}>
                        {match.accountingJournalEntry.accountCode}
                      </AdminTextLink>
                      <div className="muted">{match.accountingJournalEntry.accountName}</div>
                    </>
                  ) : (
                    <AdminInlineFallback>No journal entry</AdminInlineFallback>
                  )}
                </td>
                <td>
                  {match.bankTransaction?.counterpartyName ? (
                    match.bankTransaction.counterpartyName
                  ) : (
                    <AdminInlineFallback>No counterparty</AdminInlineFallback>
                  )}
                </td>
                <td>
                  <strong>
                    <MoneyText amount={match.amount} currency={match.currency} />
                  </strong>
                  {match.bankTransaction ? (
                    <div className="muted">
                      Bank{' '}
                      <MoneyText
                        amount={match.bankTransaction.amount}
                        currency={match.bankTransaction.currency}
                      />
                    </div>
                  ) : null}
                </td>
                <td>
                  <DateTimeText value={match.matchedAt} />
                </td>
                <td>
                  <StatusBadgeFromPillClass pillClass={financeBankReconciliationStatusPill(match.status)}>
                    {match.status}
                  </StatusBadgeFromPillClass>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function paymentClearingSettlementLabel(entry: AdminBookingPaymentClearingEntryDetail, settlementRecordLinkCount: number) {
  if (entry.settlementSnapshot) {
    return `Settlement ${shortId(entry.settlementSnapshot.id)}`;
  }
  if (entry.settlementReversalEntry) {
    return `Reversal ${shortId(entry.settlementReversalEntry.id)}`;
  }
  if (settlementRecordLinkCount > 0) {
    return `${settlementRecordLinkCount} linked record(s)`;
  }
  return 'No settlement link';
}

function paymentClearingBankMatchLabel(
  match: NonNullable<AdminBookingPaymentClearingEntryDetail['bankReconciliationMatches']>[number] | null,
  remainingAmount: number,
  currency: string,
) {
  if (match?.bankTransaction) {
    return match.bankTransaction.transferRef ?? `Bank ${shortId(match.bankTransaction.id)}`;
  }
  if (remainingAmount <= 0) {
    return 'Fully matched';
  }
  return <MoneyText amount={remainingAmount} currency={currency} />;
}

function paymentClearingNextAction(
  status: string,
  remainingAmount: number,
  match: NonNullable<AdminBookingPaymentClearingEntryDetail['bankReconciliationMatches']>[number] | null,
) {
  if (status === 'REVERSED') {
    return 'No new match · reversed evidence retained';
  }
  if (remainingAmount <= 0 || status === 'CLEARED') {
    return 'Ready for closeout';
  }
  if (match?.status === 'PARTIALLY_MATCHED') {
    return 'Match remaining amount';
  }
  return 'Match bank transaction';
}

function formatDateGap(left: string | Date, right: string | Date) {
  const milliseconds = Math.abs(new Date(left).getTime() - new Date(right).getTime());
  const hours = Math.round(milliseconds / 3_600_000);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function paymentFeePolicyInfo(
  settlement: AdminBookingPaymentClearingEntryDetail['settlementSnapshot'] | null | undefined,
  fallbackCurrency: string,
) {
  const ruleSnapshot = jsonRecord(settlement?.paymentFeeRuleSnapshot);
  const hasPolicySnapshot = Boolean(
    settlement?.paymentFeePolicyVersionId ||
      stringValue(ruleSnapshot?.policyName) ||
      stringValue(ruleSnapshot?.feeType),
  );
  return {
    fixedAmount: settlement?.paymentFeeFixedAmount ?? 0,
    method: stringValue(ruleSnapshot?.method) ?? settlement?.paymentMethod ?? '-',
    payer: settlement?.paymentFeePayer ?? '-',
    policyName: stringValue(ruleSnapshot?.policyName) ?? (hasPolicySnapshot ? '-' : 'Legacy/manual fee evidence'),
    policyVersionId: settlement?.paymentFeePolicyVersionId ?? (hasPolicySnapshot ? '-' : 'Policy record missing'),
    rateBps: settlement?.paymentFeeRateBps ?? 0,
    treatment: settlement?.paymentFeeTreatment ?? '-',
    currency: settlement?.currency ?? fallbackCurrency,
  };
}

function paymentFeeBasisLabel(
  paymentFee: ReturnType<typeof paymentFeePolicyInfo>,
  currency: string,
  recordedFee: number,
) {
  if (recordedFee > 0 && paymentFee.rateBps === 0 && paymentFee.fixedAmount === 0) {
    return `${paymentFee.method} · legacy/manual fee evidence`;
  }
  return (
    <>
      {paymentFee.method} · {paymentFee.rateBps} bps +{' '}
      <MoneyText amount={paymentFee.fixedAmount} currency={currency} />
    </>
  );
}

function jsonRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bankCandidateReviewHref(bankTransactionId: string, returnTo: string, clearingEntryId: string) {
  const href = bankReconciliationDetailHref(bankTransactionId, returnTo);
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set('candidateQ', clearingEntryId);
  url.searchParams.set('candidatePage', '1');
  url.searchParams.set('candidateTake', '25');
  return `${url.pathname}${url.search}`;
}

async function assignPaymentClearingDetailReviewAction(formData: FormData) {
  'use server';

  const clearingEntryId = readFormString(formData, 'clearingEntryId');
  const confirmationClearingEntryId = readFormString(formData, 'confirmationClearingEntryId');
  const assigneeAdminId = readFormString(formData, 'assigneeAdminId');
  const reason = readFormString(formData, 'reason');
  const returnTo = safePaymentClearingDetailReturnTo(readFormString(formData, 'returnTo'));
  const detailHref = clearingEntryId ? paymentClearingDetailHref(clearingEntryId, returnTo) : returnTo;
  if (
    !clearingEntryId ||
    confirmationClearingEntryId !== clearingEntryId ||
    !assigneeAdminId ||
    reason.length < 12
  ) {
    redirect(appendDetailParam(detailHref, 'assignmentNotice', 'failed'));
  }

  try {
    await adminPostOrThrow(
      `/admin/booking-payment-clearing/${encodeURIComponent(clearingEntryId)}/review-assignment`,
      { assigneeAdminId, reason },
    );
  } catch {
    redirect(appendDetailParam(detailHref, 'assignmentNotice', 'failed'));
  }

  redirect(appendDetailParam(detailHref, 'assignmentNotice', 'assigned'));
}

function paymentClearingDetailErrorCopy(status: number | null, requestId?: string | null) {
  const supportReference = requestId ? ` Support reference: ${requestId}.` : '';
  if (status === 403) {
    return {
      message: `Your operator account cannot load this payment clearing evidence.${supportReference}`,
      title: 'Payment clearing access denied',
    };
  }
  return {
    message: `Retry before making a payment matching or closeout decision.${supportReference}`,
    title: 'Payment clearing evidence unavailable',
  };
}

function readFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function appendDetailParam(href: string, key: string, value: string) {
  const url = new URL(href, 'http://admin.local');
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function readParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
