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
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { AdminSummaryCardGrid } from '../../components/admin-overview-card';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminTextLink } from '../../components/admin-text-link';
import { AdminWithdrawalAccountingPreview } from '../../components/admin-withdrawal-accounting-preview';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import { shortRecordId } from '../../lib/admin-format';
import type {
  AdminProviderWalletWithdrawalRequest,
  AdminProviderWalletWithdrawalRequestSummary,
  AdminProviderWalletWithdrawalRequestStatus,
} from '../../lib/admin-api';
import { providerWalletWithdrawalStatusChangeView } from '../../lib/provider-wallet-withdrawal-status-change';
import type { PayoutServerPagination } from './payouts-page-model';
import type { FinanceApproverOption } from '../finance-tax/finance-approver-options';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutWalletWithdrawalRequestSectionProps = {
  readonly activeReconciliation?: 'unmatched' | 'matched' | null;
  readonly activeStatus?: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly financeApproverOptions?: readonly FinanceApproverOption[];
  readonly pagination?: PayoutServerPagination<AdminProviderWalletWithdrawalRequest> | null;
  readonly paginationHrefForPage?: (page: number) => string;
  readonly range?: string;
  readonly requests: readonly AdminProviderWalletWithdrawalRequest[];
  readonly summary?: AdminProviderWalletWithdrawalRequestSummary | null;
  readonly updateWithdrawalRequestAction: FormAction;
};

const headers = ['Partner', 'Amount', 'Bank account', 'Status', 'Requested', 'Action'] as const;

