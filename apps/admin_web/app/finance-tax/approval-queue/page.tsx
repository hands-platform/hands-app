import { Building2, Landmark, RotateCcw, ShieldAlert, WalletCards } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormGrid,
  AdminFormSelect,
} from '../../../components/admin-form-controls';
import { AdminDetails } from '../../../components/admin-details';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminPageTemplate } from '../../../components/admin-page-template';
import { AdminSegmentedControl } from '../../../components/admin-segmented-control';
import { AdminNoticeCard, AdminSection } from '../../../components/admin-surface';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, StatusBadgeLink, type StatusBadgeTone } from '../../../components/status-badge';
import type {
  AdminFinanceApprovalQueue,
  AdminFinanceApprovalRequestPreflight,
  AdminBankReconciliationSummary,
} from '../../../lib/admin-api';
import { adminGetResult } from '../../../lib/admin-api';
import { formatMoney } from '../../../lib/admin-format';
import { FinanceDataTable } from '../finance-data-table';
import { FinanceListCommandBoard, FinanceListCommandCard } from '../finance-list-command-card';
import { FinanceTablePanel } from '../finance-table-panel';
import {
  approvePartnerBankDepositRequest,
  approvePayoutBatchPaidCloseout,
  approveRefundRequest,
  approveWithdrawalPaidCloseout,
  approveWalletAdjustmentRequest,
  cancelStaleWalletAdjustmentRequest,
  decideCompanyBankAccountRequest,
  rejectPartnerBankDepositRequest,
  rejectRefundRequest,
  rejectWalletAdjustmentRequest,
} from './actions';
import { FinanceApprovalSnapshotControl } from './finance-approval-snapshot-control';
import { refundApprovalFocusHref, safeRefundReturnTo } from '../../refunds/refund-focus-links';

