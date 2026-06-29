import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import type { StatusBadgeTone } from '../../../components/status-badge';
import type { AdminProviderWalletWithdrawalRequest } from '../../../lib/admin-api';
import { providerWalletWithdrawalStatusChangeView } from '../../../lib/provider-wallet-withdrawal-status-change';
import { formatCurrency, formatDate, shortRecordId } from './partner-detail-format';
import {
  PartnerDetailVuexyTableFooter,
  partnerDetailReviewCardClassName,
  partnerDetailReviewTableClassName,
} from './partner-detail-vuexy-table';

type FormAction = (formData: FormData) => void | Promise<void>;

type PartnerDetailWalletWithdrawalRequestSectionProps = {
  readonly requests: readonly AdminProviderWalletWithdrawalRequest[];
  readonly updateWithdrawalRequestAction: FormAction;
};

const headers = ['Request', 'Amount', 'Bank account', 'Status', 'Finance action'] as const;

export function PartnerDetailWalletWithdrawalRequestSection({
  requests,
  updateWithdrawalRequestAction,
}: PartnerDetailWalletWithdrawalRequestSectionProps) {
  const needsActionCount = requests.filter((request) => !isTerminalStatus(request.status)).length;

  return (
    <AdminFilterPanel
      className={`${partnerDetailReviewCardClassName} admin-mb-16`}
      description="Partner wallet withdrawal history for this partner only. Finance can approve, request bank correction, reject, or mark paid after a manual transfer."
      id="wallet-withdrawal-requests"
      resultLabel={needsActionCount ? `${needsActionCount} needs action` : 'Clear'}
      resultTone={withdrawalResultTone(needsActionCount)}
      title="Wallet withdrawal requests"
    >
      <AdminTableScroll>
        <AdminDataTable
          className={partnerDetailReviewTableClassName}
          emptyMessage={<WalletWithdrawalEmptyState />}
          headers={headers}
          rowCount={requests.length}
        >
          {requests.map((request) => (
            <tr key={request.id}>
              <td>
                <strong>{shortRecordId(request.id)}</strong>
                <p className="muted">{formatDate(request.createdAt)}</p>
                {request.requestNote ? <p className="muted">{request.requestNote}</p> : null}
              </td>
              <td>
                <strong>{formatCurrency(request.amount, request.currency)}</strong>
              </td>
              <td>
                <strong>{request.bankAccount?.bankName ?? 'Bank not linked'}</strong>
                <p className="muted">{bankAccountLabel(request)}</p>
              </td>
              <td>
                <span className={`pill ${statusPillClass(request.status)}`}>{statusLabel(request.status)}</span>
                <WithdrawalStatusChangeEvidence request={request} />
                {request.correctionReason ? <p className="muted">{request.correctionReason}</p> : null}
                {request.transferRef ? <p className="muted">Ref {request.transferRef}</p> : null}
              </td>
              <td>
                <WithdrawalRequestActions
                  request={request}
                  updateWithdrawalRequestAction={updateWithdrawalRequestAction}
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
      <PartnerDetailVuexyTableFooter rowCount={requests.length} />
    </AdminFilterPanel>
  );
}

function WithdrawalRequestActions({
  request,
  updateWithdrawalRequestAction,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
  readonly updateWithdrawalRequestAction: FormAction;
}) {
  if (request.status === 'PAID') {
    return <span className="muted">Paid {formatDate(request.paidAt)}</span>;
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
        <span className="pill pill-warn">Waiting for partner bank correction</span>
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
          <span className="pill pill-warn">Finance review required before payout</span>
          <p className="muted">Resolve the review flag before moving this request to a bank payout run.</p>
        </>
      ) : null}

      {request.status === 'REQUESTED' || request.status === 'HOLD' || request.status === 'REVIEW_REQUIRED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="APPROVED" />
          <input
            aria-label={`Approval note for withdrawal ${request.id}`}
            className="form-control"
            name="adminNote"
            placeholder={request.status === 'REQUESTED' ? 'Approval note' : 'Review resolution note'}
            type="text"
          />
          <button className="btn btn-sm btn-primary" type="submit">
            {request.status === 'REQUESTED' ? 'Approve' : 'Clear review'}
          </button>
        </form>
      ) : null}

      {request.status === 'APPROVED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="BANK_TRANSFER_PENDING" />
          <input
            aria-label={`Bank pending note for withdrawal ${request.id}`}
            className="form-control"
            name="adminNote"
            placeholder="Bank payout run note"
            type="text"
          />
          <button className="btn btn-sm btn-info" type="submit">
            Bank pending
          </button>
        </form>
      ) : null}

      {request.status === 'BANK_TRANSFER_PENDING' ? (
        <span className="pill pill-info">Manual bank transfer pending</span>
      ) : null}

      {request.status === 'APPROVED' || request.status === 'BANK_TRANSFER_PENDING' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="PAID" />
          <input
            aria-label={`Transfer reference for withdrawal ${request.id}`}
            className="form-control"
            name="transferRef"
            placeholder="Bank transfer ref"
            required
            type="text"
          />
          <input
            aria-label={`Bank transfer date for withdrawal ${request.id}`}
            className="form-control"
            name="bankTransferDate"
            required
            type="datetime-local"
          />
          <input
            aria-label={`Bank transfer evidence URL for withdrawal ${request.id}`}
            className="form-control"
            name="attachmentUrl"
            placeholder="Evidence URL"
            required
            type="url"
          />
          <button className="btn btn-sm btn-success" type="submit">
            Mark paid
          </button>
        </form>
      ) : null}

      {request.status === 'REQUESTED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="NEEDS_BANK_CORRECTION" />
          <input
            aria-label={`Bank correction reason for withdrawal ${request.id}`}
            className="form-control"
            name="correctionReason"
            placeholder="Bank correction reason"
            required
            type="text"
          />
          <button className="btn btn-sm btn-outline" type="submit">
            Request correction
          </button>
        </form>
      ) : null}

      {request.status === 'REQUESTED' ||
      request.status === 'APPROVED' ||
      request.status === 'BANK_TRANSFER_PENDING' ||
      request.status === 'HOLD' ||
      request.status === 'REVIEW_REQUIRED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="REJECTED" />
          <input
            aria-label={`Reject note for withdrawal ${request.id}`}
            className="form-control"
            name="adminNote"
            placeholder="Reject note"
            type="text"
          />
          <button className="btn btn-sm btn-danger" type="submit">
            Reject
          </button>
        </form>
      ) : null}
    </div>
  );
}

function WalletWithdrawalEmptyState() {
  return (
    <div className="empty-state">
      <strong>No records found</strong>
      <p className="muted">No recent partner wallet withdrawal request is loaded for this partner.</p>
    </div>
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

function statusPillClass(status: AdminProviderWalletWithdrawalRequest['status']) {
  switch (status) {
    case 'PAID':
      return 'pill-success';
    case 'APPROVED':
    case 'BANK_TRANSFER_PENDING':
      return 'pill-info';
    case 'NEEDS_BANK_CORRECTION':
    case 'REVIEW_REQUIRED':
    case 'HOLD':
      return 'pill-warn';
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAILED':
    case 'REVERSED':
      return 'pill-danger';
    default:
      return 'pill-neutral';
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
  const amountLabel =
    typeof statusChange.evidenceAmount === 'number'
      ? ` ${formatCurrency(statusChange.evidenceAmount, request.currency)}`
      : '';

  return (
    <p className="muted">
      {statusChange.transitionLabel} / {lockLabel}
      {amountLabel}
    </p>
  );
}

function withdrawalResultTone(needsActionCount: number): StatusBadgeTone {
  return needsActionCount > 0 ? 'warning' : 'success';
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
