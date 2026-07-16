import { BadgeCheck, Landmark, ShieldAlert, WalletCards } from 'lucide-react';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from '../../../components/status-badge';
import type {
  AdminFinanceApprovalQueue,
  AdminPartnerBankDepositRequestHistory,
  AdminUser,
} from '../../../lib/admin-api';
import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import { formatMoney } from '../../../lib/admin-format';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinanceTablePanel } from '../finance-table-panel';
import { TaxFinanceWorkflowActions } from '../tax-finance-workflow-actions';
import {
  approvePartnerBankDepositRequest,
  approveWalletAdjustmentRequest,
  assignPartnerBankDepositReconciliationReview,
  rejectPartnerBankDepositRequest,
  rejectWalletAdjustmentRequest,
} from './actions';
import {
  buildTaxFinanceWorkflowLinks,
  readBookingSettlementFilters,
  readFinanceAccountingFilters,
  readMonthlyTaxClosingFilters,
  readPartnerWithholdingTaxFilters,
} from '../tax-settlement-page-model';
import { buildBankReconciliationReviewOwnerOptions } from '../bank-reconciliation/bank-reconciliation-review-owner-model';

type FinanceApprovalQueuePageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type FinanceApprovalConfirmationAction =
  | 'approve-deposit'
  | 'approve-wallet'
  | 'reject-deposit'
  | 'reject-wallet';

const EMPTY_QUEUE: AdminFinanceApprovalQueue = {
  generatedAt: '',
  limit: 10,
  summary: {
    paymentFeePolicyPendingCount: 0,
    withdrawalOpenCount: 0,
    withdrawalRequestedCount: 0,
    withdrawalReviewRequiredCount: 0,
    withdrawalBankTransferPendingCount: 0,
    withdrawalOpenAmount: 0,
    withdrawalCurrency: 'VND',
    walletAdjustmentLast7dCount: 0,
    walletAdjustmentPendingCount: 0,
    partnerBankDepositPendingCount: 0,
    partnerBankDepositLast7dCount: 0,
  },
  paymentFeePolicyRequests: [],
  withdrawalRequests: [],
  walletAdjustmentRequests: [],
  partnerBankDepositRequests: [],
  walletAdjustmentEvidence: {
    last7dCount: 0,
    pendingQueueSupported: false,
  },
};

const EMPTY_DEPOSIT_RECONCILIATION_QUEUE: AdminPartnerBankDepositRequestHistory = {
  items: [],
  pagination: { skip: 0, take: 10, total: 0 },
  statusCounts: {},
  reconciliationSummary: { openAmount: 0, openCount: 0, period: null },
};