type FinanceApprovalQueuePageProps = {
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
type FinanceApprovalConfirmationAction =
  | 'approve-bank-account'
  | 'approve-deposit'
  | 'approve-payout-paid'
  | 'approve-wallet'
  | 'approve-withdrawal-paid'
  | 'cancel-wallet'
  | 'reject-bank-account'
  | 'reject-deposit'
  | 'approve-refund'
  | 'reject-refund'
  | 'reject-wallet';
type FinanceApprovalQueueView =
  | 'bank-accounts'
  | 'deposits'
  | 'policies'
  | 'payouts'
  | 'priority'
  | 'refunds'
  | 'wallet'
  | 'withdrawals';
type FinanceApprovalWalletReview = 'all' | 'blocked' | 'ready' | 'stale';
type FinanceApprovalRefundReview = 'all' | 'blocked' | 'ready' | 'state-mismatch';
type FinanceApprovalPayoutReview = 'all' | 'blocked' | 'ready';
type FinanceApprovalPriorityItem = {
  readonly actionLabel: string;
  readonly controlLabel: string;
  readonly controlTone: StatusBadgeTone;
  readonly createdAt: string;
  readonly currency?: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly amount?: number;
  readonly ownerLabel: string;
  readonly riskLabel: string;
  readonly riskRank: number;
  readonly riskTone: StatusBadgeTone;
  readonly subject: string;
  readonly typeLabel: string;
  readonly typeTone: StatusBadgeTone;
  readonly unassigned: boolean;
};

const EMPTY_QUEUE: AdminFinanceApprovalQueue = {
  generatedAt: '',
  limit: 10,
  summary: {
    totalOpenCount: 0,
    readyCount: 0,
    blockedCount: 0,
    staleCount: 0,
    stateMismatchCount: 0,
    paymentFeePolicyPendingCount: 0,
    companyBankAccountPendingCount: 0,
    withdrawalOpenCount: 0,
    withdrawalRequestedCount: 0,
    withdrawalReviewRequiredCount: 0,
    withdrawalBankTransferPendingCount: 0,
    withdrawalOpenAmount: 0,
    withdrawalCurrency: 'VND',
    walletAdjustmentLast7dCount: 0,
    walletAdjustmentPendingCount: 0,
    walletAdjustmentReadyCount: 0,
    walletAdjustmentBlockedCount: 0,
    walletAdjustmentStaleCount: 0,
    partnerBankDepositPendingCount: 0,
    partnerBankDepositLast7dCount: 0,
    refundPendingCount: 0,
    refundReadyCount: 0,
    refundBlockedCount: 0,
    refundStateMismatchCount: 0,
    payoutBatchPendingCount: 0,
    payoutBatchReadyCount: 0,
    payoutBatchBlockedCount: 0,
    withdrawalPaidCloseoutPendingCount: 0,
    withdrawalPaidCloseoutReadyCount: 0,
    withdrawalPaidCloseoutBlockedCount: 0,
  },
  paymentFeePolicyRequests: [],
  companyBankAccountRequests: [],
  withdrawalRequests: [],
  walletAdjustmentRequests: [],
  partnerBankDepositRequests: [],
  refundRequests: [],
  payoutBatchRequests: [],
  walletAdjustmentEvidence: {
    last7dCount: 0,
    pendingQueueSupported: false,
  },
};

const EMPTY_BANK_RECONCILIATION_SUMMARY: AdminBankReconciliationSummary = {
  amount: 0,
  assignedCount: 0,
  count: 0,
  currency: 'VND',
  ignoredCount: 0,
  matchedAmount: 0,
  matchedCount: 0,
  openExposureAmount: 0,
  oldestPartiallyMatchedAt: null,
  oldestUnassignedAt: null,
  oldestUnmatchedAt: null,
  partiallyMatchedAmount: 0,
  partiallyMatchedCount: 0,
  reversedCount: 0,
  unassignedCount: 0,
  unassignedOver48hAmount: 0,
  unassignedOver48hCount: 0,
  unmatchedAmount: 0,
  unmatchedCount: 0,
};

export const metadata: Metadata = { title: 'Finance Approval Queue | HANDS Admin' };

export default async function FinanceApprovalQueuePage({ searchParams }: FinanceApprovalQueuePageProps) {
  const params = searchParams ? await searchParams : {};
  const take = queueLimit(readSearchParam(params.take));
  if (
    readSearchParam(params.view) === 'reconciliation' ||
    readSearchParam(params.confirm) === 'assign-deposit-reconciliation'
  ) {
    redirect(legacyApprovalReconciliationHref(params, take));
  }
  const approvalNotice = approvalQueueNotice(readSearchParam(params.approvalNotice));
  const requestedConfirmationAction = financeApprovalConfirmationAction(readSearchParam(params.confirm));
  const queueView = readFinanceApprovalQueueView(params, requestedConfirmationAction);
  const requestedConfirmationId = readSearchParam(params.requestId);
  const refundReturnTo = safeRefundReturnTo(readSearchParam(params.returnTo));
  const walletReview = queueView === 'wallet'
    ? normalizeFinanceApprovalWalletReview(readSearchParam(params.walletReview))
    : 'all';
  const review = queueView === 'refunds'
    ? normalizeFinanceApprovalRefundReview(readSearchParam(params.review))
    : queueView === 'payouts'
      ? normalizeFinanceApprovalPayoutReview(readSearchParam(params.review))
      : 'all';
  const page = queuePage(readSearchParam(params.page));
  const approvalQueueQuery = new URLSearchParams({ take: String(take) });
  approvalQueueQuery.set('view', queueView);
  if ((queueView === 'refunds' || queueView === 'payouts') && review !== 'all') {
    approvalQueueQuery.set('review', review);
  }
  if (queueView !== 'priority' && page > 1) approvalQueueQuery.set('page', String(page));
  if (queueView === 'refunds' && requestedConfirmationId) {
    approvalQueueQuery.set('requestId', requestedConfirmationId);
  }
  if (queueView === 'wallet' && walletReview !== 'all') {
    approvalQueueQuery.set('walletReview', walletReview);
  }
  const [queueResult, bankReconciliationResult] = await Promise.all([
    adminGetResult<AdminFinanceApprovalQueue>(
      `/admin/finance-approval-queue?${approvalQueueQuery.toString()}`,
      { ...EMPTY_QUEUE, limit: take },
    ),
    queueView === 'priority'
      ? adminGetResult<AdminBankReconciliationSummary>(
          '/admin/bank-reconciliation/summary?range=all&review=unmatched',
          EMPTY_BANK_RECONCILIATION_SUMMARY,
        )
      : Promise.resolve({ data: EMPTY_BANK_RECONCILIATION_SUMMARY, ok: true, status: 200 }),
  ]);
  const queueResponse = queueResult.data;
  const responseSummary = queueResponse.summary ?? EMPTY_QUEUE.summary;
  const legacyTotalOpenCount =
    (responseSummary.paymentFeePolicyPendingCount ?? 0) +
    (responseSummary.companyBankAccountPendingCount ?? 0) +
    (responseSummary.withdrawalOpenCount ?? 0) +
    (responseSummary.walletAdjustmentPendingCount ?? 0) +
    (responseSummary.partnerBankDepositPendingCount ?? 0) +
    (responseSummary.refundPendingCount ?? 0) +
    (responseSummary.payoutBatchPendingCount ?? 0);
  const queue: AdminFinanceApprovalQueue = {
    ...EMPTY_QUEUE,
    ...queueResponse,
    summary: {
      ...EMPTY_QUEUE.summary,
      ...responseSummary,
      totalOpenCount: responseSummary.totalOpenCount ?? legacyTotalOpenCount,
      refundReadyCount: responseSummary.refundReadyCount ?? 0,
      refundBlockedCount: responseSummary.refundBlockedCount ?? 0,
      refundStateMismatchCount: responseSummary.refundStateMismatchCount ?? 0,
    },
    paymentFeePolicyRequests: queueResponse.paymentFeePolicyRequests ?? [],
    companyBankAccountRequests: queueResponse.companyBankAccountRequests ?? [],
    withdrawalRequests: queueResponse.withdrawalRequests ?? [],
    walletAdjustmentRequests: queueResponse.walletAdjustmentRequests ?? [],
    partnerBankDepositRequests: queueResponse.partnerBankDepositRequests ?? [],
    refundRequests: (queueResponse.refundRequests ?? [])
      .filter((request) => !(requestedConfirmationId && queueResponse.refundFocus?.request?.id === request.id))
      .map((request) => ({
        ...request,
        blockers: request.blockers ?? [],
        canApprove: request.canApprove ?? request.reviewState === 'READY',
        canReject: request.canReject ?? request.reviewState !== 'STATE_MISMATCH',
      })),
    refundFocus: queueResponse.refundFocus
      ? {
          ...queueResponse.refundFocus,
          request: queueResponse.refundFocus.request
            ? {
                ...queueResponse.refundFocus.request,
                blockers: queueResponse.refundFocus.request.blockers ?? [],
                canApprove: queueResponse.refundFocus.request.canApprove ??
                  queueResponse.refundFocus.request.reviewState === 'READY',
                canReject: queueResponse.refundFocus.request.canReject ??
                  queueResponse.refundFocus.request.reviewState === 'READY',
              }
            : null,
        }
      : null,
    payoutBatchRequests: queueResponse.payoutBatchRequests ?? [],
    walletAdjustmentEvidence: {
      ...EMPTY_QUEUE.walletAdjustmentEvidence,
      ...queueResponse.walletAdjustmentEvidence,
    },
  };
  const bankReconciliationSummary = {
    ...EMPTY_BANK_RECONCILIATION_SUMMARY,
    ...bankReconciliationResult.data,
  };
  const currentQueueHref = financeApprovalQueueHref(take, queueView, { page, review, walletReview });
  const refundFocusHref = queueView === 'refunds' && requestedConfirmationId
    ? refundApprovalFocusHref(requestedConfirmationId, refundReturnTo)
    : currentQueueHref;
  const confirmationCancelHref = requestedConfirmationId
    ? queueView === 'refunds'
      ? refundFocusHref
      : `${currentQueueHref}#approval-${encodeURIComponent(requestedConfirmationId)}`
    : currentQueueHref;
  const confirmation = buildFinanceApprovalConfirmation(
    queue,
    requestedConfirmationAction,
    requestedConfirmationId,
    confirmationCancelHref,
  );
  const notice = approvalNotice;
  const priorityItems = buildFinanceApprovalPriorityItems(queue, take);
  const readyPriorityItems = priorityItems.filter((item) => financeApprovalPriorityWorkstream(item) === 'decision');
  const repairPriorityItems = priorityItems.filter((item) => financeApprovalPriorityWorkstream(item) === 'repair');
  const priorityCount = queue.summary.totalOpenCount;
  const focusedQueueCount = queue.pagination?.totalCount ?? financeApprovalFocusedQueueCount(queue, queueView);
  const focusedQueueClear = queueView !== 'priority' && focusedQueueCount === 0;
  const queuePagination = queue.pagination ?? {
    hasNext: false,
    hasPrevious: page > 1,
    page,
    review,
    totalCount: focusedQueueCount,
  };
  const otherApprovalCount =
    queue.summary.paymentFeePolicyPendingCount +
    queue.summary.companyBankAccountPendingCount +
    queue.summary.partnerBankDepositPendingCount;
  const bankMatchingCount =
    bankReconciliationSummary.unmatchedCount + bankReconciliationSummary.partiallyMatchedCount;

  return (
    <AdminPageTemplate
      actions={
        <AdminSegmentedControl
          activeValue={isOtherApprovalView(queueView) ? 'other' : queueView}
          ariaLabel="Finance approval workspaces"
          className="finance-approval-workspace-tabs"
          options={[
            { href: financeApprovalQueueHref(take, 'priority'), label: 'Priority', value: 'priority' },
            { href: financeApprovalQueueHref(take, 'refunds'), label: 'Refunds', value: 'refunds' },
            { href: financeApprovalQueueHref(take, 'payouts'), label: 'Payouts', value: 'payouts' },
            { href: financeApprovalQueueHref(take, 'withdrawals'), label: 'Withdrawals', value: 'withdrawals' },
            { href: financeApprovalQueueHref(take, 'wallet'), label: 'Wallet', value: 'wallet' },
            { href: financeApprovalQueueHref(take, 'policies'), label: 'Other approvals', value: 'other' },
          ]}
        />
      }
      description="Start with the oldest open finance work, then open one focused queue to review evidence and make a controlled decision."
      title="Finance Approval Queue"
    >
      <FinanceApprovalSnapshotControl generatedAt={queue.generatedAt} />

      {!queueResult.ok ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <div>
            <h2>{queueResult.status === 403 ? 'Finance approval access is restricted' : 'Finance approval data could not be loaded'}</h2>
            <p className="muted">
              {queueResult.status === 403
                ? 'This account does not currently have Finance approval access. No queue state or decision control is being shown.'
                : 'Refresh before making a finance decision. No empty or zero queue state is being claimed.'}
            </p>
          </div>
          <StatusBadge tone="danger">{queueResult.status === 403 ? 'Access restricted' : 'Unavailable'}</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {isOtherApprovalView(queueView) ? (
        <AdminSegmentedControl
          activeValue={queueView}
          ariaLabel="Other finance approvals"
          options={[
            { href: financeApprovalQueueHref(take, 'policies'), label: 'Fee policies', value: 'policies' },
            { href: financeApprovalQueueHref(take, 'bank-accounts'), label: 'Bank accounts', value: 'bank-accounts' },
            { href: financeApprovalQueueHref(take, 'deposits'), label: 'Deposits', value: 'deposits' },
          ]}
        />
      ) : null}

      {notice ? (
        <AdminNoticeCard className="admin-mb-16" role="status" tone={notice.tone}>
          <div>
            <h2>{notice.title}</h2>
            <p className="muted">{notice.detail}</p>
          </div>
          <StatusBadge tone={notice.tone}>{notice.badge}</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          action={confirmation.action}
          cancelHref={confirmation.cancelHref}
          confirmLabel={confirmation.confirmLabel}
          description={
            <FinanceApprovalEvidenceSnapshot
              description={confirmation.description}
              rows={confirmation.evidenceRows ?? []}
            />
          }
          hiddenInputs={confirmation.hiddenInputs}
          id={`finance-approval-${confirmation.actionName}-${confirmation.requestId}`}
          supportingLinks={confirmation.supportingLinks}
          textInputs={confirmation.textInputs}
          title={confirmation.title}
          tone={confirmation.tone}
        />
      ) : requestedConfirmationAction ? (
        <AdminNoticeCard className="admin-mb-16" role="alert" tone="danger">
          <div>
            <h2>Finance request is no longer available</h2>
            <p className="muted">Refresh the pending queue before making a decision. No wallet, bank, cash, tax, or ledger entry was changed.</p>
          </div>
          <StatusBadge tone="danger">Blocked</StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {queueView === 'priority' && queueResult.ok ? <FinanceListCommandBoard
        ariaLabel="Finance approval command board"
        className="finance-approval-command-board"
      >
        <FinanceListCommandCard
          detail={`${queue.summary.refundReadyCount} ready · ${queue.summary.refundBlockedCount} blocked · ${queue.summary.refundStateMismatchCount} state mismatch`}
          href={financeApprovalQueueHref(take, 'refunds')}
          icon={RotateCcw}
          label="Refund approvals"
          scope={approvalQueueCardScope(queue.summary.refundPendingCount, 'Needs approval')}
          tone={queue.summary.refundPendingCount > 0 ? 'danger' : 'success'}
          value={String(queue.summary.refundPendingCount)}
        />
        <FinanceListCommandCard
          detail={`${queue.summary.payoutBatchReadyCount} ready · ${queue.summary.payoutBatchBlockedCount} blocked`}
          href={financeApprovalQueueHref(take, 'payouts')}
          icon={Landmark}
          label="Payout approvals"
          scope={approvalQueueCardScope(queue.summary.payoutBatchPendingCount, 'Needs approval')}
          tone={queue.summary.payoutBatchPendingCount > 0 ? 'danger' : 'success'}
          value={String(queue.summary.payoutBatchPendingCount)}
        />
        <FinanceListCommandCard
          detail={`${queue.summary.withdrawalPaidCloseoutPendingCount} paid closeout pending · ${queue.summary.withdrawalReviewRequiredCount} requires review`}
          href={financeApprovalQueueHref(take, 'withdrawals')}
          icon={ShieldAlert}
          label="Withdrawal review"
          scope={approvalQueueCardScope(queue.summary.withdrawalOpenCount, 'Needs review')}
          tone={queue.summary.withdrawalOpenCount > 0 ? 'warning' : 'success'}
          value={String(queue.summary.withdrawalOpenCount)}
        />
        <FinanceListCommandCard
          detail={`${queue.summary.walletAdjustmentReadyCount} ready · ${queue.summary.walletAdjustmentBlockedCount} blocked · ${queue.summary.walletAdjustmentStaleCount} stale`}
          href={`${financeApprovalQueueHref(take, 'wallet')}#wallet-adjustment-requests`}
          icon={WalletCards}
          label="Wallet adjustments"
          scope={walletAdjustmentCardScope(queue.summary)}
          tone={walletAdjustmentCardTone(queue.summary)}
          value={String(queue.summary.walletAdjustmentPendingCount)}
        />
        <FinanceListCommandCard
          detail={`${queue.summary.paymentFeePolicyPendingCount} policies · ${queue.summary.companyBankAccountPendingCount} bank changes · ${queue.summary.partnerBankDepositPendingCount} deposits`}
          href={financeApprovalQueueHref(take, 'policies')}
          icon={Building2}
          label="Other approvals"
          scope={approvalQueueCardScope(otherApprovalCount, 'Needs approval')}
          tone={otherApprovalCount > 0 ? 'warning' : 'success'}
          value={String(otherApprovalCount)}
        />
      </FinanceListCommandBoard> : null}

      {queueView === 'priority' && queueResult.ok ? (
        <AdminNoticeCard className="admin-mb-16 finance-approval-bank-followup" tone={bankMatchingCount > 0 ? 'warning' : 'success'}>
          <div>
            <h2>Post-approval bank matching</h2>
            {bankReconciliationResult.ok ? (
              <p className="muted">
                {bankMatchingCount} unmatched or partially matched · {bankReconciliationSummary.unassignedCount} unassigned
                {financeApprovalOldestBankMatchAge(bankReconciliationSummary) ? ` · oldest ${financeApprovalOldestBankMatchAge(bankReconciliationSummary)}` : ''}
              </p>
            ) : (
              <p className="muted">Bank matching status is unavailable. Open Bank Reconciliation before relying on this handoff.</p>
            )}
            <AdminFormControlLink
              className="button-secondary"
              href="/finance-tax/bank-reconciliation?workspace=operations&review=unmatched&owner=unassigned"
            >
              Open Bank Reconciliation
            </AdminFormControlLink>
          </div>
          <StatusBadge tone={bankReconciliationResult.ok ? (bankMatchingCount > 0 ? 'warning' : 'success') : 'danger'}>
            {bankReconciliationResult.ok ? `${bankMatchingCount} follow-up` : 'Unavailable'}
          </StatusBadge>
        </AdminNoticeCard>
      ) : null}

      {queueView === 'refunds' && requestedConfirmationId ? (
        <RefundApprovalFocusPanel
          focus={queue.refundFocus ?? {
            request: null,
            requestId: requestedConfirmationId,
            state: 'NOT_FOUND_OR_CHANGED',
          }}
          focusHref={refundFocusHref}
          page={page}
          returnTo={refundReturnTo}
          review={review}
          take={take}
        />
      ) : null}

      {queueResult.ok && !focusedQueueClear && queueView === 'wallet' ? <AdminFilterPanel
        className="admin-mb-16"
        description={financeApprovalQueueFilterDescription(queueView)}
        resultLabel={`${queue.walletAdjustmentRequests.length} shown / ${walletReviewCount(queue.summary, walletReview)} ${walletReviewLabel(walletReview)}`}
        resultTone="info"
        title="Queue controls"
      >
        <AdminFormGrid method="get">
          <input name="view" type="hidden" value="wallet" />
          <AdminFormSelect
            defaultValue={walletReview}
            label="Review state"
            labelVisibility="visible"
            name="walletReview"
            options={[
              { label: 'All pending', value: 'all' },
              { label: 'Ready to approve', value: 'ready' },
              { label: 'Blocked', value: 'blocked' },
              { label: 'Stale balance', value: 'stale' },
            ]}
          />
          <AdminFormSelect
            defaultValue={String(take)}
            label="Rows shown"
            labelVisibility="visible"
            name="take"
            options={[
              { label: '10 rows', value: '10' },
              { label: '25 rows', value: '25' },
            ]}
          />
          <AdminFormControlButton className="button-primary" type="submit">
            Apply filters
          </AdminFormControlButton>
          <AdminFormControlLink className="button-secondary" href={financeApprovalQueueHref(10, 'wallet')}>
            Reset
          </AdminFormControlLink>
        </AdminFormGrid>
      </AdminFilterPanel> : null}

      {queueResult.ok && !focusedQueueClear && (queueView === 'refunds' || queueView === 'payouts') ? (
        <div aria-label="Review state" className="finance-approval-review-controls" role="group">
          <span className="muted">Review state</span>
          <AdminSegmentedControl
            activeValue={review}
            ariaLabel={`${queueView === 'refunds' ? 'Refund' : 'Payout'} review state`}
            options={queueView === 'refunds'
              ? [
                  { href: financeApprovalQueueHref(take, 'refunds', { review: 'ready' }), label: 'Ready', value: 'ready' },
                  { href: financeApprovalQueueHref(take, 'refunds', { review: 'state-mismatch' }), label: 'Repair', value: 'state-mismatch' },
                  { href: financeApprovalQueueHref(take, 'refunds', { review: 'blocked' }), label: 'Blocked', value: 'blocked' },
                  { href: financeApprovalQueueHref(take, 'refunds', { review: 'all' }), label: 'All', value: 'all' },
                ]
              : [
                  { href: financeApprovalQueueHref(take, 'payouts', { review: 'ready' }), label: 'Ready', value: 'ready' },
                  { href: financeApprovalQueueHref(take, 'payouts', { review: 'blocked' }), label: 'Blocked', value: 'blocked' },
                  { href: financeApprovalQueueHref(take, 'payouts', { review: 'all' }), label: 'All', value: 'all' },
                ]}
          />
          <span className="muted">
            {queuePagination.totalCount} in this state · page {queuePagination.page}
          </span>
        </div>
      ) : null}

      {queueResult.ok && !focusedQueueClear && queueView !== 'wallet' ? (
        <div aria-label="Rows shown" className="finance-approval-inline-controls" role="group">
          <span className="muted">Rows shown</span>
          <AdminSegmentedControl
            activeValue={String(take)}
            ariaLabel="Approval queue rows shown"
            options={[
              { href: financeApprovalQueueHref(10, queueView, { review, walletReview }), label: '10', value: '10' },
              { href: financeApprovalQueueHref(25, queueView, { review, walletReview }), label: '25', value: '25' },
            ]}
          />
        </div>
      ) : null}

      {queueResult.ok && focusedQueueClear ? (
        <AdminSection
          actions={
            <AdminFormControlLink className="button-secondary" href={financeApprovalQueueHref(take, 'priority')}>
              Back to Priority
            </AdminFormControlLink>
          }
          className="finance-approval-empty-queue"
          description="There is no work in this approval queue. No table or inactive decision controls are shown."
          statusLabel="No work"
          statusTone="success"
          title={financeApprovalFocusedQueueTitle(queueView)}
        >
          <div className="admin-filter-chip-group">
            {financeApprovalActiveQueueLinks(queue, take).map((link) => (
              <StatusBadgeLink href={link.href} key={link.href} tone="info">
                {link.label}
              </StatusBadgeLink>
            ))}
          </div>
        </AdminSection>
      ) : null}

      {queueView === 'priority' && queueResult.ok ? (
        <div className="finance-approval-priority-streams">
          <FinanceTablePanel
            description="Executable requests that passed the current operator and persisted evidence checks. Review the immutable evidence snapshot before deciding."
            grouped
            resultLabel={`${readyPriorityItems.length} shown`}
            resultTone={readyPriorityItems.length > 0 ? 'warning' : 'success'}
            title="Ready decisions"
          >
            <FinanceApprovalPriorityTable
              ariaLabel="Ready finance approval decisions"
              emptyMessage="No finance request is ready for this approver."
              items={readyPriorityItems}
            />
          </FinanceTablePanel>
          <FinanceTablePanel
            description="State mismatches, stale evidence, missing controls, or maker-check failures. These rows never expose an unsafe decision action."
            grouped
            resultLabel={`${repairPriorityItems.length} shown · ${priorityCount} total open`}
            resultTone={repairPriorityItems.length > 0 ? 'danger' : 'success'}
            title="Repair exceptions"
          >
            <FinanceApprovalPriorityTable
              ariaLabel="Finance approval repair exceptions"
              emptyMessage="No finance approval exception requires repair."
              items={repairPriorityItems}
            />
          </FinanceTablePanel>
        </div>
      ) : null}

      {queueView === 'policies' && !focusedQueueClear ? (
        <FinanceTablePanel
          grouped
          description="Only the latest request event for a draft policy appears. Rejected, cancelled, stale, and activated policies are excluded."
          resultLabel={`${queue.summary.paymentFeePolicyPendingCount} pending`}
          resultTone={queue.summary.paymentFeePolicyPendingCount > 0 ? 'warning' : 'success'}
          title="Payment fee policy reviews"
        >
        <FinanceDataTable
          ariaLabel="Payment fee policy approval queue"
          emptyMessage="No payment fee policy review is pending."
          headers={['Policy', 'Requested by', 'Requested', 'Effective from', 'Reason', 'Action']}
          rowCount={queue.paymentFeePolicyRequests.length}
        >
          {queue.paymentFeePolicyRequests.map((request) => (
            <tr id={`approval-${request.requestId}`} key={request.requestId}>
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
      ) : null}

      {queueView === 'bank-accounts' && !focusedQueueClear ? (
        <FinanceTablePanel
          grouped
          description="The maker proposes a new company account or a managed-field change. A different Finance approver reviews the exact before and proposed state before it can be applied."
          resultLabel={`${queue.summary.companyBankAccountPendingCount} pending`}
          resultTone={queue.summary.companyBankAccountPendingCount > 0 ? 'warning' : 'success'}
          title="Company bank account approval queue"
        >
          <FinanceDataTable
            ariaLabel="Company bank account approval queue"
            emptyMessage="No company bank account change is waiting for approval."
            headers={['Review', 'Account', 'Current state', 'Proposed state', 'Maker & reason', 'Requested', 'Decision']}
            rowCount={queue.companyBankAccountRequests.length}
          >
            {queue.companyBankAccountRequests.map((request) => (
              <tr id={`approval-${request.requestId}`} key={request.requestId}>
                <td>
                  <StatusBadge tone={request.reviewState === 'READY' ? 'success' : 'danger'}>
                    {request.reviewState === 'READY' ? 'Ready' : 'Different approver required'}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{request.name}</strong>
                  <div className="muted">{request.bankName} · {companyBankAccountMask(request)}</div>
                  <StatusBadge tone="info">{request.operation === 'CREATE' ? 'New account' : 'Change'}</StatusBadge>
                </td>
                <td>
                  <strong>{request.name}</strong>
                  <div className="muted">{request.bankName} · {request.currency}</div>
                  <StatusBadge tone={request.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {humanizeStatus(request.status)}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{request.proposed.name}</strong>
                  <div className="muted">
                    {request.proposed.bankName} · {request.proposed.currency} · {companyBankAccountMask(request.proposed)}
                  </div>
                  <StatusBadge tone={request.proposed.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {humanizeStatus(request.proposed.status)}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id}</strong>
                  {request.requestedBy.email ? <div className="muted">{request.requestedBy.email}</div> : null}
                  <div className="muted">{request.operatorReason}</div>
                </td>
                <td><DateTimeText value={request.requestedAt} /></td>
                <td>
                  <div className="finance-approval-decision-actions">
                    <AdminFormControlLink
                      className="button-secondary"
                      href="/finance-tax/company-bank-accounts"
                    >
                      Open accounts
                    </AdminFormControlLink>
                    {request.reviewState === 'READY' ? (
                      <>
                        <AdminFormControlLink
                          className="button-primary"
                          href={financeApprovalConfirmHref(
                            take,
                            queueView,
                            'approve-bank-account',
                            request.requestId,
                          )}
                        >
                          Approve change
                        </AdminFormControlLink>
                        <AdminFormControlLink
                          className="button-danger"
                          href={financeApprovalConfirmHref(
                            take,
                            queueView,
                            'reject-bank-account',
                            request.requestId,
                          )}
                        >
                          Reject
                        </AdminFormControlLink>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'deposits' && !focusedQueueClear ? (
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
          ariaLabel="Partner bank deposit approval queue"
          emptyMessage="No Partner bank deposit request is waiting for approval."
          headers={['Partner', 'Evidence & preflight', 'Amount', 'Wallet allocation', 'Maker', 'Decision']}
          rowCount={queue.partnerBankDepositRequests.length}
          scrollClassName="finance-approval-deposit-table"
        >
          {queue.partnerBankDepositRequests.map((request) => (
            <tr id={`approval-${request.id}`} key={request.id}>
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
                <FinanceApprovalPreflightStatus preflight={request.preflight} />
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
                <div className="finance-approval-decision-actions">
                  <AdminFormControlLink
                    className="button-secondary"
                    href={`/finance-tax/partner-bank-deposits/${request.id}`}
                  >
                    Open evidence
                  </AdminFormControlLink>
                  {request.preflight?.canApprove !== false ? (
                    <AdminFormControlLink
                      className="button-primary"
                      href={financeApprovalConfirmHref(take, queueView, 'approve-deposit', request.id)}
                    >
                      Approve & execute
                    </AdminFormControlLink>
                  ) : (
                    <StatusBadge tone="danger">Approval blocked</StatusBadge>
                  )}
                  {request.preflight?.canReject !== false ? (
                    <AdminFormControlLink
                      className="button-danger"
                      href={financeApprovalConfirmHref(take, queueView, 'reject-deposit', request.id)}
                    >
                      Reject
                    </AdminFormControlLink>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'withdrawals' && !focusedQueueClear ? (
        <FinanceTablePanel
          className="admin-mt-16"
          grouped
          description={`Open withdrawal exposure is ${formatMoney(queue.summary.withdrawalOpenAmount, queue.summary.withdrawalCurrency)}. Each row opens the filtered payout workflow.`}
          resultLabel={`${queue.summary.withdrawalOpenCount} open`}
          resultTone={queue.summary.withdrawalOpenCount > 0 ? 'warning' : 'success'}
          title="Partner withdrawal work queue"
        >
        <FinanceDataTable
          ariaLabel="Partner withdrawal work queue"
          emptyMessage="No Partner withdrawal requires finance action."
          headers={['Partner', 'Status', 'Amount', 'Bank account', 'Requested', 'Action']}
          rowCount={queue.withdrawalRequests.length}
          scrollClassName="finance-approval-withdrawal-table"
        >
          {queue.withdrawalRequests.map((request) => (
            <tr id={`approval-${request.id}`} key={request.id}>
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
                <div className="admin-inline-action-stack">
                  {request.status === 'BANK_TRANSFER_PENDING' ? (
                    request.reviewState === 'READY' ? (
                      <AdminFormControlLink
                        className="button-success"
                        href={financeApprovalConfirmHref(
                          take,
                          queueView,
                          'approve-withdrawal-paid',
                          request.id,
                        )}
                      >
                        Approve paid closeout
                      </AdminFormControlLink>
                    ) : (
                      <StatusBadge tone="danger">Approval blocked</StatusBadge>
                    )
                  ) : null}
                  <StatusBadgeLink
                    href={`/payouts?${new URLSearchParams({
                      range: 'all',
                      view: 'withdrawals',
                      withdrawalId: request.id,
                      withdrawalStatus: request.status,
                    }).toString()}#withdrawal-${encodeURIComponent(request.id)}`}
                    tone="info"
                  >
                    Open payout queue
                  </StatusBadgeLink>
                </div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'payouts' && !focusedQueueClear ? (
        <FinanceTablePanel
          className="admin-mt-16"
          grouped
          description="The maker prepares the transfer reference and moves the batch to Processing. A different authenticated Finance approver executes the paid closeout."
          resultLabel={`${queuePagination.totalCount} ${review === 'all' ? 'matching' : review}`}
          resultTone={queue.summary.payoutBatchPendingCount > 0 ? 'danger' : 'success'}
          title="Payout batch paid closeout queue"
        >
          <FinanceDataTable
            ariaLabel="Payout batch closeout approval queue"
            emptyMessage="No payout batch is waiting for paid closeout approval."
            headers={['Review', 'Partner', 'Amount', 'Transfer reference', 'Requested by', 'Requested', 'Decision']}
            rowCount={queue.payoutBatchRequests.length}
            scrollClassName="finance-approval-payout-table"
          >
            {queue.payoutBatchRequests.map((batch) => (
              <tr id={`approval-${batch.id}`} key={batch.id}>
                <td>
                  <StatusBadge tone={batch.reviewState === 'READY' ? 'success' : 'danger'}>
                    {batch.reviewState === 'READY' ? 'Ready' : 'Blocked'}
                  </StatusBadge>
                </td>
                <td>
                  <strong>{batch.partnerName}</strong>
                  <div className="muted">{batch.providerProfileId}</div>
                </td>
                <td><strong><MoneyText amount={batch.totalNetAmount} currency={batch.currency} /></strong></td>
                <td>{batch.transferRef ?? <span className="muted">Missing</span>}</td>
                <td>
                  {batch.paidCloseoutRequestedBy?.fullName ??
                    batch.paidCloseoutRequestedBy?.email ??
                    batch.paidCloseoutRequestedByAdminId ??
                    'Unknown maker'}
                </td>
                <td><DateTimeText value={batch.createdAt} /></td>
                <td>
                  <div className="admin-inline-action-stack">
                    {batch.reviewState === 'READY' ? (
                      <AdminFormControlLink
                        className="button-success"
                        href={financeApprovalConfirmHref(
                          take,
                          queueView,
                          'approve-payout-paid',
                          batch.id,
                          'all',
                          review,
                          page,
                        )}
                      >
                        Approve paid closeout
                      </AdminFormControlLink>
                    ) : (
                      <StatusBadge tone="danger">Approval blocked</StatusBadge>
                    )}
                    <StatusBadgeLink
                      href={`/payouts?${new URLSearchParams({
                        payoutBatchId: batch.id,
                        review: 'in-progress',
                        workspace: 'operations',
                      }).toString()}#payout-batch-${encodeURIComponent(batch.id)}`}
                      tone="info"
                    >
                      Open payout queue
                    </StatusBadgeLink>
                  </div>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'refunds' && !focusedQueueClear ? (
        <FinanceTablePanel
          className="admin-mt-16"
          grouped
          description={`${queue.summary.refundReadyCount} ready · ${queue.summary.refundBlockedCount} blocked · ${queue.summary.refundStateMismatchCount} state mismatch. Payment state is revalidated by the server before execution.`}
          resultLabel={`${queuePagination.totalCount} ${review === 'state-mismatch' ? 'repair' : review}`}
          resultTone={queue.summary.refundPendingCount > 0 ? 'danger' : 'success'}
          title="Payment refund approval queue"
        >
          <FinanceDataTable
            ariaLabel="Payment refund approval queue"
            emptyMessage="No refund request is waiting for review."
            headers={['Review', 'Booking & payment', 'Method', 'Amount', 'Reason', 'Requested', 'Decision']}
            rowCount={queue.refundRequests.length}
            scrollClassName="finance-approval-refund-table"
          >
            {queue.refundRequests.map((request) => (
              <tr id={`approval-${request.id}`} key={request.id}>
                <td>
                  <StatusBadge tone={request.reviewState === 'READY' ? 'success' : 'danger'}>
                    {request.reviewState === 'READY'
                      ? 'Ready'
                      : request.reviewState === 'STATE_MISMATCH'
                        ? 'State mismatch'
                        : 'Blocked'}
                  </StatusBadge>
                  {request.blockers.length ? (
                    <div className="muted">{request.blockers.map((blocker) => blocker.message).join(' ')}</div>
                  ) : null}
                </td>
                <td>
                  <strong>{request.bookingId}</strong>
                  <div className="muted">{request.paymentId}</div>
                </td>
                <td>
                  <strong>{humanizeStatus(request.paymentMethod)}</strong>
                  <div className="muted">{humanizeStatus(request.paymentStatus)}</div>
                </td>
                <td><strong><MoneyText amount={request.amount} currency={request.currency} /></strong></td>
                <td>
                  <strong>{request.reason ?? 'Refund requested'}</strong>
                  <div className="muted">{humanizeStatus(request.source ?? 'ADMIN_MANUAL')}</div>
                </td>
                <td>
                  <DateTimeText value={request.requestedAt} />
                  <div className="muted">
                    {request.requestedByAdminId ?? 'System request'}
                  </div>
                </td>
                <td>
                  <div className="finance-approval-decision-actions">
                    <AdminFormControlLink
                      className="button-secondary"
                      href={`/refunds?range=all&review=open&sort=oldest&q=${encodeURIComponent(request.id)}#refund-${encodeURIComponent(request.id)}`}
                    >
                      Open refund case
                    </AdminFormControlLink>
                    <AdminFormControlLink
                      className="button-secondary"
                      href={`/payments/${encodeURIComponent(request.paymentId)}`}
                    >
                      Open payment timeline
                    </AdminFormControlLink>
                    {request.canApprove ? (
                        <AdminFormControlLink
                          className="button-primary"
                          href={financeApprovalConfirmHref(
                            take,
                            queueView,
                            'approve-refund',
                            request.id,
                            'all',
                            review,
                            page,
                          )}
                        >
                          Approve refund
                        </AdminFormControlLink>
                    ) : null}
                    {request.canReject ? (
                        <AdminFormControlLink
                          className="button-danger"
                          href={financeApprovalConfirmHref(
                            take,
                            queueView,
                            'reject-refund',
                            request.id,
                            'all',
                            review,
                            page,
                          )}
                        >
                          Reject
                        </AdminFormControlLink>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'wallet' && !focusedQueueClear ? (
        <FinanceTablePanel
          className="admin-mt-16"
          description={`${queue.summary.walletAdjustmentReadyCount} can be approved now. ${queue.summary.walletAdjustmentBlockedCount} require another operator or missing control evidence. ${queue.summary.walletAdjustmentStaleCount} must be closed by the maker or another finance approver, then recreated from the current balance.`}
          grouped
          id="wallet-adjustment-requests"
          resultLabel={`${walletReviewCount(queue.summary, walletReview)} ${walletReviewLabel(walletReview)}`}
          resultTone={walletReviewResultTone(queue.summary, walletReview)}
          title="Wallet adjustment approval queue"
        >
        <FinanceDataTable
          ariaLabel="Wallet adjustment approval queue"
          emptyMessage="No manual wallet adjustment request is waiting for approval."
          headers={['State', 'Owner / request', 'Amount', 'Balance delta', 'Age', 'Primary blocker', 'Action']}
          rowCount={queue.walletAdjustmentRequests.length}
          scrollClassName="finance-approval-wallet-table"
        >
          {queue.walletAdjustmentRequests.map((request) => (
            <tr id={`approval-${request.id}`} key={request.id}>
              <td>
                <StatusBadge tone={walletAdjustmentReviewTone(request.reviewState)}>
                  {walletAdjustmentReviewLabel(request.reviewState)}
                </StatusBadge>
              </td>
              <td>
                <strong>{request.ownerName ?? request.ownerId}</strong>
                <div className="muted">{request.ownerType} · {request.ownerId}</div>
                <strong>{humanizeStatus(request.adjustmentType)}</strong>
                <div className="muted">{humanizeStatus(request.direction)} · {request.reason}</div>
                <div className="muted">
                  Maker {request.requestedBy?.fullName ?? request.requestedBy?.email ?? request.requestedByAdminId}
                </div>
              </td>
              <td><strong><MoneyText amount={request.amount} currency={request.currency} /></strong></td>
              <td>
                <strong>
                  {request.requestedAfterBalance - request.requestedBeforeBalance >= 0 ? '+' : ''}
                  <MoneyText
                    amount={request.requestedAfterBalance - request.requestedBeforeBalance}
                    currency={request.currency}
                  />
                </strong>
                <div className="muted">
                  <MoneyText amount={request.requestedBeforeBalance} currency={request.currency} /> →{' '}
                  <MoneyText amount={request.requestedAfterBalance} currency={request.currency} />
                </div>
              </td>
              <td>
                <strong>{financeApprovalAgeLabel(request.createdAt)}</strong>
                <div className="muted"><DateTimeText value={request.createdAt} /></div>
              </td>
              <td>
                <strong>{walletAdjustmentPrimaryBlocker(request)}</strong>
                <AdminDetails className="finance-approval-row-details">
                  <summary>Evidence details</summary>
                  <div className="muted">
                    Attachment {request.requiresAttachment ? (request.attachmentUrl ? 'attached' : 'missing') : 'optional'}.
                    {request.monthlyPeriod ? ` Period ${request.monthlyPeriod}.` : ''}
                  </div>
                  <FinanceApprovalPreflightStatus preflight={request.preflight} />
                </AdminDetails>
              </td>
              <td>
                <div className="finance-approval-decision-actions">
                  {request.preflight?.canApprove !== false ? (
                    <AdminFormControlLink
                      className="button-primary"
                      href={financeApprovalConfirmHref(
                        take,
                        queueView,
                        'approve-wallet',
                        request.id,
                        walletReview,
                      )}
                    >
                      Approve & execute
                    </AdminFormControlLink>
                  ) : (
                    <StatusBadge tone="danger">Approval blocked</StatusBadge>
                  )}
                  {request.preflight?.canReject !== false ? (
                    <AdminFormControlLink
                      className="button-danger"
                      href={financeApprovalConfirmHref(
                        take,
                        queueView,
                        'reject-wallet',
                        request.id,
                        walletReview,
                      )}
                    >
                      Reject
                    </AdminFormControlLink>
                  ) : null}
                  {request.preflight?.canCancel === true ? (
                    <AdminFormControlLink
                      className="button-secondary"
                      href={financeApprovalConfirmHref(
                        take,
                        queueView,
                        'cancel-wallet',
                        request.id,
                        walletReview,
                      )}
                    >
                      Cancel stale request
                    </AdminFormControlLink>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </FinanceDataTable>
        </FinanceTablePanel>
      ) : null}

      {queueView === 'wallet' && !focusedQueueClear ? (
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
      ) : null}

      {queueResult.ok && queueView !== 'priority' && (queuePagination.hasPrevious || queuePagination.hasNext) ? (
        <nav aria-label="Approval queue pages" className="finance-approval-pagination">
          {queuePagination.hasPrevious ? (
            <AdminFormControlLink
              className="button-secondary"
              href={financeApprovalQueueHref(take, queueView, {
                page: queuePagination.page - 1,
                review,
                walletReview,
              })}
            >
              Previous page
            </AdminFormControlLink>
          ) : <span />}
          <span className="muted">Page {queuePagination.page} · {queuePagination.totalCount} matching requests</span>
          {queuePagination.hasNext ? (
            <AdminFormControlLink
              className="button-secondary"
              href={financeApprovalQueueHref(take, queueView, {
                page: queuePagination.page + 1,
                review,
                walletReview,
              })}
            >
              Next page
            </AdminFormControlLink>
          ) : null}
        </nav>
      ) : null}
    </AdminPageTemplate>
  );
}

function FinanceApprovalPriorityTable({
  ariaLabel,
  emptyMessage,
  items,
}: {
  readonly ariaLabel: string;
  readonly emptyMessage: string;
  readonly items: readonly FinanceApprovalPriorityItem[];
}) {
  return (
    <FinanceDataTable
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
      headers={['Risk', 'Work type', 'Subject', 'Amount', 'Age', 'Control', 'Owner', 'Action']}
      rowCount={items.length}
      scrollClassName="finance-approval-priority-table"
    >
      {items.map((item) => (
        <tr key={item.id}>
          <td><StatusBadge tone={item.riskTone}>{item.riskLabel}</StatusBadge></td>
          <td><StatusBadge tone={item.typeTone}>{item.typeLabel}</StatusBadge></td>
          <td>
            <strong>{item.subject}</strong>
            <div className="muted">{item.detail}</div>
          </td>
          <td>
            {item.amount !== undefined && item.currency ? (
              <strong><MoneyText amount={item.amount} currency={item.currency} /></strong>
            ) : (
              <span className="muted">Policy change</span>
            )}
          </td>
          <td>
            <strong>{financeApprovalAgeLabel(item.createdAt)}</strong>
            <div className="muted"><DateTimeText value={item.createdAt} /></div>
          </td>
          <td><StatusBadge tone={item.controlTone}>{item.controlLabel}</StatusBadge></td>
          <td>{item.ownerLabel}</td>
          <td>
            <StatusBadgeLink
              aria-label={`${item.actionLabel}: ${item.typeLabel} ${item.subject}`}
              href={item.href}
              tone="info"
            >
              {item.actionLabel}
            </StatusBadgeLink>
          </td>
        </tr>
      ))}
    </FinanceDataTable>
  );
}

function queueLimit(value: string) {
  return value === '25' ? 25 : 10;
}

function queuePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 400) : 1;
}

function normalizeFinanceApprovalRefundReview(value: string): FinanceApprovalRefundReview {
  return value === 'blocked' || value === 'state-mismatch' || value === 'all' ? value : 'ready';
}

function normalizeFinanceApprovalPayoutReview(value: string): FinanceApprovalPayoutReview {
  return value === 'blocked' || value === 'all' ? value : 'ready';
}

function financeApprovalConfirmationAction(value: string): FinanceApprovalConfirmationAction | null {
  return value === 'approve-bank-account' ||
    value === 'reject-bank-account' ||
    value === 'approve-deposit' ||
    value === 'approve-payout-paid' ||
    value === 'approve-withdrawal-paid' ||
    value === 'reject-deposit' ||
    value === 'approve-refund' ||
    value === 'reject-refund' ||
    value === 'approve-wallet' ||
    value === 'cancel-wallet' ||
    value === 'reject-wallet'
    ? value
    : null;
}

function readFinanceApprovalQueueView(
  params: Record<string, string | string[] | undefined>,
  requestedConfirmationAction: FinanceApprovalConfirmationAction | null,
): FinanceApprovalQueueView {
  const requestedView = readSearchParam(params.view);
  if (
    requestedView === 'bank-accounts' ||
    requestedView === 'deposits' ||
    requestedView === 'policies' ||
    requestedView === 'payouts' ||
    requestedView === 'refunds' ||
    requestedView === 'wallet' ||
    requestedView === 'withdrawals'
  ) {
    return requestedView;
  }
  if (requestedConfirmationAction?.endsWith('bank-account')) return 'bank-accounts';
  if (requestedConfirmationAction?.endsWith('deposit')) return 'deposits';
  if (requestedConfirmationAction === 'approve-payout-paid') return 'payouts';
  if (requestedConfirmationAction === 'approve-withdrawal-paid') return 'withdrawals';
  if (requestedConfirmationAction?.endsWith('refund')) return 'refunds';
  if (requestedConfirmationAction?.endsWith('wallet')) return 'wallet';
  return 'priority';
}

function financeApprovalQueueHref(
  take: number,
  view: FinanceApprovalQueueView,
  filters: {
    readonly page?: number;
    readonly review?: FinanceApprovalPayoutReview | FinanceApprovalRefundReview | 'all';
    readonly walletReview?: FinanceApprovalWalletReview;
  } = {},
) {
  const search = new URLSearchParams();
  if (view !== 'priority') search.set('view', view);
  if (view === 'wallet' && filters.walletReview && filters.walletReview !== 'all') {
    search.set('walletReview', filters.walletReview);
  }
  if ((view === 'refunds' || view === 'payouts') && filters.review && filters.review !== 'all') {
    search.set('review', filters.review);
  }
  if (view !== 'priority' && (filters.page ?? 1) > 1) search.set('page', String(filters.page));
  if (take === 25) search.set('take', '25');
  const query = search.toString();
  return query ? `/finance-tax/approval-queue?${query}` : '/finance-tax/approval-queue';
}

function financeApprovalConfirmHref(
  take: number,
  view: FinanceApprovalQueueView,
  action: FinanceApprovalConfirmationAction,
  requestId: string,
  walletReview: FinanceApprovalWalletReview = 'all',
  review: FinanceApprovalPayoutReview | FinanceApprovalRefundReview | 'all' = 'all',
  page = 1,
  returnTo?: string,
) {
  const search = new URLSearchParams({ confirm: action, requestId });
  if (view !== 'priority') search.set('view', view);
  if (view === 'wallet' && walletReview !== 'all') search.set('walletReview', walletReview);
  if ((view === 'refunds' || view === 'payouts') && review !== 'all') search.set('review', review);
  if (view !== 'priority' && page > 1) search.set('page', String(page));
  if (take === 25) search.set('take', '25');
  if (returnTo) search.set('returnTo', safeRefundReturnTo(returnTo));
  return `/finance-tax/approval-queue?${search.toString()}`;
}

function RefundApprovalFocusPanel({
  focus,
  focusHref,
  page,
  returnTo,
  review,
  take,
}: {
  readonly focus: NonNullable<AdminFinanceApprovalQueue['refundFocus']>;
  readonly focusHref: string;
  readonly page: number;
  readonly returnTo: string;
  readonly review: FinanceApprovalRefundReview;
  readonly take: number;
}) {
  const request = focus.request;
  if (focus.state !== 'FOUND' || !request) {
    return (
      <AdminNoticeCard className="finance-approval-refund-focus admin-mb-16" role="alert" tone="warning">
        <div>
          <h2>Refund request not found or no longer pending</h2>
          <p className="muted">
            Request {focus.requestId} may have changed after this link was opened. Refresh before making a decision.
          </p>
          <div className="finance-approval-focus-actions">
            <AdminFormControlLink className="button-secondary" href={focusHref}>Refresh request</AdminFormControlLink>
            <AdminFormControlLink className="button-secondary" href={returnTo}>Back to refund queue</AdminFormControlLink>
          </div>
        </div>
        <StatusBadge tone="warning">Changed or unavailable</StatusBadge>
      </AdminNoticeCard>
    );
  }

  const ready = request.reviewState === 'READY';
  const reviewLabel = ready ? 'Ready' : request.reviewState === 'STATE_MISMATCH' ? 'State mismatch' : 'Blocked';
  const reviewTone: StatusBadgeTone = ready ? 'success' : 'danger';
  const mismatchReason = request.mismatchReason ?? request.blockers.map((blocker) => blocker.message).join(' ');

  return (
    <FinanceTablePanel
      className="finance-approval-refund-focus admin-mb-16"
      description="Exact refund request loaded independently from queue pagination and review filters. Revalidate before any decision."
      grouped
      id={`approval-${request.id}`}
      resultLabel={reviewLabel}
      resultTone={reviewTone}
      title="Focused refund decision"
    >
      <div className="finance-approval-refund-focus-grid">
        <div><span>Refund ID</span><strong>{request.id}</strong><small>Refund {request.status}</small></div>
        <div><span>Payment ID</span><strong>{request.paymentId}</strong><small>{request.paymentMethod} · {request.paymentStatus}</small></div>
        <div><span>Booking ID</span><strong>{request.bookingId}</strong><small>Booking {request.bookingStatus ?? 'UNKNOWN'}</small></div>
        <div><span>Amount</span><strong><MoneyText amount={request.amount} currency={request.currency} /></strong><small>{request.reason ?? 'No reason recorded'}</small></div>
        <div><span>Control state</span><strong><StatusBadge tone={reviewTone}>{reviewLabel}</StatusBadge></strong><small>{mismatchReason || 'Independent approval controls are available.'}</small></div>
        <div><span>Owner / escalation</span><strong>Finance approval</strong><small>{request.reviewState === 'STATE_MISMATCH' ? 'Escalate to payment operations' : 'Independent finance approver'}</small></div>
      </div>
      <div className="finance-approval-focus-actions">
        <AdminFormControlLink className="button-secondary" href={`/payments/${encodeURIComponent(request.paymentId)}`}>Open payment</AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href={`/bookings/${encodeURIComponent(request.bookingId)}`}>Open booking</AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href={focusHref}>Refresh / revalidate</AdminFormControlLink>
        <AdminFormControlLink className="button-secondary" href={returnTo}>Back to refund queue</AdminFormControlLink>
        {ready ? (
          <>
            <AdminFormControlLink
              className="button-primary"
              href={financeApprovalConfirmHref(take, 'refunds', 'approve-refund', request.id, 'all', review, page, returnTo)}
            >
              Approve refund
            </AdminFormControlLink>
            <AdminFormControlLink
              className="button-danger"
              href={financeApprovalConfirmHref(take, 'refunds', 'reject-refund', request.id, 'all', review, page, returnTo)}
            >
              Reject request
            </AdminFormControlLink>
          </>
        ) : null}
      </div>
    </FinanceTablePanel>
  );
}

function financeApprovalQueueFilterDescription(view: FinanceApprovalQueueView) {
  if (view === 'priority') {
    return 'Shows one bounded, oldest-first list across every open finance decision. Open a focused queue before approving or rejecting.';
  }
  if (view === 'wallet') {
    return 'Ready requests can execute now. Blocked requests need a different approver or missing control evidence. A stale request must be cancelled by its maker or rejected by another finance approver, then recreated from the live wallet balance.';
  }
  if (view === 'refunds') {
    return 'Pending refund records remain visible for evidence review. Only CAPTURED payments can be decided here, and the maker is blocked from approving or rejecting the same request.';
  }
  if (view === 'bank-accounts') {
    return 'Only pending company bank account creations and managed-field changes appear. The maker cannot approve or reject the same request.';
  }
  return 'This view loads only the selected finance work type. Summary counts remain exact across every queue.';
}

function buildFinanceApprovalPriorityItems(
  queue: AdminFinanceApprovalQueue,
  take: number,
): FinanceApprovalPriorityItem[] {
  const policyItems = queue.paymentFeePolicyRequests.map<FinanceApprovalPriorityItem>((request) => ({
    ...financeApprovalPriorityRisk('REVIEW', request.requestedAt),
    actionLabel: 'Review policy', controlLabel: 'Approver required', controlTone: 'warning',
    createdAt: request.requestedAt, detail: `Effective policy ${request.policyId}`,
    href: `/finance-tax/payment-fees?${new URLSearchParams({ policyId: request.policyId }).toString()}`,
    id: `policy-${request.requestId}`,
    ownerLabel: request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id,
    subject: request.policyName, typeLabel: 'Fee policy', typeTone: 'info', unassigned: false,
  }));
  const companyBankAccountItems = queue.companyBankAccountRequests.map<FinanceApprovalPriorityItem>((request) => ({
    ...financeApprovalPriorityRisk(request.reviewState, request.requestedAt),
    actionLabel: request.reviewState === 'READY' ? 'Review change' : 'Open request',
    controlLabel: request.reviewState === 'READY' ? 'Independent approval' : 'Different approver required',
    controlTone: request.reviewState === 'READY' ? 'warning' : 'danger', createdAt: request.requestedAt,
    detail: `${request.operation === 'CREATE' ? 'New account' : 'Managed change'} · ${request.proposed.bankName} · ${companyBankAccountMask(request.proposed)}`,
    href: request.reviewState === 'READY'
      ? financeApprovalConfirmHref(take, 'bank-accounts', 'approve-bank-account', request.requestId)
      : `${financeApprovalQueueHref(take, 'bank-accounts')}#approval-${request.requestId}`,
    id: `company-bank-account-${request.requestId}`,
    ownerLabel: request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id,
    subject: request.proposed.name, typeLabel: 'Bank account', typeTone: 'warning', unassigned: false,
  }));
  const depositItems = queue.partnerBankDepositRequests.map<FinanceApprovalPriorityItem>((request) => {
    const ready = request.preflight?.canApprove === true;
    const hasEvidence = Boolean(request.attachmentFileId || request.attachmentUrl);
    return {
      ...financeApprovalPriorityRisk(ready ? 'READY' : 'BLOCKED', request.createdAt),
      actionLabel: ready ? 'Review deposit' : 'Open evidence', amount: request.amount,
      controlLabel: hasEvidence ? (ready ? 'Independent approval' : 'Control blocked') : 'Evidence missing',
      controlTone: ready ? 'warning' : 'danger', createdAt: request.createdAt, currency: request.currency,
      detail: request.bankTransactionId,
      href: ready
        ? financeApprovalConfirmHref(take, 'deposits', 'approve-deposit', request.id)
        : `/finance-tax/partner-bank-deposits/${encodeURIComponent(request.id)}`,
      id: `deposit-${request.id}`,
      ownerLabel: request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id,
      subject: request.partnerName, typeLabel: 'Bank deposit', typeTone: 'warning', unassigned: false,
    };
  });
  const withdrawalItems = queue.withdrawalRequests.map<FinanceApprovalPriorityItem>((request) => {
    const ready = request.status === 'BANK_TRANSFER_PENDING' && request.reviewState === 'READY';
    return {
      ...financeApprovalPriorityRisk(ready ? 'READY' : request.reviewState, request.createdAt),
      actionLabel: ready ? 'Review paid closeout' : 'Open withdrawal', amount: request.amount,
      controlLabel: ready ? 'Independent approval' : request.hasBankAccount ? humanizeStatus(request.status) : 'Bank account missing',
      controlTone: ready ? 'warning' : request.hasBankAccount ? withdrawalTone(request.status) : 'danger',
      createdAt: request.createdAt, currency: request.currency, detail: request.providerProfileId,
      href: ready
        ? financeApprovalConfirmHref(take, 'withdrawals', 'approve-withdrawal-paid', request.id)
        : `/payouts?${new URLSearchParams({ range: 'all', withdrawalStatus: request.status }).toString()}`,
      id: `withdrawal-${request.id}`, ownerLabel: 'Unassigned', subject: request.partnerName,
      typeLabel: 'Withdrawal', typeTone: withdrawalTone(request.status), unassigned: true,
    };
  });
  const payoutItems = queue.payoutBatchRequests.map<FinanceApprovalPriorityItem>((batch) => {
    const ready = batch.status === 'PROCESSING' && batch.reviewState === 'READY';
    const ownerLabel = batch.paidCloseoutRequestedBy?.fullName ?? batch.paidCloseoutRequestedBy?.email ?? batch.paidCloseoutRequestedByAdminId ?? 'Unassigned';
    return {
      ...financeApprovalPriorityRisk(batch.reviewState, batch.createdAt),
      actionLabel: ready ? 'Review paid closeout' : 'Open payout', amount: batch.totalNetAmount,
      controlLabel: ready ? 'Independent approval' : 'Control blocked', controlTone: ready ? 'warning' : 'danger',
      createdAt: batch.createdAt, currency: batch.currency, detail: batch.transferRef ?? batch.providerProfileId,
      href: ready ? financeApprovalConfirmHref(take, 'payouts', 'approve-payout-paid', batch.id) : '/payouts?workspace=operations&review=in-progress',
      id: `payout-${batch.id}`, ownerLabel, subject: batch.partnerName, typeLabel: 'Payout',
      typeTone: ready ? 'warning' : 'danger', unassigned: ownerLabel === 'Unassigned',
    };
  });
  const walletItems = queue.walletAdjustmentRequests.map<FinanceApprovalPriorityItem>((request) => {
    const state = request.reviewState ?? 'BLOCKED';
    const ownerLabel = request.requestedBy?.fullName ?? request.requestedBy?.email ?? request.requestedByAdminId ?? 'Unassigned';
    const action = state === 'READY' && request.preflight?.canApprove !== false
      ? 'approve-wallet'
      : state === 'STALE' && request.preflight?.canCancel
        ? 'cancel-wallet'
        : null;
    return {
      ...financeApprovalPriorityRisk(state, request.createdAt),
      actionLabel: action ? (action === 'approve-wallet' ? 'Review adjustment' : 'Close stale request') : 'Open request',
      amount: request.amount, controlLabel: walletAdjustmentPrimaryBlocker(request),
      controlTone: state === 'READY' ? 'warning' : 'danger', createdAt: request.createdAt, currency: request.currency,
      detail: `${humanizeStatus(request.direction)} · ${request.reason}`,
      href: action
        ? financeApprovalConfirmHref(take, 'wallet', action, request.id)
        : `${financeApprovalQueueHref(take, 'wallet')}#approval-${request.id}`,
      id: `wallet-${request.id}`, ownerLabel, subject: request.ownerName ?? request.ownerId,
      typeLabel: 'Wallet', typeTone: 'warning', unassigned: ownerLabel === 'Unassigned',
    };
  });
  const refundItems = queue.refundRequests.map<FinanceApprovalPriorityItem>((request) => {
    const ownerLabel = request.requestedByAdminId ?? 'Unassigned';
    return {
      ...financeApprovalPriorityRisk(request.reviewState, request.requestedAt),
      actionLabel: request.reviewState === 'STATE_MISMATCH' ? 'Open payment timeline' : request.reviewState === 'READY' ? 'Review refund' : 'Open request',
      amount: request.amount,
      controlLabel: request.reviewState === 'STATE_MISMATCH' ? `${humanizeStatus(request.paymentStatus)} payment` : request.reviewState === 'READY' ? 'Independent approval' : 'Different approver required',
      controlTone: request.reviewState === 'READY' ? 'warning' : 'danger', createdAt: request.requestedAt,
      currency: request.currency, detail: `${humanizeStatus(request.paymentMethod)} · ${request.reason ?? 'Refund requested'}`,
      href: request.reviewState === 'STATE_MISMATCH'
        ? `/payments/${encodeURIComponent(request.paymentId)}#payment-callback-timeline`
        : request.reviewState === 'READY'
          ? financeApprovalConfirmHref(take, 'refunds', 'approve-refund', request.id)
          : `${financeApprovalQueueHref(take, 'refunds')}#approval-${request.id}`,
      id: `refund-${request.id}`, ownerLabel, subject: request.bookingId,
      typeLabel: 'Refund', typeTone: 'danger', unassigned: ownerLabel === 'Unassigned',
    };
  });

  const sorted = [
    ...policyItems,
    ...companyBankAccountItems,
    ...depositItems,
    ...withdrawalItems,
    ...payoutItems,
    ...walletItems,
    ...refundItems,
  ]
    .sort((left, right) =>
      left.riskRank - right.riskRank ||
      Number(right.unassigned) - Number(left.unassigned) ||
      priorityTimestamp(left.createdAt) - priorityTimestamp(right.createdAt) ||
      (right.amount ?? 0) - (left.amount ?? 0) ||
      left.id.localeCompare(right.id),
    );
  return [
    ...sorted.filter((item) => financeApprovalPriorityWorkstream(item) === 'decision').slice(0, take),
    ...sorted.filter((item) => financeApprovalPriorityWorkstream(item) === 'repair').slice(0, take),
  ];
}

function financeApprovalPriorityWorkstream(item: FinanceApprovalPriorityItem) {
  return item.controlTone === 'danger' || item.riskLabel === 'State mismatch' || item.riskLabel === 'Stale request'
    ? ('repair' as const)
    : ('decision' as const);
}

function priorityTimestamp(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function financeApprovalPriorityRisk(state: string, createdAt: string) {
  const ageHours = Math.max(0, (Date.now() - priorityTimestamp(createdAt)) / 3_600_000);
  if (state === 'STATE_MISMATCH') {
    return { riskLabel: 'State mismatch', riskRank: 0, riskTone: 'danger' as const };
  }
  if (state === 'STALE') {
    return { riskLabel: 'Stale request', riskRank: 0, riskTone: 'danger' as const };
  }
  if (ageHours >= 48) {
    return { riskLabel: 'SLA breach', riskRank: 0, riskTone: 'danger' as const };
  }
  if (state === 'READY') {
    return { riskLabel: 'Ready', riskRank: 1, riskTone: 'warning' as const };
  }
  if (ageHours >= 24) {
    return { riskLabel: 'Aging', riskRank: 2, riskTone: 'warning' as const };
  }
  return { riskLabel: 'Review', riskRank: 3, riskTone: 'neutral' as const };
}

function financeApprovalAgeLabel(value: string) {
  const timestamp = priorityTimestamp(value);
  if (!Number.isFinite(timestamp) || timestamp === Number.MAX_SAFE_INTEGER) return 'Age unavailable';
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours >= 48) return `${Math.floor(hours / 24)}d · SLA breach`;
  if (hours >= 24) return `${hours}h · aging`;
  return `${hours}h`;
}

function financeApprovalOldestBankMatchAge(summary: AdminBankReconciliationSummary) {
  const oldest = [
    summary.oldestUnassignedAt,
    summary.oldestUnmatchedAt,
    summary.oldestPartiallyMatchedAt,
  ]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => priorityTimestamp(left) - priorityTimestamp(right))[0];
  return oldest ? financeApprovalAgeLabel(oldest) : null;
}

function isOtherApprovalView(view: FinanceApprovalQueueView) {
  return view === 'policies' || view === 'bank-accounts' || view === 'deposits';
}

function financeApprovalFocusedQueueCount(queue: AdminFinanceApprovalQueue, view: FinanceApprovalQueueView) {
  if (view === 'refunds') return queue.summary.refundPendingCount;
  if (view === 'payouts') return queue.summary.payoutBatchPendingCount;
  if (view === 'withdrawals') return queue.summary.withdrawalOpenCount;
  if (view === 'wallet') return queue.summary.walletAdjustmentPendingCount;
  if (view === 'policies') return queue.summary.paymentFeePolicyPendingCount;
  if (view === 'bank-accounts') return queue.summary.companyBankAccountPendingCount;
  if (view === 'deposits') return queue.summary.partnerBankDepositPendingCount;
  return queue.summary.totalOpenCount;
}

function financeApprovalFocusedQueueTitle(view: FinanceApprovalQueueView) {
  if (view === 'refunds') return 'Refund approvals';
  if (view === 'payouts') return 'Payout approvals';
  if (view === 'withdrawals') return 'Withdrawal closeout';
  if (view === 'wallet') return 'Wallet adjustments';
  if (view === 'policies') return 'Fee policy approvals';
  if (view === 'bank-accounts') return 'Company bank account approvals';
  if (view === 'deposits') return 'Partner deposit approvals';
  return 'Priority finance work';
}

function financeApprovalActiveQueueLinks(queue: AdminFinanceApprovalQueue, take: number) {
  const links = [
    { count: queue.summary.refundReadyCount, href: financeApprovalQueueHref(take, 'refunds', { review: 'ready' }), label: `Refunds ready ${queue.summary.refundReadyCount}` },
    { count: queue.summary.refundStateMismatchCount, href: financeApprovalQueueHref(take, 'refunds', { review: 'state-mismatch' }), label: `Refund repairs ${queue.summary.refundStateMismatchCount}` },
    { count: queue.summary.refundBlockedCount, href: financeApprovalQueueHref(take, 'refunds', { review: 'blocked' }), label: `Refunds blocked ${queue.summary.refundBlockedCount}` },
    { count: queue.summary.payoutBatchReadyCount, href: financeApprovalQueueHref(take, 'payouts', { review: 'ready' }), label: `Payouts ready ${queue.summary.payoutBatchReadyCount}` },
    { count: queue.summary.payoutBatchBlockedCount, href: financeApprovalQueueHref(take, 'payouts', { review: 'blocked' }), label: `Payouts blocked ${queue.summary.payoutBatchBlockedCount}` },
    { count: queue.summary.withdrawalOpenCount, href: financeApprovalQueueHref(take, 'withdrawals'), label: `Withdrawals ${queue.summary.withdrawalOpenCount}` },
    { count: queue.summary.walletAdjustmentPendingCount, href: financeApprovalQueueHref(take, 'wallet'), label: `Wallet ${queue.summary.walletAdjustmentPendingCount}` },
  ];
  return links.filter((link) => link.count > 0);
}

function legacyApprovalReconciliationHref(
  params: Record<string, string | string[] | undefined>,
  take: number,
) {
  const search = new URLSearchParams({ range: 'all', review: 'unmatched', workspace: 'operations' });
  const owner = readSearchParam(params.owner);
  if (owner === 'mine' || owner === 'unassigned') search.set('owner', owner);
  const sla = readSearchParam(params.sla);
  if (sla === 'over-24h' || sla === 'escalate') search.set('age', '48h');
  if (take === 25) search.set('take', '25');
  return `/finance-tax/bank-reconciliation?${search.toString()}`;
}

function buildFinanceApprovalConfirmation(
  queue: AdminFinanceApprovalQueue,
  action: FinanceApprovalConfirmationAction | null,
  requestId: string,
  cancelHref: string,
) {
  if (!action || !requestId) return null;
  if (action.endsWith('bank-account')) {
    const request = queue.companyBankAccountRequests.find(
      (item) => item.requestId === requestId,
    );
    if (!request || request.reviewState !== 'READY') return null;
    const isApprove = action === 'approve-bank-account';
    return {
      action: decideCompanyBankAccountRequest,
      actionName: action,
      cancelHref,
      confirmLabel: isApprove ? 'Approve change' : 'Reject request',
      description: isApprove
        ? `Approve the ${request.operation === 'CREATE' ? 'new' : 'updated'} ${request.proposed.name} company bank account. The exact proposed bank, masked account, currency, and status are applied atomically after this independent approval.`
        : `Reject the pending ${request.proposed.name} company bank account change without modifying the current account or any bank transaction, reconciliation, wallet, tax, or ledger record.`,
      evidenceRows: [
        { label: 'Request ID', value: request.requestId },
        { label: 'Subject', value: request.proposed.name },
        { label: 'Lifecycle', value: `${request.operation} · ${request.status} → ${request.proposed.status}` },
        { label: 'Maker', value: request.requestedBy.fullName ?? request.requestedBy.email ?? request.requestedBy.id },
        { label: 'Requested at', value: request.requestedAt },
        { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
        { label: 'Independent control', value: request.reviewState === 'READY' ? 'Passed' : 'Blocked' },
        { label: 'Bank evidence', value: `${request.proposed.bankName} · ${companyBankAccountMask(request.proposed)}` },
        { label: 'Snapshot time', value: queue.generatedAt },
      ],
      hiddenInputs: [
        { name: 'bankAccountId', value: request.id },
        { name: 'confirmationRequestId', value: requestId },
        { name: 'decision', value: isApprove ? 'APPROVE' : 'REJECT' },
        { name: 'redirectTo', value: cancelHref },
        { name: 'requestId', value: requestId },
      ],
      requestId,
      supportingLinks: [{
        href: '/finance-tax/company-bank-accounts',
        label: 'Open company bank accounts',
      }],
      textInputs: [{
        label: isApprove ? 'Approval reason' : 'Rejection reason',
        maxLength: 500,
        minLength: 12,
        name: 'operatorReason',
        placeholder: isApprove
          ? 'Record the evidence supporting this bank account approval.'
          : 'Explain why this bank account change must be rejected.',
        required: true,
      }],
      title: isApprove
        ? 'Approve company bank account change?'
        : 'Reject company bank account change?',
      tone: isApprove ? 'warning' as const : 'danger' as const,
    };
  }
  if (action === 'approve-withdrawal-paid') {
    const withdrawal = queue.withdrawalRequests.find((item) => item.id === requestId);
    if (
      !withdrawal ||
      withdrawal.status !== 'BANK_TRANSFER_PENDING' ||
      withdrawal.reviewState !== 'READY'
    ) {
      return null;
    }
    return {
      action: approveWithdrawalPaidCloseout,
      actionName: action,
      cancelHref,
      confirmLabel: 'Approve paid closeout',
      description: `${withdrawal.partnerName}: independently approve the ${formatMoney(withdrawal.amount, withdrawal.currency)} bank transfer. This posts the Partner wallet debit and balanced paid withdrawal journal exactly once.`,
      evidenceRows: [
        { label: 'Request ID', value: withdrawal.id },
        { label: 'Subject', value: withdrawal.partnerName },
        { label: 'Amount', value: formatMoney(withdrawal.amount, withdrawal.currency) },
        { label: 'Lifecycle', value: withdrawal.status },
        { label: 'Transfer reference', value: withdrawal.transferRef ?? 'Missing' },
        { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
        { label: 'Bank evidence', value: withdrawal.hasBankAccount ? 'Bank account linked' : 'Bank account missing' },
        { label: 'Primary blocker', value: approvalPreflightBlockerSummary(withdrawal.preflight) },
        { label: 'Wallet / debit impact', value: 'Partner wallet debit after paid closeout' },
        { label: 'GL / settlement / tax', value: 'Balanced paid withdrawal journal; no booking tax mutation' },
        { label: 'Snapshot time', value: queue.generatedAt },
      ],
      hiddenInputs: [
        { name: 'confirmationRequestId', value: requestId },
        { name: 'redirectTo', value: cancelHref },
        { name: 'requestId', value: requestId },
      ],
      requestId,
      supportingLinks: [{
        href: `/payouts?${new URLSearchParams({
          range: 'all',
          view: 'withdrawals',
          withdrawalId: withdrawal.id,
          withdrawalStatus: withdrawal.status,
        }).toString()}#withdrawal-${encodeURIComponent(withdrawal.id)}`,
        label: 'Open withdrawal evidence',
      }],
      textInputs: [],
      title: 'Approve Partner withdrawal paid closeout?',
      tone: 'warning' as const,
    };
  }
  if (action === 'approve-payout-paid') {
    const batch = queue.payoutBatchRequests.find((item) => item.id === requestId);
    if (!batch || batch.status !== 'PROCESSING' || batch.reviewState !== 'READY') {
      return null;
    }
    return {
      action: approvePayoutBatchPaidCloseout,
      actionName: action,
      cancelHref,
      confirmLabel: 'Approve paid closeout',
      description: `${batch.partnerName}: independently approve the ${formatMoney(batch.totalNetAmount, batch.currency)} payout batch. This marks linked earnings and withholding paid, posts the wallet debit, and creates the balanced payout journal exactly once.`,
      evidenceRows: [
        { label: 'Request ID', value: batch.id },
        { label: 'Subject', value: batch.partnerName },
        { label: 'Amount', value: formatMoney(batch.totalNetAmount, batch.currency) },
        { label: 'Lifecycle', value: batch.status },
        { label: 'Transfer reference', value: batch.transferRef ?? 'Missing' },
        { label: 'Maker', value: batch.paidCloseoutRequestedBy?.fullName ?? batch.paidCloseoutRequestedBy?.email ?? batch.paidCloseoutRequestedByAdminId ?? 'Unknown maker' },
        { label: 'Requested at', value: batch.createdAt },
        { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
        { label: 'Independent control', value: batch.reviewState === 'READY' ? 'Passed' : 'Blocked' },
        { label: 'Primary blocker', value: approvalPreflightBlockerSummary(batch.preflight) },
        { label: 'Wallet / debit impact', value: 'Partner wallet debit and linked earnings paid' },
        { label: 'GL / settlement / tax', value: 'Balanced payout journal and withholding closeout' },
        { label: 'Snapshot time', value: queue.generatedAt },
      ],
      hiddenInputs: [
        { name: 'confirmationRequestId', value: requestId },
        { name: 'redirectTo', value: cancelHref },
        { name: 'requestId', value: requestId },
      ],
      requestId,
      supportingLinks: [{
        href: `/payouts?${new URLSearchParams({
          payoutBatchId: batch.id,
          review: 'in-progress',
          workspace: 'operations',
        }).toString()}#payout-batch-${encodeURIComponent(batch.id)}`,
        label: 'Open payout evidence',
      }],
      textInputs: [],
      title: 'Approve payout batch paid closeout?',
      tone: 'warning' as const,
    };
  }
  const isRefund = action.endsWith('refund');
  const isDeposit = action.endsWith('deposit');
  const isApprove = action.startsWith('approve');
  const isCancel = action === 'cancel-wallet';
  if (isRefund) {
    const refund = queue.refundFocus?.request?.id === requestId
      ? queue.refundFocus.request
      : queue.refundRequests.find((item) => item.id === requestId);
    if (!refund || refund.reviewState !== 'READY') return null;
    return {
      action: isApprove ? approveRefundRequest : rejectRefundRequest,
      actionName: action,
      cancelHref,
      confirmLabel: isApprove ? 'Approve refund' : 'Reject request',
      description: isApprove
        ? `Approve the ${formatMoney(refund.amount, refund.currency)} ${humanizeStatus(refund.paymentMethod).toLowerCase()} refund for booking ${refund.bookingId}. The payment provider operation and accounting reversal start only after this independent approval.`
        : `Reject the ${formatMoney(refund.amount, refund.currency)} refund request for booking ${refund.bookingId} without changing payment, wallet, settlement, tax, or ledger balances.`,
      evidenceRows: [
        { label: 'Request ID', value: refund.id },
        { label: 'Booking / payment', value: `${refund.bookingId} · ${refund.paymentId}` },
        { label: 'Amount', value: formatMoney(refund.amount, refund.currency) },
        { label: 'Lifecycle', value: `Refund ${refund.status} · Payment ${refund.paymentStatus}` },
        { label: 'Maker', value: refund.requestedByAdminId ?? 'System request' },
        { label: 'Requested at', value: refund.requestedAt },
        { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
        { label: 'Independent control', value: refund.reviewState === 'READY' ? 'Passed' : 'Blocked' },
        { label: 'Primary blocker', value: refund.blockers.map((blocker) => blocker.message).join(' ') || 'None' },
        { label: 'Wallet / debit impact', value: 'No wallet debit; payment gateway refund on approval' },
        { label: 'GL / settlement / tax', value: 'Accounting reversal starts only after successful approval' },
        { label: 'Snapshot time', value: queue.generatedAt },
      ],
      hiddenInputs: [
        { name: 'confirmationRequestId', value: requestId },
        { name: 'redirectTo', value: cancelHref },
        { name: 'requestId', value: requestId },
        { name: 'paymentId', value: refund.paymentId },
      ],
      requestId,
      supportingLinks: [{
        href: `/payments/${encodeURIComponent(refund.paymentId)}`,
        label: 'Open payment',
      }],
      textInputs: isApprove
        ? []
        : [{
            label: 'Rejection reason',
            maxLength: 500,
            minLength: 12,
            name: 'reason',
            placeholder: 'Explain why this refund request must be rejected.',
            required: true,
          }],
      title: isApprove ? 'Approve customer payment refund?' : 'Reject payment refund request?',
      tone: isApprove ? 'warning' as const : 'danger' as const,
    };
  }
  const request = isDeposit
    ? queue.partnerBankDepositRequests.find((item) => item.id === requestId)
    : queue.walletAdjustmentRequests.find((item) => item.id === requestId);
  if (!request) return null;
  if (
    (isApprove && request.preflight?.canApprove === false) ||
    (isCancel && request.preflight?.canCancel !== true) ||
    (!isApprove && !isCancel && request.preflight?.canReject === false)
  ) {
    return null;
  }

  const hiddenInputs = [
    { name: 'confirmationRequestId', value: requestId },
    { name: 'redirectTo', value: cancelHref },
    { name: 'requestId', value: requestId },
  ];
  const textInputs = isApprove
    ? []
    : [{
        label: isCancel ? 'Cancellation reason' : 'Rejection reason',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: isCancel
          ? 'Explain why this stale request is being cancelled.'
          : 'Explain why this finance request must be rejected.',
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
      evidenceRows: [
        { label: 'Request ID', value: deposit.id },
        { label: 'Subject', value: deposit.partnerName },
        { label: 'Amount', value: formatMoney(deposit.amount, deposit.currency) },
        { label: 'Maker', value: deposit.requestedBy.fullName ?? deposit.requestedBy.email ?? deposit.requestedBy.id },
        { label: 'Requested at', value: deposit.createdAt },
        { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
        { label: 'Bank reference', value: `${deposit.bankTransactionId} · ${deposit.bankAccount ?? 'Account unavailable'}` },
        { label: 'Primary blocker', value: approvalPreflightBlockerSummary(deposit.preflight) },
        { label: 'Wallet / debit impact', value: `${formatMoney(deposit.requestedReceivableRecovery, deposit.currency)} receivable recovery · ${formatMoney(deposit.requestedWalletLiabilityIncrease, deposit.currency)} wallet liability` },
        { label: 'GL / settlement / tax', value: 'Balanced deposit journal; no tax mutation' },
        { label: 'Snapshot time', value: queue.generatedAt },
      ],
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
  if (isCancel) {
    return {
      action: cancelStaleWalletAdjustmentRequest,
      actionName: action,
      cancelHref,
      confirmLabel: 'Cancel stale request',
      description: `${adjustment.ownerName ?? adjustment.ownerId}: cancel this stale ${formatMoney(adjustment.amount, adjustment.currency)} wallet request because the live balance no longer matches ${formatMoney(adjustment.requestedBeforeBalance, adjustment.currency)}. This closes only the pending request and does not change wallet, bank, cash, tax, or accounting ledgers.`,
      evidenceRows: walletAdjustmentConfirmationEvidence(queue, adjustment),
      hiddenInputs,
      requestId,
      supportingLinks: [{ href: '/wallet-adjustments?view=records', label: 'Open wallet records' }],
      textInputs,
      title: 'Cancel stale wallet adjustment request?',
      tone: 'warning' as const,
    };
  }
  return {
    action: isApprove ? approveWalletAdjustmentRequest : rejectWalletAdjustmentRequest,
    actionName: action,
    cancelHref,
    confirmLabel: isApprove ? 'Approve & execute' : 'Reject request',
    description: isApprove
      ? `${adjustment.ownerName ?? adjustment.ownerId}: approve ${formatMoney(adjustment.amount, adjustment.currency)} ${humanizeStatus(adjustment.direction).toLowerCase()}. The live balance is revalidated before wallet and balanced GL entries move it from ${formatMoney(adjustment.requestedBeforeBalance, adjustment.currency)} to ${formatMoney(adjustment.requestedAfterBalance, adjustment.currency)}.`
      : `${adjustment.ownerName ?? adjustment.ownerId}: reject this ${formatMoney(adjustment.amount, adjustment.currency)} wallet request without changing wallet, bank, cash, tax, or ledger balances.`,
    evidenceRows: walletAdjustmentConfirmationEvidence(queue, adjustment),
    hiddenInputs,
    requestId,
    supportingLinks: [{ href: '/wallet-adjustments?view=records', label: 'Open wallet records' }],
    textInputs,
    title: isApprove ? 'Approve and execute wallet adjustment?' : 'Reject wallet adjustment request?',
    tone: isApprove ? 'warning' as const : 'danger' as const,
  };
}

function FinanceApprovalEvidenceSnapshot({
  description,
  rows,
}: {
  readonly description: string;
  readonly rows: readonly { readonly label: string; readonly value: string | null | undefined }[];
}) {
  return (
    <div className="finance-approval-confirmation-evidence">
      <p>{description}</p>
      <dl>
        {rows.map((row) => {
          const value = row.value || 'Not available';
          return (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {(row.label === 'Requested at' || row.label === 'Snapshot time') && row.value
                  ? <DateTimeText value={row.value} />
                  : value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function walletAdjustmentConfirmationEvidence(
  queue: AdminFinanceApprovalQueue,
  adjustment: AdminFinanceApprovalQueue['walletAdjustmentRequests'][number],
) {
  return [
    { label: 'Request ID', value: adjustment.id },
    { label: 'Subject', value: `${adjustment.ownerName ?? adjustment.ownerId} · ${adjustment.ownerType}` },
    { label: 'Amount', value: formatMoney(adjustment.amount, adjustment.currency) },
    { label: 'Lifecycle', value: adjustment.reviewState },
    { label: 'Maker', value: adjustment.requestedBy?.fullName ?? adjustment.requestedBy?.email ?? adjustment.requestedByAdminId ?? 'Unknown maker' },
    { label: 'Requested at', value: adjustment.createdAt },
    { label: 'Current approver', value: adminOperatorLabel(queue.currentApprover) },
    { label: 'Independent control', value: adjustment.preflight?.canApprove ? 'Passed' : 'Blocked' },
    { label: 'Primary blocker', value: approvalPreflightBlockerSummary(adjustment.preflight) },
    { label: 'Wallet / debit impact', value: `${formatMoney(adjustment.requestedBeforeBalance, adjustment.currency)} → ${formatMoney(adjustment.requestedAfterBalance, adjustment.currency)}` },
    { label: 'GL / settlement / tax', value: 'Balanced wallet journal on execution; monthly close is revalidated' },
    { label: 'Snapshot time', value: queue.generatedAt },
  ];
}

function adminOperatorLabel(operator?: { id: string; email?: string | null; fullName?: string | null } | null) {
  return operator?.fullName ?? operator?.email ?? operator?.id ?? 'No eligible Finance approver in this session';
}

function approvalPreflightBlockerSummary(preflight?: { blockers?: Array<{ message: string }> }) {
  return preflight?.blockers?.map((blocker) => blocker.message).join(' ') || 'None';
}

function walletAdjustmentPrimaryBlocker(
  request: AdminFinanceApprovalQueue['walletAdjustmentRequests'][number],
) {
  if (request.reviewState === 'STALE') return 'Wallet balance changed';
  const blocker = request.preflight?.blockers?.[0]?.message;
  if (blocker) return blocker;
  if (request.requiresAttachment && !request.attachmentUrl) return 'Required evidence missing';
  return request.reviewState === 'READY' ? 'None' : 'Independent approver required';
}

function FinanceApprovalPreflightStatus({
  preflight,
}: {
  readonly preflight?: AdminFinanceApprovalRequestPreflight;
}) {
  if (!preflight) return null;
  const evidence = preflight.ready ? preflight.warnings : preflight.blockers;
  return (
    <div className="admin-mt-8">
      <StatusBadge tone={preflight.ready ? (preflight.warnings.length ? 'warning' : 'success') : 'danger'}>
        {preflight.ready
          ? preflight.warnings.length
            ? 'Ready with review'
            : 'Server preflight ready'
          : `${preflight.blockers.length} blocker(s)`}
      </StatusBadge>
      {evidence.length ? <div className="muted">{evidence.map((item) => item.message).join(' ')}</div> : null}
    </div>
  );
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function approvalQueueCardScope(count: number, activeScope: string) {
  return count > 0 ? activeScope : 'Clear';
}

function normalizeFinanceApprovalWalletReview(value: string): FinanceApprovalWalletReview {
  return value === 'ready' || value === 'blocked' || value === 'stale' ? value : 'all';
}

function walletReviewCount(
  summary: AdminFinanceApprovalQueue['summary'],
  review: FinanceApprovalWalletReview,
) {
  if (review === 'ready') return summary.walletAdjustmentReadyCount;
  if (review === 'blocked') return summary.walletAdjustmentBlockedCount;
  if (review === 'stale') return summary.walletAdjustmentStaleCount;
  return summary.walletAdjustmentPendingCount;
}

function walletReviewLabel(review: FinanceApprovalWalletReview) {
  if (review === 'ready') return 'ready';
  if (review === 'blocked') return 'blocked';
  if (review === 'stale') return 'stale';
  return 'pending';
}

function walletAdjustmentCardScope(summary: AdminFinanceApprovalQueue['summary']) {
  if (summary.walletAdjustmentReadyCount > 0) return 'Ready now';
  if (summary.walletAdjustmentStaleCount > 0) return 'Stale requests';
  if (summary.walletAdjustmentBlockedCount > 0) return 'Blocked';
  return 'Clear';
}

function walletAdjustmentCardTone(
  summary: AdminFinanceApprovalQueue['summary'],
): StatusBadgeTone {
  if (summary.walletAdjustmentStaleCount > 0) return 'danger';
  if (summary.walletAdjustmentReadyCount > 0) return 'warning';
  if (summary.walletAdjustmentBlockedCount > 0) return 'neutral';
  return 'success';
}

function walletReviewResultTone(
  summary: AdminFinanceApprovalQueue['summary'],
  review: FinanceApprovalWalletReview,
): StatusBadgeTone {
  const count = walletReviewCount(summary, review);
  if (count === 0) return 'success';
  if (review === 'stale') return 'danger';
  if (review === 'blocked') return 'neutral';
  return 'warning';
}

function walletAdjustmentReviewTone(
  state: AdminFinanceApprovalQueue['walletAdjustmentRequests'][number]['reviewState'],
): StatusBadgeTone {
  if (state === 'READY') return 'success';
  if (state === 'STALE') return 'danger';
  return 'neutral';
}

function walletAdjustmentReviewLabel(
  state: AdminFinanceApprovalQueue['walletAdjustmentRequests'][number]['reviewState'],
) {
  if (state === 'READY') return 'Ready';
  if (state === 'STALE') return 'Stale';
  return 'Blocked';
}

function humanizeStatus(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function companyBankAccountMask(value: {
  readonly accountNumberLast4?: string | null;
  readonly accountNumberMasked?: string | null;
}) {
  return value.accountNumberMasked ?? (
    value.accountNumberLast4 ? `•••• ${value.accountNumberLast4}` : 'Masked account unavailable'
  );
}

function withdrawalTone(status: string): StatusBadgeTone {
  if (status === 'BANK_TRANSFER_PENDING' || status === 'REQUESTED') return 'warning';
  if (status === 'REVIEW_REQUIRED' || status === 'NEEDS_BANK_CORRECTION' || status === 'HOLD') return 'danger';
  return 'info';
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
  if (value === 'cancelled') {
    return {
      badge: 'Cancelled',
      detail: 'The stale request was closed by its maker without changing wallet, bank, cash, tax, or accounting ledgers.',
      title: 'Stale wallet request cancelled',
      tone: 'success' as const,
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
  if (value === 'state-mismatch') {
    return {
      badge: 'State changed',
      detail: 'The refund was not changed. Its payment or refund lifecycle no longer matches this snapshot. Open the payment timeline, verify the latest state, then refresh the queue.',
      title: 'Refund state must be reviewed again',
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
