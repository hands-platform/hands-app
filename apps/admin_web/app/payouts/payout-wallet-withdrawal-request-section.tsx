import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminFilterPanel } from '../../components/admin-filter-panel';
import { AdminFormControlButton, AdminFormInput } from '../../components/admin-form-controls';
import { AdminWithdrawalAccountingPreview } from '../../components/admin-withdrawal-accounting-preview';
import { formatDateTime, formatMoney, shortRecordId } from '../../lib/admin-format';
import type {
  AdminProviderWalletWithdrawalRequest,
  AdminProviderWalletWithdrawalRequestStatus,
} from '../../lib/admin-api';
import { providerWalletWithdrawalStatusChangeView } from '../../lib/provider-wallet-withdrawal-status-change';

type FormAction = (formData: FormData) => void | Promise<void>;

type PayoutWalletWithdrawalRequestSectionProps = {
  readonly activeStatus?: AdminProviderWalletWithdrawalRequestStatus | null;
  readonly range?: string;
  readonly requests: readonly AdminProviderWalletWithdrawalRequest[];
  readonly updateWithdrawalRequestAction: FormAction;
};

const headers = ['Partner', 'Amount', 'Bank account', 'Status', 'Requested', 'Action'] as const;

export function PayoutWalletWithdrawalRequestSection({
  activeStatus = null,
  range = 'today',
  requests,
  updateWithdrawalRequestAction,
}: PayoutWalletWithdrawalRequestSectionProps) {
  const needsActionCount = requests.filter((request) => !isTerminalStatus(request.status)).length;
  const summary = buildWithdrawalRequestSummary(requests);

  return (
    <AdminFilterPanel
      className="payout-wallet-withdrawal-request-section admin-mb-16 vuexy-booking-table-card vuexy-booking-table-group"
      description="Partner wallet withdrawal requests from the partner app. Finance can request bank correction, approve, reject, or mark paid after manual bank transfer."
      id="partner-wallet-withdrawal-requests"
      resultLabel={needsActionCount ? `${needsActionCount} needs action` : 'Clear'}
      resultTone={needsActionCount ? 'warning' : 'success'}
      title="Partner wallet withdrawal requests"
    >
      <div className="payout-wallet-withdrawal-summary-grid" aria-label="Withdrawal request status summary">
        <span className="sr-only">Withdrawal request status summary</span>
        <WithdrawalSummaryStatusCard
          active={activeStatus === 'REQUESTED'}
          count={summary.requested}
          href={withdrawalStatusHref(range, 'REQUESTED')}
          label="Requested"
        />
        <WithdrawalSummaryStatusCard
          active={activeStatus === 'REVIEW_REQUIRED'}
          count={summary.reviewRequired}
          href={withdrawalStatusHref(range, 'REVIEW_REQUIRED')}
          label="Review required"
          tone="warning"
        />
        <WithdrawalSummaryStatusCard
          active={activeStatus === 'BANK_TRANSFER_PENDING'}
          count={summary.bankTransferPending}
          href={withdrawalStatusHref(range, 'BANK_TRANSFER_PENDING')}
          label="Bank transfer pending"
          tone="info"
        />
        <div className="card admin-card payout-wallet-withdrawal-summary-card is-audit">
          <span>Lock released</span>
          <strong>{summary.lockReleased}</strong>
          <small>Audit evidence</small>
        </div>
      </div>
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
                <Link
                  className="text-link"
                  href={`/partners/${request.providerProfileId}?section=full#finance`}
                >
                  {partnerLabel(request)}
                </Link>
                <p className="muted">{request.providerProfile?.user?.phone ?? 'No phone on file'}</p>
              </td>
              <td>
                <strong>{formatMoney(request.amount, request.currency)}</strong>
                <p className="muted">Request {shortRecordId(request.id)}</p>
                <AdminWithdrawalAccountingPreview request={request} />
              </td>
              <td>
                <strong>{request.bankAccount?.bankName ?? 'Bank not linked'}</strong>
                <p className="muted">{bankAccountLabel(request)}</p>
              </td>
              <td>
                <span className={`pill ${statusPillClass(request.status)}`}>
                  {statusLabel(request.status)}
                </span>
                <WithdrawalStatusChangeEvidence request={request} />
                {request.correctionReason ? <p className="muted">{request.correctionReason}</p> : null}
                {request.transferRef ? <p className="muted">Ref {request.transferRef}</p> : null}
              </td>
              <td>
                <span className="muted">{formatDateTime(request.createdAt)}</span>
                {request.reviewedAt ? (
                  <p className="muted">Reviewed {formatDateTime(request.reviewedAt)}</p>
                ) : null}
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
    </AdminFilterPanel>
  );
}