export default async function FinanceApprovalQueuePage({ searchParams }: FinanceApprovalQueuePageProps) {
  const params = searchParams ? await searchParams : {};
  const take = queueLimit(readSearchParam(params.take));
  const approvalNotice = approvalQueueNotice(readSearchParam(params.approvalNotice));
  const assignmentNotice = depositReconciliationAssignmentNotice(readSearchParam(params.assignmentNotice));
  const requestedConfirmationAction = financeApprovalConfirmationAction(readSearchParam(params.confirm));
  const requestedReconciliationAssignment =
    readSearchParam(params.confirm) === 'assign-deposit-reconciliation';
  const requestedConfirmationId = readSearchParam(params.requestId);
  const [queue, depositReconciliationResponse, currentOperatorAccess, adminUsers] = await Promise.all([
    adminGet<AdminFinanceApprovalQueue>(
      `/admin/finance-approval-queue?${new URLSearchParams({ take: String(take) }).toString()}`,
      { ...EMPTY_QUEUE, limit: take },
    ),
    adminGet<AdminPartnerBankDepositRequestHistory>(
      `/admin/provider-wallet/deposit-requests/history?${new URLSearchParams({
        status: 'EXECUTED',
        review: 'needs-reconciliation',
        skip: '0',
        take: String(take),
      }).toString()}`,
      { ...EMPTY_DEPOSIT_RECONCILIATION_QUEUE, pagination: { skip: 0, take, total: 0 } },
    ),
    requestedReconciliationAssignment ? getCurrentAdminOperatorAccess() : Promise.resolve(null),
    requestedReconciliationAssignment
      ? adminGet<AdminUser[]>('/admin/users?take=50&role=ADMIN&view=finance-approver-directory', [])
      : Promise.resolve([]),
  ]);
  const depositReconciliationQueue = isPartnerBankDepositReconciliationQueue(depositReconciliationResponse)
    ? depositReconciliationResponse
    : { ...EMPTY_DEPOSIT_RECONCILIATION_QUEUE, pagination: { skip: 0, take, total: 0 } };
  const settlementFilters = readBookingSettlementFilters(params);
  const accountingFilters = readFinanceAccountingFilters(params, 'all');
  const monthlyFilters = readMonthlyTaxClosingFilters(params);
  const withholdingFilters = readPartnerWithholdingTaxFilters(params);
  const currentQueueHref = financeApprovalQueueHref(take);
  const confirmation = buildFinanceApprovalConfirmation(
    queue,
    requestedConfirmationAction,
    requestedConfirmationId,
    currentQueueHref,
  );
  const reconciliationAssignmentConfirmation = buildDepositReconciliationAssignmentConfirmation(
    depositReconciliationQueue,
    requestedReconciliationAssignment,
    requestedConfirmationId,
    currentQueueHref,
    adminUsers,
    currentOperatorAccess?.id ?? null,
  );
  const notice = approvalNotice ?? assignmentNotice;

  return (
    <AdminPageTemplate
      actions={
        <TaxFinanceWorkflowActions
          links={buildTaxFinanceWorkflowLinks({
            accountingFilters,
            current: 'approval-queue',
            monthlyFilters,
            settlementFilters,
            withholdingFilters,
          })}
        />
      }
      description="Review current finance approvals and hand each item to its source workflow without mixing completed records into the pending queue."
      title="Finance Approval Queue"
    >
      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role="status" tone={notice.tone}>
          <div>
            <h2>{notice.title}</h2>
            <p className="muted">{notice.detail}</p>
          </div>
          <StatusBadge tone={notice.tone}>{notice.badge}</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {reconciliationAssignmentConfirmation ? (
        <ConfirmDialog {...reconciliationAssignmentConfirmation} />
      ) : confirmation ? (
        <ConfirmDialog
          action={confirmation.action}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={confirmation.description}
          hiddenInputs={confirmation.hiddenInputs}
          id={`finance-approval-${confirmation.actionName}-${confirmation.requestId}`}
          supportingLinks={confirmation.supportingLinks}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : requestedConfirmationAction || requestedReconciliationAssignment ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <div>
            <h2>Finance request is no longer available</h2>
            <p className="muted">Refresh the pending queue before making a decision. No wallet, bank, cash, tax, or ledger entry was changed.</p>
          </div>
          <StatusBadge tone="danger">Blocked</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      <FinanceListCommandBoard ariaLabel="Finance approval command board">
        <FinanceListCommandCard
          detail={`${queue.summary.paymentFeePolicyPendingCount} draft policy review(s) currently need a separate finance approver.`}
          href="/finance-tax/payment-fees"
          icon={BadgeCheck}
          label="Policy reviews"
          scope="Pending"
          tone={queue.summary.paymentFeePolicyPendingCount > 0 ? 'warning' : 'success'}
          value={String(queue.summary.paymentFeePolicyPendingCount)}
        />
        <FinanceListCommandCard
          detail={`${queue.summary.withdrawalRequestedCount} new / ${queue.summary.withdrawalReviewRequiredCount} review required.`}
          href="/payouts?range=all&withdrawalStatus=REQUESTED"
          icon={ShieldAlert}
          label="Open withdrawals"
          scope="Needs action"
          tone={queue.summary.withdrawalOpenCount > 0 ? 'warning' : 'success'}
          value={String(queue.summary.withdrawalOpenCount)}
        />
        <FinanceListCommandCard
          detail="Approved Partner withdrawals waiting for manual bank transfer evidence."
          href="/payouts?range=all&withdrawalStatus=BANK_TRANSFER_PENDING"
          icon={Landmark}
          label="Bank transfer pending"
          scope="Bank action"
          tone={queue.summary.withdrawalBankTransferPendingCount > 0 ? 'danger' : 'success'}
          value={String(queue.summary.withdrawalBankTransferPendingCount)}
        />
        <FinanceListCommandCard
          detail="Persisted requests waiting for a separate finance approver."
          href="/finance-tax/approval-queue#wallet-adjustment-requests"
          icon={WalletCards}
          label="Wallet approvals"
          scope="Needs approval"
          tone={queue.summary.walletAdjustmentPendingCount > 0 ? 'warning' : 'success'}
          value={String(queue.summary.walletAdjustmentPendingCount)}
        />
        <FinanceListCommandCard
          detail="Bank evidence requests waiting for a separate finance approver before wallet and GL execution."
          href="/finance-tax/approval-queue#partner-bank-deposit-requests"
          icon={Landmark}
          label="Deposit approvals"
          scope="Needs approval"
          tone={queue.summary.partnerBankDepositPendingCount > 0 ? 'warning' : 'success'}
          value={String(queue.summary.partnerBankDepositPendingCount)}
        />
        <FinanceListCommandCard
          detail="Executed Partner deposits whose GL bank debit is not fully matched to imported bank evidence."
          href="/finance-tax/partner-bank-deposits?status=EXECUTED&review=needs-reconciliation"
          icon={Landmark}
          label="Deposit reconciliation"
          scope="Post-approval"
          tone={depositReconciliationQueue.reconciliationSummary.openCount > 0 ? 'danger' : 'success'}
          value={String(depositReconciliationQueue.reconciliationSummary.openCount)}
        />
      </FinanceListCommandBoard>

      <AdminFilterPanel
        className="admin-mb-16"
        description="The API returns a bounded slice while the KPI counts remain exact for the active queue."
        resultLabel={`Up to ${queue.limit} rows per queue`}
        resultTone="info"
        title="Queue display"
      >
        <AdminFormGrid method="get">
          <AdminFormSelect
            defaultValue={String(take)}
            label="Rows per queue"
            labelVisibility="visible"
            name="take"
            options={[
              { label: '10 rows', value: '10' },
              { label: '25 rows', value: '25' },
            ]}
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Apply
          </AdminFormControlButton>
        </AdminFormGrid>
      </AdminFilterPanel>

      <FinanceTablePanel
        grouped
        description="Only the latest request event for a draft policy appears. Rejected, cancelled, stale, and activated policies are excluded."
        resultLabel={`${queue.summary.paymentFeePolicyPendingCount} pending`}
        resultTone={queue.summary.paymentFeePolicyPendingCount > 0 ? 'warning' : 'success'}
        title="Payment fee policy reviews"
      >
        <FinanceDataTable
          emptyMessage="No payment fee policy review is pending."
          headers={['Policy', 'Requested by', 'Requested', 'Effective from', 'Reason', 'Action']}
          rowCount={queue.paymentFeePolicyRequests.length}
        >
          {queue.paymentFeePolicyRequests.map((request) => (
            <tr key={request.requestId}>
              <td>
                <strong>{request.policyName}</strong>
                <div className="muted">{request.policyId}</div>
              </td>
              <td>
                <strong>{request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id}</strong>
                {request.requestedBy.email ? <div className="muted">{request.requestedBy.email}</div> : null}
              </td>
              <td><DateTimeText value={request.requestedAt} /></td>
              <td><DateTimeText value={request.effectiveFrom} /></td>
              <td>{request.reason ?? 'No review reason recorded'}</td>
              <td>
                <StatusBadgeLink
                  href={`/finance-tax/payment-fees?${new URLSearchParams({ policyId: request.policyId }).toString()}`}
                  tone="warning"
                >
                  Review policy
                </StatusBadgeLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        description="These deposits are already executed. They need bank evidence matching, not another approval or another wallet/GL posting."
        grouped
        id="partner-bank-deposit-reconciliation"
        resultLabel={`${depositReconciliationQueue.reconciliationSummary.openCount} open`}
        resultTone={depositReconciliationQueue.reconciliationSummary.openCount > 0 ? 'danger' : 'success'}
        title="Partner bank deposit reconciliation queue"
      >
        <FinanceDataTable
          emptyMessage="Every executed Partner bank deposit is fully reconciled to imported bank evidence."
          headers={['Partner', 'Transfer reference', 'Remaining', 'SLA', 'Review owner', 'Executed', 'Action']}
          rowCount={depositReconciliationQueue.items.length}
        >
          {depositReconciliationQueue.items.map((request) => {
            const partnerName =
              request.providerProfile?.displayName ??
              request.providerProfile?.user?.fullName ??
              request.providerProfileId;
            const matchedAmount = request.reconciliationMatchedAmount ?? 0;
            const remainingAmount = request.reconciliationRemainingAmount ?? request.amount;
            return (
              <tr key={request.id}>
                <td><strong>{partnerName}</strong><div className="muted">{request.providerProfileId}</div></td>
                <td><strong>{request.bankTransactionId}</strong></td>
                <td>
                  <strong><MoneyText amount={remainingAmount} currency={request.currency} /></strong>
                  <div className="muted">
                    {formatMoney(matchedAmount, request.currency)} of {formatMoney(request.amount, request.currency)} matched
                  </div>
                </td>
                <td>
                  <StatusBadge tone={depositReconciliationSlaTone(request.reconciliationSlaStatus)}>
                    {depositReconciliationSlaLabel(
                      request.reconciliationSlaStatus,
                      request.reconciliationWaitingHours,
                    )}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{depositReconciliationOwnerLabel(request.reconciliationReviewAssignment?.assignee)}</strong>
                  {request.reconciliationReviewAssignment ? (
                    <div className="muted"><DateTimeText value={request.reconciliationReviewAssignment.assignedAt} /></div>
                  ) : null}
                </td>
                <td><DateTimeText value={request.executedAt ?? request.createdAt} /></td>
                <td>
                  <AdminFormControlLink
                    className="button-primary admin-mb-8"
                    href={`/finance-tax/partner-bank-deposits/${encodeURIComponent(request.id)}`}
                  >
                    Open evidence
                  </AdminFormControlLink>
                  <AdminFormControlLink
                    className="button-secondary"
                    href={`/finance-tax/bank-reconciliation?${new URLSearchParams({
                      range: 'all',
                      review: 'unmatched',
                      q: request.bankTransactionId,
                    }).toString()}`}
                  >
                    Find bank transaction
                  </AdminFormControlLink>
                  <AdminFormControlLink
                    className="button-secondary admin-mt-8"
                    href={depositReconciliationAssignmentHref(take, request.id)}
                  >
                    {request.reconciliationReviewAssignment ? 'Reassign owner' : 'Assign owner'}
                  </AdminFormControlLink>
                </td>
              </tr>
            );
          })}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        description="The maker records bank evidence and the requested balance allocation. A different finance approver executes the deposit atomically into the Partner wallet, balanced GL, and audit trail."
        grouped
        id="partner-bank-deposit-requests"
        resultLabel={`${queue.summary.partnerBankDepositPendingCount} pending`}
        resultTone={queue.summary.partnerBankDepositPendingCount > 0 ? 'warning' : 'success'}
        title="Partner bank deposit approval queue"
      >
        <FinanceDataTable
          emptyMessage="No Partner bank deposit request is waiting for approval."
          headers={['Partner', 'Bank evidence', 'Amount', 'Allocation preview', 'Requested by', 'Decision']}
          rowCount={queue.partnerBankDepositRequests.length}
        >
          {queue.partnerBankDepositRequests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{request.partnerName}</strong>
                <div className="muted">{request.providerProfileId}</div>
              </td>
              <td>
                <strong>{request.bankTransactionId}</strong>
                <div className="muted"><DateTimeText value={request.depositDate} /></div>
                {request.bankAccount ? <div className="muted">{request.bankAccount}</div> : null}
                <StatusBadge tone={request.attachmentFileId || request.attachmentUrl ? 'success' : 'danger'}>
                  {request.attachmentFileId || request.attachmentUrl ? 'Evidence attached' : 'Evidence missing'}
                </StatusBadge>
              </td>
              <td>
                <strong><MoneyText amount={request.amount} currency={request.currency} /></strong>
                <div className="muted"><DateTimeText value={request.createdAt} /></div>
              </td>
              <td>
                <div>Receivable recovery <MoneyText amount={request.requestedReceivableRecovery} currency={request.currency} /></div>
                <div>Wallet liability <MoneyText amount={request.requestedWalletLiabilityIncrease} currency={request.currency} /></div>
                <div className="muted">
                  Balance <MoneyText amount={request.requestedBeforeBalance} currency={request.currency} />
                  {' → '}
                  <MoneyText amount={request.requestedAfterBalance} currency={request.currency} />
                </div>
              </td>
              <td>
                <strong>{request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id}</strong>
                {request.requestedBy.email ? <div className="muted">{request.requestedBy.email}</div> : null}
                {request.notes ? <div className="muted">{request.notes}</div> : null}
              </td>
              <td>
                <AdminFormControlLink
                  className="button-secondary admin-mb-8"
                  href={`/finance-tax/partner-bank-deposits/${request.id}`}
                >
                  Open evidence
                </AdminFormControlLink>
                <AdminFormControlLink
                  className="button-primary admin-mb-8"
                  href={financeApprovalConfirmHref(take, 'approve-deposit', request.id)}
                >
                  Approve & execute
                </AdminFormControlLink>
                <AdminFormControlLink
                  className="button-danger"
                  href={financeApprovalConfirmHref(take, 'reject-deposit', request.id)}
                >
                  Reject
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description={`Open withdrawal exposure is ${formatMoney(queue.summary.withdrawalOpenAmount, queue.summary.withdrawalCurrency)}. Each row opens the filtered payout workflow.`}
        resultLabel={`${queue.summary.withdrawalOpenCount} open`}
        resultTone={queue.summary.withdrawalOpenCount > 0 ? 'warning' : 'success'}
        title="Partner withdrawal work queue"
      >
        <FinanceDataTable
          emptyMessage="No Partner withdrawal requires finance action."
          headers={['Partner', 'Status', 'Amount', 'Bank account', 'Requested', 'Action']}
          rowCount={queue.withdrawalRequests.length}
        >
          {queue.withdrawalRequests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{request.partnerName}</strong>
                <div className="muted">{request.providerProfileId}</div>
              </td>
              <td><StatusBadge tone={withdrawalTone(request.status)}>{humanizeStatus(request.status)}</StatusBadge></td>
              <td><strong><MoneyText amount={request.amount} currency={request.currency} /></strong></td>
              <td>
                <StatusBadge tone={request.hasBankAccount ? 'success' : 'danger'}>
                  {request.hasBankAccount ? 'Recorded' : 'Missing'}
                </StatusBadge>
              </td>
              <td><DateTimeText value={request.createdAt} /></td>
              <td>
                <StatusBadgeLink
                  href={`/payouts?${new URLSearchParams({ range: 'all', withdrawalStatus: request.status }).toString()}`}
                  tone="info"
                >
                  Open payout queue
                </StatusBadgeLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        description="Each request preserves the maker's accounting preview. Approval recalculates the live balance and refuses stale requests before writing wallet or GL entries."
        grouped
        id="wallet-adjustment-requests"
        resultLabel={`${queue.summary.walletAdjustmentPendingCount} pending`}
        resultTone={queue.summary.walletAdjustmentPendingCount > 0 ? 'warning' : 'success'}
        title="Wallet adjustment approval queue"
      >
        <FinanceDataTable
          emptyMessage="No manual wallet adjustment request is waiting for approval."
          headers={['Owner', 'Request', 'Amount', 'Balance preview', 'Requested by', 'Evidence', 'Decision']}
          rowCount={queue.walletAdjustmentRequests.length}
        >
          {queue.walletAdjustmentRequests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{request.ownerName ?? request.ownerId}</strong>
                <div className="muted">{request.ownerType} · {request.ownerId}</div>
              </td>
              <td>
                <strong>{humanizeStatus(request.adjustmentType)}</strong>
                <div className="muted">{humanizeStatus(request.direction)} · {request.reason}</div>
                <div className="muted"><DateTimeText value={request.createdAt} /></div>
              </td>
              <td><strong><MoneyText amount={request.amount} currency={request.currency} /></strong></td>
              <td>
                <MoneyText amount={request.requestedBeforeBalance} currency={request.currency} />
                {' → '}
                <strong><MoneyText amount={request.requestedAfterBalance} currency={request.currency} /></strong>
              </td>
              <td>
                <strong>{request.requestedBy?.fullName ?? request.requestedBy?.email ?? request.requestedByAdminId}</strong>
                {request.requestedBy?.email ? <div className="muted">{request.requestedBy.email}</div> : null}
              </td>
              <td>
                <StatusBadge tone={request.requiresAttachment ? (request.attachmentUrl ? 'success' : 'danger') : 'neutral'}>
                  {request.requiresAttachment ? (request.attachmentUrl ? 'Attached' : 'Missing') : 'Optional'}
                </StatusBadge>
                {request.monthlyPeriod ? <div className="muted">Period {request.monthlyPeriod}</div> : null}
              </td>
              <td>
                <AdminFormControlLink
                  className="button-primary admin-mb-8"
                  href={financeApprovalConfirmHref(take, 'approve-wallet', request.id)}
                >
                  Approve & execute
                </AdminFormControlLink>
                <AdminFormControlLink
                  className="button-danger"
                  href={financeApprovalConfirmHref(take, 'reject-wallet', request.id)}
                >
                  Reject
                </AdminFormControlLink>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <AdminSection
        actions={<AdminFormControlLink className="button-secondary" href="/wallet-adjustments?view=records">Open wallet records</AdminFormControlLink>}
        className="admin-mt-16"
        description="Executed requests remain available as immutable wallet, GL, approval, and audit evidence."
        statusLabel={`${queue.walletAdjustmentEvidence.last7dCount} completed in 7 days`}
        statusTone="neutral"
        title="Wallet adjustment records"
      >
        <p className="muted">
          Use Wallet Adjustments to inspect request ID, approving admin, before and after balance, accounting impact, attachment, and reversal evidence. Completed records stay outside the pending queue.
        </p>
      </AdminSection>
    </AdminPageTemplate>
  );
}

function queueLimit(value: string) {
  return value === '25' ? 25 : 10;
}

function financeApprovalConfirmationAction(value: string): FinanceApprovalConfirmationAction | null {
  return value === 'approve-deposit' ||
    value === 'reject-deposit' ||
    value === 'approve-wallet' ||
    value === 'reject-wallet'
    ? value
    : null;
}

function financeApprovalQueueHref(take: number) {
  return take === 25 ? '/finance-tax/approval-queue?take=25' : '/finance-tax/approval-queue';
}

function financeApprovalConfirmHref(
  take: number,
  action: FinanceApprovalConfirmationAction,
  requestId: string,
) {
  const search = new URLSearchParams({ confirm: action, requestId });
  if (take === 25) search.set('take', '25');
  return `/finance-tax/approval-queue?${search.toString()}`;
}

function depositReconciliationAssignmentHref(take: number, requestId: string) {
  const search = new URLSearchParams({ confirm: 'assign-deposit-reconciliation', requestId });
  if (take === 25) search.set('take', '25');
  return `/finance-tax/approval-queue?${search.toString()}`;
}

function buildDepositReconciliationAssignmentConfirmation(
  queue: AdminPartnerBankDepositRequestHistory,
  requested: boolean,
  requestId: string,
  cancelHref: string,
  adminUsers: readonly AdminUser[],
  currentOperatorId: string | null,
) {
  if (!requested || !requestId) return null;
  const request = queue.items.find((item) => item.id === requestId);
  if (!request) return null;
  const options = buildBankReconciliationReviewOwnerOptions(
    adminUsers,
    request.reconciliationReviewAssignment?.assigneeAdminId ?? null,
    currentOperatorId,
  );
  if (options.length === 0) return null;

  return {
    action: assignPartnerBankDepositReconciliationReview,
    cancelHref,
    confirmLabel: request.reconciliationReviewAssignment ? 'Reassign owner' : 'Assign owner',
    description: request.reconciliationReviewAssignment
      ? 'Transfer this open deposit reconciliation to another eligible Finance operator. Existing ownership and SLA evidence remains in the audit history.'
      : 'Assign the unmatched Partner deposit to an eligible Finance operator without changing bank, wallet, cash, tax, or ledger balances.',
    hiddenInputs: [
      { name: 'confirmationRequestId', value: request.id },
      { name: 'redirectTo', value: cancelHref },
      { name: 'requestId', value: request.id },
    ],
    id: `partner-deposit-reconciliation-owner-${request.id}`,
    selectInputs: [{
      defaultValue: options[0]?.value,
      label: 'Review owner',
      name: 'assigneeAdminId',
      options,
      required: true,
    }],
    supportingLinks: [{
      href: `/finance-tax/partner-bank-deposits/${encodeURIComponent(request.id)}`,
      label: 'Open evidence',
    }],
    textInputs: [{
      label: 'Assignment reason',
      maxLength: 500,
      minLength: 12,
      name: 'reason',
      placeholder: 'Explain why this operator should own the reconciliation review.',
      required: true,
    }],
    title: request.reconciliationReviewAssignment
      ? 'Reassign Partner deposit reconciliation?'
      : 'Assign Partner deposit reconciliation?',
    tone: 'warning' as const,
  };
}

function buildFinanceApprovalConfirmation(
  queue: AdminFinanceApprovalQueue,
  action: FinanceApprovalConfirmationAction | null,
  requestId: string,
  cancelHref: string,
) {
  if (!action || !requestId) return null;
  const isDeposit = action.endsWith('deposit');
  const isApprove = action.startsWith('approve');
  const request = isDeposit
    ? queue.partnerBankDepositRequests.find((item) => item.id === requestId)
    : queue.walletAdjustmentRequests.find((item) => item.id === requestId);
  if (!request) return null;

  const hiddenInputs = [
    { name: 'confirmationRequestId', value: requestId },
    { name: 'redirectTo', value: cancelHref },
    { name: 'requestId', value: requestId },
  ];
  const textInputs = isApprove
    ? []
    : [{
        label: 'Rejection reason',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: 'Explain why this finance request must be rejected.',
        required: true,
      }];

  if (isDeposit) {
    const deposit = request as AdminFinanceApprovalQueue['partnerBankDepositRequests'][number];
    return {
      action: isApprove ? approvePartnerBankDepositRequest : rejectPartnerBankDepositRequest,
      actionName: action,
      cancelHref,
      confirmLabel: isApprove ? 'Approve & execute' : 'Reject request',
      description: isApprove
        ? `${deposit.partnerName}: approve ${formatMoney(deposit.amount, deposit.currency)} of retained bank evidence. Execution allocates ${formatMoney(deposit.requestedReceivableRecovery, deposit.currency)} to receivable recovery and ${formatMoney(deposit.requestedWalletLiabilityIncrease, deposit.currency)} to wallet liability with balanced GL and audit entries.`
        : `${deposit.partnerName}: reject ${formatMoney(deposit.amount, deposit.currency)} of bank evidence without changing bank, wallet, cash, tax, or ledger balances.`,
      hiddenInputs,
      requestId,
      supportingLinks: [{
        href: `/finance-tax/partner-bank-deposits/${encodeURIComponent(deposit.id)}`,
        label: 'Open evidence',
      }],
      textInputs,
      title: isApprove ? 'Approve and execute Partner bank deposit?' : 'Reject Partner bank deposit request?',
      tone: isApprove ? 'warning' as const : 'danger' as const,
    };
  }

  const adjustment = request as AdminFinanceApprovalQueue['walletAdjustmentRequests'][number];
  return {
    action: isApprove ? approveWalletAdjustmentRequest : rejectWalletAdjustmentRequest,
    actionName: action,
    cancelHref,
    confirmLabel: isApprove ? 'Approve & execute' : 'Reject request',
    description: isApprove
      ? `${adjustment.ownerName ?? adjustment.ownerId}: approve ${formatMoney(adjustment.amount, adjustment.currency)} ${humanizeStatus(adjustment.direction).toLowerCase()}. The live balance is revalidated before wallet and balanced GL entries move it from ${formatMoney(adjustment.requestedBeforeBalance, adjustment.currency)} to ${formatMoney(adjustment.requestedAfterBalance, adjustment.currency)}.`
      : `${adjustment.ownerName ?? adjustment.ownerId}: reject this ${formatMoney(adjustment.amount, adjustment.currency)} wallet request without changing wallet, bank, cash, tax, or ledger balances.`,
    hiddenInputs,
    requestId,
    supportingLinks: [{ href: '/wallet-adjustments?view=records', label: 'Open wallet records' }],
    textInputs,
    title: isApprove ? 'Approve and execute wallet adjustment?' : 'Reject wallet adjustment request?',
    tone: isApprove ? 'warning' as const : 'danger' as const,
  };
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function isPartnerBankDepositReconciliationQueue(
  value: unknown,
): value is AdminPartnerBankDepositRequestHistory {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdminPartnerBankDepositRequestHistory>;
  return Array.isArray(candidate.items) && Boolean(candidate.reconciliationSummary);
}

function humanizeStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function withdrawalTone(status: string): StatusBadgeTone {
  if (status === 'BANK_TRANSFER_PENDING' || status === 'REQUESTED') return 'warning';
  if (status === 'REVIEW_REQUIRED' || status === 'NEEDS_BANK_CORRECTION' || status === 'HOLD') return 'danger';
  return 'info';
}

function depositReconciliationOwnerLabel(owner?: { id: string; email?: string | null; fullName?: string | null }) {
  return owner?.fullName ?? owner?.email ?? owner?.id ?? 'Unassigned';
}

function depositReconciliationSlaTone(
  status: AdminPartnerBankDepositRequestHistory['items'][number]['reconciliationSlaStatus'],
): StatusBadgeTone {
  if (status === 'ESCALATE') return 'danger';
  if (status === 'OVER_24H') return 'warning';
  if (status === 'RECONCILED') return 'success';
  return 'info';
}

function depositReconciliationSlaLabel(
  status: AdminPartnerBankDepositRequestHistory['items'][number]['reconciliationSlaStatus'],
  waitingHours?: number | null,
) {
  if (status === 'ESCALATE') return `Escalate · ${waitingHours ?? 48}h`;
  if (status === 'OVER_24H') return `Over 24h · ${waitingHours ?? 24}h`;
  if (status === 'RECONCILED') return 'Reconciled';
  if (status === 'NOT_APPLICABLE') return 'Not applicable';
  return `Within 24h · ${waitingHours ?? 0}h`;
}

function depositReconciliationAssignmentNotice(value: string) {
  if (value === 'assigned') {
    return {
      badge: 'Assigned',
      detail: 'The review owner was updated without changing bank, wallet, cash, tax, or ledger balances.',
      title: 'Deposit reconciliation owner updated',
      tone: 'success' as const,
    };
  }
  if (value === 'failed') {
    return {
      badge: 'Blocked',
      detail: 'The assignment was not changed. Check the operator permission, audit reason, and current reconciliation state.',
      title: 'Deposit reconciliation assignment failed',
      tone: 'danger' as const,
    };
  }
  return null;
}

function approvalQueueNotice(value: string) {
  if (value === 'approved') {
    return {
      badge: 'Executed',
      detail: 'The request was approved and its wallet ledger, balanced GL journal, and audit evidence were written atomically.',
      title: 'Finance request executed',
      tone: 'success' as const,
    };
  }
  if (value === 'rejected') {
    return {
      badge: 'Rejected',
      detail: 'The request was closed without changing the wallet, bank, cash, tax, or accounting ledgers.',
      title: 'Finance request rejected',
      tone: 'warning' as const,
    };
  }
  if (value === 'reason-required') {
    return {
      badge: 'Reason',
      detail: 'Enter a rejection reason before closing a finance request.',
      title: 'Rejection reason is required',
      tone: 'danger' as const,
    };
  }
  if (value === 'failed') {
    return {
      badge: 'Blocked',
      detail: 'No ledger was changed. The request may be stale, already decided, self-approved, or blocked by finance policy.',
      title: 'Finance decision was not applied',
      tone: 'danger' as const,
    };
  }
  return null;
}
