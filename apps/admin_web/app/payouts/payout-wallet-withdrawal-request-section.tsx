import {
  AdminDataTable,
  AdminTablePaginationFooter,
  AdminTableScroll,
} from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import {
  AdminFinanceOperatorEvidence,
  adminWithdrawalOperatorEvidenceLines,
} from '../../components/admin-finance-operator-evidence';
import { AdminInlineActionForm } from '../../components/admin-inline-action-form';
import { AdminInlineFallback } from '../../components/admin-inline-fallback';
import { AdminInlineNotice } from '../../components/admin-inline-notice';
import {
  AdminFormControlButton,
  AdminFormDateTime,
  AdminFormInput,
} from '../../components/admin-form-controls';
import { AdminSummaryCardGrid } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import { shortRecordId } from '../../lib/admin-format';
import type {
  AdminProviderWalletWithdrawalRequest,
  AdminProviderWalletWithdrawalRequestSummary,
  AdminProviderWalletWithdrawalRequestStatus,
} from '../../lib/admin-api';
import { adminWorkflowStatusLabel } from '../../lib/admin-copy';
import { providerWalletWithdrawalStatusChangeView } from '../../lib/provider-wallet-withdrawal-status-change';
import type { PayoutServerPagination } from './payouts-page-model';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutWalletWithdrawalRequestSectionProps = {
  readonly activeReconciliation?: 'unmatched' | 'matched' | null;
  readonly activeStatus?: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly pagination?: PayoutServerPagination<AdminProviderWalletWithdrawalRequest> | null;
  readonly paginationHrefForPage?: (page: number) => string;
  readonly range?: string;
  readonly reconciliationHrefForView?: (reconciliation: 'unmatched' | 'matched') => string;
  readonly requests: readonly AdminProviderWalletWithdrawalRequest[];
  readonly reverseHrefForRequest?: (requestId: string) => string;
  readonly summary?: AdminProviderWalletWithdrawalRequestSummary | null;
  readonly savedView?: {
    readonly clearHref: string;
    readonly label: string;
    readonly resultCount: number;
  } | null;
  readonly statusHrefForView?: (status: AdminProviderWalletWithdrawalRequestStatus) => string;
  readonly updateWithdrawalRequestAction: FormAction;
};

const headers = ['Partner / bank', 'Amount', 'Status / age', 'Evidence', 'Action'] as const;