function WithdrawalSummaryStatusCard({
  active,
  count,
  href,
  label,
  tone = 'neutral',
}: {
  readonly active: boolean;
  readonly count: number;
  readonly href: string;
  readonly label: string;
  readonly tone?: 'info' | 'neutral' | 'warning';
}) {
  return (
    <Link
      className={joinClassNames(
        'card admin-card payout-wallet-withdrawal-summary-card',
        `is-${tone}`,
        active ? 'is-active' : undefined,
      )}
      href={href}
    >
      <span>{label}</span>
      <strong>{count}</strong>
      <small>{active ? 'Selected' : 'Open filter'}</small>
    </Link>
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

function WithdrawalRequestActions({
  request,
  updateWithdrawalRequestAction,
}: {
  readonly request: AdminProviderWalletWithdrawalRequest;
  readonly updateWithdrawalRequestAction: FormAction;
}) {
  if (request.status === 'PAID') {
    return <span className="muted">Paid {formatDateTime(request.paidAt)}</span>;
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
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="APPROVED" />
          <AdminFormInput
            label={`Approval note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder={request.status === 'REQUESTED' ? 'Approval note' : 'Review resolution note'}
            type="text"
          />
          <AdminFormControlButton className="btn btn-sm btn-primary" type="submit">
            {request.status === 'REQUESTED' ? 'Approve' : 'Clear review'}
          </AdminFormControlButton>
        </form>
      ) : null}

      {request.status === 'APPROVED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="BANK_TRANSFER_PENDING" />
          <AdminFormInput
            label={`Bank pending note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder="Bank payout run note"
            type="text"
          />
          <AdminFormControlButton className="btn btn-sm btn-info" type="submit">
            Bank pending
          </AdminFormControlButton>
        </form>
      ) : null}

      {request.status === 'BANK_TRANSFER_PENDING' ? (
        <span className="pill pill-info">Manual bank transfer pending</span>
      ) : null}

      {request.status === 'APPROVED' || request.status === 'BANK_TRANSFER_PENDING' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="PAID" />
          <AdminFormInput
            label={`Transfer reference for ${partnerLabel(request)}`}
            name="transferRef"
            placeholder="Bank transfer ref"
            required
            type="text"
          />
          <AdminFormInput
            label={`Bank transfer date for ${partnerLabel(request)}`}
            name="bankTransferDate"
            required
            type="datetime-local"
          />
          <AdminFormInput
            label={`Bank transfer evidence URL for ${partnerLabel(request)}`}
            name="attachmentUrl"
            placeholder="Evidence URL"
            required
            type="url"
          />
          <AdminFormInput
            label={`Approving admin id for ${partnerLabel(request)}`}
            name="approvalAdminId"
            placeholder="Approving admin id"
            required
            type="text"
          />
          <AdminFormControlButton className="btn btn-sm btn-success" type="submit">
            Mark paid
          </AdminFormControlButton>
        </form>
      ) : null}

      {request.status === 'REQUESTED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="NEEDS_BANK_CORRECTION" />
          <AdminFormInput
            label={`Bank correction reason for ${partnerLabel(request)}`}
            name="correctionReason"
            placeholder="Bank correction reason"
            required
            type="text"
          />
          <AdminFormControlButton className="btn btn-sm btn-outline" type="submit">
            Request correction
          </AdminFormControlButton>
        </form>
      ) : null}

      {request.status === 'REQUESTED' ||
      request.status === 'APPROVED' ||
      request.status === 'BANK_TRANSFER_PENDING' ||
      request.status === 'HOLD' ||
      request.status === 'REVIEW_REQUIRED' ? (
        <form action={updateWithdrawalRequestAction} className="admin-inline-form">
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="REJECTED" />
          <AdminFormInput
            label={`Reject note for ${partnerLabel(request)}`}
            name="adminNote"
            placeholder="Reject note"
            type="text"
          />
          <AdminFormControlButton className="btn btn-sm btn-danger" type="submit">
            Reject
          </AdminFormControlButton>
        </form>
      ) : null}
    </div>
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
      ? ` ${formatMoney(statusChange.evidenceAmount, request.currency)}`
      : '';

  return (
    <p className="muted">
      {statusChange.transitionLabel} / {lockLabel}
      {amountLabel}
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

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
