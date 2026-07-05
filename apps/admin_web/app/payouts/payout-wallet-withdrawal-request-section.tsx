import Link from 'next/link';

import { AdminDataTable, AdminTableScroll } from '../../components/admin-data-table';
import { AdminEmptyState } from '../../components/admin-empty-state';
import { AdminInlineActionForm } from '../../components/admin-inline-action-form';
import {
  AdminFormControlButton,
  AdminFormDateTime,
  AdminFormInput,
} from '../../components/admin-form-controls';
import { AdminCard, AdminLinkCard } from '../../components/admin-surface';
import { AdminTablePanel } from '../../components/admin-table-panel';
import { AdminWithdrawalAccountingPreview } from '../../components/admin-withdrawal-accounting-preview';
import { DateTimeText } from '../../components/date-time-text';
import { MoneyText } from '../../components/money-text';
import { StatusBadge, type StatusBadgeTone } from '../../components/status-badge';
import { formatDateTime, shortRecordId } from '../../lib/admin-format';
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
    <AdminTablePanel
      className="payout-wallet-withdrawal-request-section admin-mb-16"
      description="Partner wallet withdrawal requests from the partner app. Finance can request bank correction, approve, reject, or mark paid after manual bank transfer."
      id="partner-wallet-withdrawal-requests"
      resultLabel={needsActionCount ? `${needsActionCount} needs action` : 'Clear'}
      resultTone={needsActionCount ? 'warning' : 'success'}
      title="Partner wallet withdrawal requests"
    >
      <div className="payout-wallet-withdrawal-summary-grid" aria-label="Withdrawal request status summary">
        <span className="sr-only">Withdrawal request status summary</span>
        <WithdrawalSummaryCard
          active={activeStatus === 'REQUESTED'}
          count={summary.requested}
          helper="Open filter"
          href={withdrawalStatusHref(range, 'REQUESTED')}
          label="Requested"
        />
        <WithdrawalSummaryCard
          active={activeStatus === 'REVIEW_REQUIRED'}
          count={summary.reviewRequired}
          helper="Open filter"
          href={withdrawalStatusHref(range, 'REVIEW_REQUIRED')}
          label="Review required"
          tone="warning"
        />
        <WithdrawalSummaryCard
          active={activeStatus === 'BANK_TRANSFER_PENDING'}
          count={summary.bankTransferPending}
          helper="Open filter"
          href={withdrawalStatusHref(range, 'BANK_TRANSFER_PENDING')}
          label="Bank transfer pending"
          tone="info"
        />
        <WithdrawalSummaryCard
          count={summary.lockReleased}
          helper="Audit evidence"
          label="Lock released"
          tone="audit"
        />
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
                  request={request}
                  updateWithdrawalRequestAction={updateWithdrawalRequestAction}
                />
              </td>
            </tr>
          ))}
        </AdminDataTable>
      </AdminTableScroll>
    </AdminTablePanel>
  );
}

function WithdrawalSummaryCard({
  active,
  count,
  helper,
  href,
  label,
  tone = 'neutral',
}: {
  readonly active?: boolean;
  readonly count: number;
  readonly helper: string;
  readonly href?: string;
  readonly label: string;
  readonly tone?: 'audit' | 'info' | 'neutral' | 'warning';
}) {
  const className = joinClassNames(
    'payout-wallet-withdrawal-summary-card',
    `is-${tone}`,
    active ? 'is-active' : undefined,
  );
  const content = (
    <>
      <span>{label}</span>
      <strong>{count}</strong>
      <small>{active ? 'Selected' : helper}</small>
    </>
  );

  return href ? (
    <AdminLinkCard className={className} href={href}>
      {content}
    </AdminLinkCard>
  ) : (
    <AdminCard className={className}>{content}</AdminCard>
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
    return (
      <span className="muted">
        Paid <DateTimeText fallback="No paid date" value={request.paidAt} />
      </span>
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
          <AdminFormInput
            label={`Approving admin id for ${partnerLabel(request)}`}
            name="approvalAdminId"
            placeholder="Approving admin id"
            required
            type="text"
          />
          <AdminFormControlButton className="button-sm button-success" type="submit">
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

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