export function PayoutWalletWithdrawalRequestSection({
  activeReconciliation = null,
  activeStatus = null,
  pagination = null,
  paginationHrefForPage,
  range = 'today',
  reconciliationHrefForView,
  requests,
  reverseHrefForRequest,
  summary: serverSummary = null,
  savedView = null,
  statusHrefForView,
  updateWithdrawalRequestAction,
}: PayoutWalletWithdrawalRequestSectionProps) {
  const visibleReconciliationNeedsActionCount = requests.filter(
    (request) => request.status === 'PAID' && request.reconciliationState === 'UNMATCHED',
  ).length;
  const reconciliationNeedsActionCount =
    activeReconciliation === 'unmatched'
      ? (serverSummary?.filteredTotal ?? visibleReconciliationNeedsActionCount)
      : activeReconciliation === null
        ? (serverSummary?.paidUnreconciled ?? visibleReconciliationNeedsActionCount)
        : visibleReconciliationNeedsActionCount;
  const needsActionCount = serverSummary
    ? serverSummary.requested + serverSummary.reviewRequired + serverSummary.bankTransferPending
    : requests.filter((request) => !isTerminalStatus(request.status)).length;
  const visibleSummary = buildWithdrawalRequestSummary(requests);
  const paidUnreconciled = serverSummary?.paidUnreconciled ?? 0;

  return (
    <AdminTablePanel
      className="payout-wallet-withdrawal-request-section admin-mb-16"
      description="Partner wallet withdrawal requests from the partner app. Finance can request bank correction, approve, reject, or mark paid after manual bank transfer."
      id="partner-wallet-withdrawal-requests"
      resultLabel={
        savedView
          ? requests.length === 0
            ? 'No rows in selected filter'
            : activeReconciliation === 'unmatched'
              ? `${savedView.resultCount} bank match pending`
              : `${savedView.resultCount} in selected filter`
          : reconciliationNeedsActionCount
          ? `${reconciliationNeedsActionCount} bank match pending`
          : needsActionCount
            ? `${needsActionCount} needs action`
            : 'No current withdrawal work'
      }
      resultTone={
        savedView
          ? activeReconciliation === 'unmatched' && savedView.resultCount > 0
            ? 'warning'
            : 'neutral'
          : reconciliationNeedsActionCount || needsActionCount
            ? 'warning'
            : 'neutral'
      }
      title="Partner wallet withdrawal requests"
    >
      {savedView ? (
        <div aria-label="Saved withdrawal request view" className="payout-withdrawal-saved-view">
          <span>Saved view</span>
          <strong>{savedView.label}</strong>
          <small>
            {savedView.resultCount} {savedView.resultCount === 1 ? 'request' : 'requests'} in this view
          </small>
          <AdminTextLink href={savedView.clearHref}>Clear saved view</AdminTextLink>
        </div>
      ) : null}
      <AdminSummaryCardGrid
        ariaLabel="Withdrawal request status summary"
        className="payout-wallet-withdrawal-summary-grid"
        itemClassName="payout-wallet-withdrawal-summary-card"
        items={[
          {
            ariaCurrent: activeReconciliation === 'unmatched' ? 'page' : undefined,
            className: activeReconciliation === 'unmatched' ? 'is-active' : undefined,
            detail: activeReconciliation === 'unmatched' ? 'Selected' : 'Open action queue',
            href: reconciliationHrefForView?.('unmatched') ?? withdrawalReconciliationHref(range, 'unmatched'),
            label: 'Paid / bank match pending',
            tone: paidUnreconciled > 0 ? 'warning' : 'success',
            value: paidUnreconciled,
          },
          {
            ariaCurrent: activeStatus === 'REQUESTED' ? 'page' : undefined,
            className: activeStatus === 'REQUESTED' ? 'is-active' : undefined,
            detail: activeStatus === 'REQUESTED' ? 'Selected' : 'Open filter',
            href: statusHrefForView?.('REQUESTED') ?? withdrawalStatusHref(range, 'REQUESTED'),
            label: 'Requested',
            tone: 'neutral',
            value: serverSummary?.requested ?? visibleSummary.requested,
          },
          {
            ariaCurrent: activeStatus === 'REVIEW_REQUIRED' ? 'page' : undefined,
            className: activeStatus === 'REVIEW_REQUIRED' ? 'is-active' : undefined,
            detail: activeStatus === 'REVIEW_REQUIRED' ? 'Selected' : 'Open filter',
            href: statusHrefForView?.('REVIEW_REQUIRED') ?? withdrawalStatusHref(range, 'REVIEW_REQUIRED'),
            label: 'Review required',
            tone: 'warning',
            value: serverSummary?.reviewRequired ?? visibleSummary.reviewRequired,
          },
          {
            ariaCurrent: activeStatus === 'BANK_TRANSFER_PENDING' ? 'page' : undefined,
            className: activeStatus === 'BANK_TRANSFER_PENDING' ? 'is-active' : undefined,
            detail: activeStatus === 'BANK_TRANSFER_PENDING' ? 'Selected' : 'Open filter',
            href: statusHrefForView?.('BANK_TRANSFER_PENDING') ?? withdrawalStatusHref(range, 'BANK_TRANSFER_PENDING'),
            label: 'Bank transfer pending',
            tone: 'info',
            value: serverSummary?.bankTransferPending ?? visibleSummary.bankTransferPending,
          },
        ]}
      >
        <span className="sr-only">Withdrawal request status summary</span>
      </AdminSummaryCardGrid>
      {requests.length === 0 ? (
        <PayoutWalletWithdrawalRequestEmptyState />
      ) : (
        <AdminTableScroll ariaLabel="Partner wallet withdrawal requests table">
          <AdminDataTable
            className="vuexy-booking-table payout-withdrawal-compact-table"
            emptyMessage="No withdrawal requests found."
            headers={headers}
            rowCount={requests.length}
          >
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <AdminTextLink href={`/partners/${request.providerProfileId}?section=full#finance`}>
                  {partnerLabel(request)}
                </AdminTextLink>
                {request.providerProfile?.user?.phone ? (
                  <p className="muted">{request.providerProfile.user.phone}</p>
                ) : (
                  <AdminInlineFallback className="admin-mt-6">No phone on file</AdminInlineFallback>
                )}
                <div className="admin-mt-8">
                  <strong>{request.bankAccount?.bankName ?? 'Bank not linked'}</strong>
                  <p className="muted">{bankAccountLabel(request)}</p>
                </div>
              </td>
              <td>
                <strong>
                  <MoneyText amount={request.amount} currency={request.currency} />
                </strong>
                <p className="muted">Request {shortRecordId(request.id)}</p>
              </td>
              <td>
                <StatusBadge tone={statusBadgeTone(request.status)}>{statusLabel(request.status)}</StatusBadge>
                <p className="muted admin-mt-6">Requested <DateTimeText value={request.createdAt} /></p>
                {request.reviewedAt ? (
                  <p className="muted">
                    Reviewed <DateTimeText value={request.reviewedAt} />
                  </p>
                ) : null}
              </td>
              <td>
                {request.status === 'PAID' ? <WithdrawalReconciliationEvidence request={request} /> : null}
                <AdminFinanceOperatorEvidence lines={adminWithdrawalOperatorEvidenceLines(request)} />
                <WithdrawalStatusChangeEvidence request={request} />
                {request.correctionReason ? <p className="muted">{request.correctionReason}</p> : null}
                {request.transferRef ? <p className="muted">Ref {request.transferRef}</p> : null}
              </td>
              <td>
                {isTerminalStatus(request.status) ? (
                  <WithdrawalRequestActions
                    request={request}
                    reverseHref={reverseHrefForRequest?.(request.id)}
                    updateWithdrawalRequestAction={updateWithdrawalRequestAction}
                  />
                ) : (
                  <details
                    aria-label={`Review withdrawal ${shortRecordId(request.id)}`}
                    className="payout-withdrawal-row-actions"
                  >
                    <summary>Review request</summary>
                    <div className="admin-mt-8">
                      <WithdrawalRequestActions
                        request={request}
                        reverseHref={reverseHrefForRequest?.(request.id)}
                        updateWithdrawalRequestAction={updateWithdrawalRequestAction}
                      />
                    </div>
                  </details>
                )}
              </td>
            </tr>
          ))}
          </AdminDataTable>
        </AdminTableScroll>
      )}
      {pagination && paginationHrefForPage ? (
        <AdminTablePaginationFooter
          activePage={pagination.page}
          ariaLabel="Partner wallet withdrawal reconciliation pages"
          from={pagination.from}
          hrefForPage={paginationHrefForPage}
          itemLabel="withdrawals"
          to={pagination.to}
          totalPages={pagination.totalPages}
          totalRows={pagination.totalRows}
        />
      ) : null}
    </AdminTablePanel>
  );
}