export function PayoutWalletWithdrawalRequestSection({
  activeReconciliation = null,
  activeStatus = null,
  financeApproverOptions = [],
  pagination = null,
  paginationHrefForPage,
  range = 'today',
  requests,
  summary: serverSummary = null,
  updateWithdrawalRequestAction,
}: PayoutWalletWithdrawalRequestSectionProps) {
  const reconciliationNeedsActionCount = requests.filter(
    (request) => request.status === 'PAID' && request.reconciliationState === 'UNMATCHED',
  ).length;
  const needsActionCount = requests.filter((request) => !isTerminalStatus(request.status)).length;
  const hasPaidCloseoutAction = requests.some(
    (request) => request.status === 'APPROVED' || request.status === 'BANK_TRANSFER_PENDING',
  );
  const visibleSummary = buildWithdrawalRequestSummary(requests);
  const paidUnreconciled = serverSummary?.paidUnreconciled ?? 0;
  const paidReconciled = serverSummary?.paidReconciled ?? 0;

  return (
    <AdminTablePanel
      className="payout-wallet-withdrawal-request-section admin-mb-16"
      description="Partner wallet withdrawal requests from the partner app. Finance can request bank correction, approve, reject, or mark paid after manual bank transfer."
      id="partner-wallet-withdrawal-requests"
      resultLabel={
        reconciliationNeedsActionCount
          ? `${reconciliationNeedsActionCount} bank match pending`
          : needsActionCount
            ? `${needsActionCount} needs action`
            : 'Clear'
      }
      resultTone={reconciliationNeedsActionCount || needsActionCount ? 'warning' : 'success'}
      title="Partner wallet withdrawal requests"
    >
      {hasPaidCloseoutAction && financeApproverOptions.length === 0 ? (
        <AdminInlineNotice className="admin-mb-12" role="alert" tone="warning">
          No other Finance approver is available. Paid closeout remains disabled until another operator has the FINANCE_APPROVER role.
        </AdminInlineNotice>
      ) : null}
      <AdminSummaryCardGrid
        ariaLabel="Withdrawal request status summary"
        className="payout-wallet-withdrawal-summary-grid"
        itemClassName="payout-wallet-withdrawal-summary-card"
        items={[
          {
            className: activeReconciliation === 'unmatched' ? 'is-active' : undefined,
            detail: activeReconciliation === 'unmatched' ? 'Selected' : 'Open action queue',
            href: withdrawalReconciliationHref(range, 'unmatched'),
            label: 'Paid / bank match pending',
            tone: paidUnreconciled > 0 ? 'warning' : 'success',
            value: paidUnreconciled,
          },
          {
            className: activeReconciliation === 'matched' ? 'is-active' : undefined,
            detail: activeReconciliation === 'matched' ? 'Selected' : 'Open records',
            href: withdrawalReconciliationHref(range, 'matched'),
            label: 'Paid / reconciled',
            tone: 'success',
            value: paidReconciled,
          },
          {
            className: activeStatus === 'REQUESTED' ? 'is-active' : undefined,
            detail: activeStatus === 'REQUESTED' ? 'Selected' : 'Open filter',
            href: withdrawalStatusHref(range, 'REQUESTED'),
            label: 'Requested',
            tone: 'neutral',
            value: visibleSummary.requested,
          },
          {
            className: activeStatus === 'REVIEW_REQUIRED' ? 'is-active' : undefined,
            detail: activeStatus === 'REVIEW_REQUIRED' ? 'Selected' : 'Open filter',
            href: withdrawalStatusHref(range, 'REVIEW_REQUIRED'),
            label: 'Review required',
            tone: 'warning',
            value: visibleSummary.reviewRequired,
          },
          {
            className: activeStatus === 'BANK_TRANSFER_PENDING' ? 'is-active' : undefined,
            detail: activeStatus === 'BANK_TRANSFER_PENDING' ? 'Selected' : 'Open filter',
            href: withdrawalStatusHref(range, 'BANK_TRANSFER_PENDING'),
            label: 'Bank transfer pending',
            tone: 'info',
            value: visibleSummary.bankTransferPending,
          },
          {
            detail: 'Audit evidence',
            label: 'Lock released',
            tone: 'audit',
            value: visibleSummary.lockReleased,
          },
        ]}
      >
        <span className="sr-only">Withdrawal request status summary</span>
      </AdminSummaryCardGrid>
      <AdminTableScroll>
        <AdminDataTable
          className="vuexy-booking-table"
          emptyMessage={<PayoutWalletWithdrawalRequestEmptyState />}
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
              </td>
              <td>
                <strong>
                  <MoneyText amount={request.amount} currency={request.currency} />
                </strong>
                <p className="muted">Request {shortRecordId(request.id)}</p>
                <AdminWithdrawalAccountingPreview request={request} />
              </td>
              <td>
                <strong>{request.bankAccount?.bankName ?? 'Bank not linked'}</strong>
                <p className="muted">{bankAccountLabel(request)}</p>
              </td>
              <td>
                <StatusBadge tone={statusBadgeTone(request.status)}>{statusLabel(request.status)}</StatusBadge>
                {request.status === 'PAID' ? <WithdrawalReconciliationEvidence request={request} /> : null}
                <AdminFinanceOperatorEvidence lines={adminWithdrawalOperatorEvidenceLines(request)} />
                <WithdrawalStatusChangeEvidence request={request} />
                {request.correctionReason ? <p className="muted">{request.correctionReason}</p> : null}
                {request.transferRef ? <p className="muted">Ref {request.transferRef}</p> : null}
              </td>
              <td>
                <span className="muted">
                  <DateTimeText value={request.createdAt} />
                </span>
                {request.reviewedAt ? (
                  <p className="muted">
                    Reviewed <DateTimeText value={request.reviewedAt} />
                  </p>
                ) : null}
              </td>
              <td>
                <WithdrawalRequestActions
                  financeApproverOptions={financeApproverOptions}
                  request={request}
                  updateWithdrawalRequestAction={updateWithdrawalRequestAction}
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
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
  return `/payouts?${new URLSearchParams({ range, withdrawalStatus: status }).toString()}`;
}

function withdrawalReconciliationHref(range: string, reconciliation: 'unmatched' | 'matched') {
  return `/payouts?${new URLSearchParams({
    range,
    withdrawalReconciliation: reconciliation,
    withdrawalStatus: 'PAID',
  }).toString()}`;
}

function WithdrawalRequestActions({
  financeApproverOptions,
  request,
  updateWithdrawalRequestAction,
}: {
  readonly financeApproverOptions: readonly FinanceApproverOption[];
  readonly request: AdminProviderWalletWithdrawalRequest;
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
      </div>
    );
  }
  if (
    request.status === 'REJECTED' ||
    request.status === 'CANCELLED' ||
    request.status === 'FAILED' ||
    request.status === 'REVERSED'
  ) {
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
      {request.status === 'HOLD' || request.status === 'REVIEW_REQUIRED' ? (
        <>
          <StatusBadge tone="warning">Finance review required before payout</StatusBadge>
          <p className="muted">Resolve the review flag before moving this request to a bank payout run.</p>
        </>
      ) : null}

      {request.status === 'REQUESTED' || request.status === 'HOLD' || request.status === 'REVIEW_REQUIRED' ? (
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

      {request.status === 'APPROVED' ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="BANK_TRANSFER_PENDING" />
          <AdminFormInput
            label={`Bank pending note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder="Bank payout run note"
            type="text"
          />
          <AdminFormControlButton className="button-sm button-info" type="submit">
            Bank pending
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {request.status === 'BANK_TRANSFER_PENDING' ? (
        <StatusBadge tone="info">Manual bank transfer pending</StatusBadge>
      ) : null}

      {request.status === 'APPROVED' || request.status === 'BANK_TRANSFER_PENDING' ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="PAID" />
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
            placeholder="Evidence URL"
            required
            type="url"
          />
          <AdminFormSelect
            disabled={financeApproverOptions.length === 0}
            label={`Separate Finance approver for ${partnerLabel(request)}`}
            name="approvalAdminId"
            options={[{ label: 'Select Finance approver', value: '' }, ...financeApproverOptions]}
            required
          />
          <AdminFormControlButton
            className="button-sm button-success"
            disabled={financeApproverOptions.length === 0}
            type="submit"
          >
            Mark paid
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

      {request.status === 'REQUESTED' ||
      request.status === 'APPROVED' ||
      request.status === 'BANK_TRANSFER_PENDING' ||
      request.status === 'HOLD' ||
      request.status === 'REVIEW_REQUIRED' ? (
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
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