function buildWithdrawalRequestSummary(requests: readonly AdminProviderWalletWithdrawalRequest[]) {
  return requests.reduce(
    (summary, request) => {
      if (request.status === 'REQUESTED') {
        summary.requested += 1;
      }
      if (request.status === 'REVIEW_REQUIRED') {
        summary.reviewRequired += 1;
      }
      if (request.status === 'BANK_TRANSFER_PENDING') {
        summary.bankTransferPending += 1;
      }
      const statusChange = providerWalletWithdrawalStatusChangeView(request.metadata);
      if (statusChange?.lockedAmountReleased) {
        summary.lockReleased += 1;
      }
      return summary;
    },
    {
      bankTransferPending: 0,
      lockReleased: 0,
      requested: 0,
      reviewRequired: 0,
    },
  );
}

function withdrawalStatusHref(range: string, status: AdminProviderWalletWithdrawalRequestStatus) {
  return `/payouts?${new URLSearchParams({ range, withdrawalStatus: status }).toString()}#partner-wallet-withdrawal-requests`;
}

function withdrawalReconciliationHref(range: string, reconciliation: 'unmatched' | 'matched') {
  return `/payouts?${new URLSearchParams({
    range,
    withdrawalReconciliation: reconciliation,
    withdrawalStatus: 'PAID',
  }).toString()}#partner-wallet-withdrawal-requests`;
}

function WithdrawalRequestActions({
  request,
  reverseHref,
  updateWithdrawalRequestAction,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
  readonly reverseHref?: string;
  readonly updateWithdrawalRequestAction: FormAction;
}) {
  if (request.status === 'PAID') {
    return (
      <div className="admin-inline-action-stack">
        <span className="muted">
          Paid <DateTimeText fallback="No paid date" value={request.paidAt} />
        </span>
        {request.reconciliationState === 'MATCHED' && request.bankReconciliationMatch ? (
          <AdminTextLink
            href={`/finance-tax/bank-reconciliation/${encodeURIComponent(
              request.bankReconciliationMatch.bankTransactionId,
            )}`}
          >
            Open bank match
          </AdminTextLink>
        ) : (
          <AdminTextLink href={withdrawalBankReconciliationHref(request)}>
            Match bank evidence
          </AdminTextLink>
        )}
        <AdminTextLink
          href={`/finance-tax/general-ledger?${new URLSearchParams({ q: request.id }).toString()}`}
        >
          Open withdrawal journal
        </AdminTextLink>
        {request.preflight?.canReversePaid && reverseHref ? (
          <AdminTextLink href={reverseHref}>Review paid reversal</AdminTextLink>
        ) : null}
      </div>
    );
  }
  if (
    request.status === 'REJECTED' ||
    request.status === 'CANCELLED' ||
    request.status === 'FAILED' ||
    request.status === 'REVERSED'
  ) {
    if (request.status === 'REVERSED') {
      const reversal = withdrawalReversalEvidence(request.metadata);
      return (
        <div className="admin-inline-action-stack">
          <StatusBadge tone="danger">Reversed to Partner wallet</StatusBadge>
          {reversal?.reference ? <strong>{reversal.reference}</strong> : null}
          {reversal?.reason ? <p className="muted">{reversal.reason}</p> : null}
          {reversal?.occurredAt ? (
            <span className="muted">
              Reversed <DateTimeText value={reversal.occurredAt} />
            </span>
          ) : null}
          <AdminTextLink
            href={`/finance-tax/general-ledger?${new URLSearchParams({ q: request.id }).toString()}`}
          >
            Open reversal journal
          </AdminTextLink>
        </div>
      );
    }
    return <span className="muted">Closed</span>;
  }
  if (request.status === 'NEEDS_BANK_CORRECTION') {
    return (
      <div className="admin-inline-action-stack">
        <StatusBadge tone="warning">Waiting for partner bank correction</StatusBadge>
        <p className="muted">
          Partner must update bank details in the Partner app before finance can approve this withdrawal.
        </p>
      </div>
    );
  }
  return (
    <div className="admin-inline-action-stack">
      {request.preflight ? (
        <WithdrawalPreflightStatus request={request} />
      ) : null}
      {request.status === 'HOLD' || request.status === 'REVIEW_REQUIRED' ? (
        <>
          <StatusBadge tone="warning">Finance review required before payout</StatusBadge>
          <p className="muted">Resolve the review flag before moving this request to a bank payout run.</p>
        </>
      ) : null}

      {(request.status === 'REQUESTED' ||
        request.status === 'HOLD' ||
        request.status === 'REVIEW_REQUIRED') &&
      request.preflight?.canApprove !== false ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="APPROVED" />
          <AdminFormInput
            label={`Approval note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder={request.status === 'REQUESTED' ? 'Approval note' : 'Review resolution note'}
            type="text"
          />
          <AdminFormControlButton className="button-sm button-primary" type="submit">
            {request.status === 'REQUESTED' ? 'Approve' : 'Clear review'}
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {request.status === 'APPROVED' &&
      request.preflight?.canMarkBankTransferPending !== false ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="BANK_TRANSFER_PENDING" />
          <AdminFormInput
            label={`Transfer reference for ${partnerLabel(request)}`}
            name="transferRef"
            placeholder="Bank transfer ref"
            required
            type="text"
          />
          <AdminFormDateTime
            label={`Bank transfer date for ${partnerLabel(request)}`}
            name="bankTransferDate"
            required
          />
          <AdminFormInput
            label={`Bank transfer evidence URL for ${partnerLabel(request)}`}
            name="attachmentUrl"
            placeholder="Private evidence URL"
            required
            type="url"
          />
          <AdminFormInput
            label={`Transfer note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder="Bank payout run note"
            type="text"
          />
          <AdminFormControlButton className="button-sm button-info" type="submit">
            Submit transfer for approval
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {request.status === 'BANK_TRANSFER_PENDING' ? (
        <StatusBadge tone="info">Paid closeout approval pending</StatusBadge>
      ) : null}

      {request.status === 'BANK_TRANSFER_PENDING' && request.preflight?.canMarkPaid ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="PAID" />
          <AdminFormControlButton
            className="button-sm button-success"
            type="submit"
          >
            Approve paid closeout
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {request.status === 'REQUESTED' ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="NEEDS_BANK_CORRECTION" />
          <AdminFormInput
            label={`Bank correction reason for ${partnerLabel(request)}`}
            name="correctionReason"
            placeholder="Bank correction reason"
            required
            type="text"
          />
          <AdminFormControlButton className="button-sm button-outline" type="submit">
            Request correction
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {(request.status === 'REQUESTED' ||
        request.status === 'APPROVED' ||
        request.status === 'BANK_TRANSFER_PENDING' ||
        request.status === 'HOLD' ||
        request.status === 'REVIEW_REQUIRED') &&
      request.preflight?.canReject !== false ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="REJECTED" />
          <AdminFormInput
            label={`Reject note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder="Reject note"
            type="text"
          />
          <AdminFormControlButton className="button-sm button-danger" type="submit">
            Reject
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}
    </div>
  );
}

function WithdrawalPreflightStatus({
  request,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
}) {
  const preflight = request.preflight;
  if (!preflight) return null;
  const messages = preflight.blockers.length ? preflight.blockers : preflight.warnings;
  if (messages.length === 0) {
    return <StatusBadge tone="success">Server preflight ready</StatusBadge>;
  }
  return (
    <AdminInlineNotice role="status" tone={preflight.blockers.length ? 'danger' : 'warning'}>
      {messages.map((message) => message.message).join(' ')}
    </AdminInlineNotice>
  );
}

function withdrawalReversalEvidence(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const reversal = Reflect.get(metadata, 'reversal');
  if (!reversal || typeof reversal !== 'object' || Array.isArray(reversal)) return null;
  const reference = Reflect.get(reversal, 'reversalReference');
  const reason = Reflect.get(reversal, 'reason');
  const occurredAt = Reflect.get(reversal, 'occurredAt');
  return {
    occurredAt: typeof occurredAt === 'string' ? occurredAt : null,
    reason: typeof reason === 'string' ? reason : null,
    reference: typeof reference === 'string' ? reference : null,
  };
}

function withdrawalBankReconciliationHref(request: AdminProviderWalletWithdrawalRequest) {
  const params = new URLSearchParams({ range: '30d', review: 'unmatched' });
  const transferRef = request.transferRef?.trim();
  if (transferRef) {
    params.set('q', transferRef);
  }
  return `/finance-tax/bank-reconciliation?${params.toString()}`;
}

function WithdrawalReconciliationEvidence({
  request,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
}) {
  if (request.reconciliationState === 'MATCHED') {
    return (
      <p className="admin-mt-6">
        <StatusBadge tone="success">Bank reconciled</StatusBadge>
      </p>
    );
  }

  return (
    <p className="admin-mt-6">
      <StatusBadge tone="warning">Bank match pending</StatusBadge>
    </p>
  );
}

function PayoutWalletWithdrawalRequestEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="No partner wallet withdrawal request is visible in the current payout window."
      title="No withdrawal requests found"
    />
  );
}

function partnerLabel(request: AdminProviderWalletWithdrawalRequest) {
  return (
    request.providerProfile?.displayName ??
    request.providerProfile?.user?.fullName ??
    request.providerProfile?.user?.phone ??
    'Unknown partner'
  );
}

function bankAccountLabel(request: AdminProviderWalletWithdrawalRequest) {
  if (!request.bankAccount) {
    return 'Partner bank account is missing';
  }
  const accountNumber =
    request.bankAccount.accountNumberMasked ??
    (request.bankAccount.accountNumberLast4 ? `****${request.bankAccount.accountNumberLast4}` : null);
  return [request.bankAccount.accountHolderName, accountNumber, request.bankAccount.status]
    .filter(Boolean)
    .join(' / ');
}

function statusLabel(status: AdminProviderWalletWithdrawalRequest['status']) {
  return adminWorkflowStatusLabel(status);
}

function statusBadgeTone(status: AdminProviderWalletWithdrawalRequest['status']): StatusBadgeTone {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'APPROVED':
    case 'BANK_TRANSFER_PENDING':
      return 'info';
    case 'NEEDS_BANK_CORRECTION':
    case 'REVIEW_REQUIRED':
    case 'HOLD':
      return 'warning';
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAILED':
    case 'REVERSED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function WithdrawalStatusChangeEvidence({
  request,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
}) {
  const statusChange = providerWalletWithdrawalStatusChangeView(request.metadata);
  if (!statusChange) {
    return null;
  }

  const lockLabel = statusChange.lockedAmountReleased
    ? 'Lock released'
    : statusChange.lockedAmountRetained
      ? 'Lock retained'
      : 'Status changed';

  return (
    <p className="muted">
      {statusChange.transitionLabel} / {lockLabel}
      {typeof statusChange.evidenceAmount === 'number' ? (
        <>
          {' '}
          <MoneyText amount={statusChange.evidenceAmount} currency={request.currency} />
        </>
      ) : null}
    </p>
  );
}

function isTerminalStatus(status: AdminProviderWalletWithdrawalRequest['status']) {
  return (
    status === 'PAID' ||
    status === 'REJECTED' ||
    status === 'CANCELLED' ||
    status === 'FAILED' ||
    status === 'REVERSED'
  );
}
