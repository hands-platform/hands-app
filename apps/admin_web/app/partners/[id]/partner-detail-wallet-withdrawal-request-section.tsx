import { AdminDataTable, AdminTableScroll } from '../../../components/admin-data-table';
import { AdminEmptyState } from '../../../components/admin-empty-state';
import { AdminFilterPanel } from '../../../components/admin-filter-panel';
import { AdminInlineActionForm } from '../../../components/admin-inline-action-form';
import {
  AdminFormControlButton,
  AdminFormDateTime,
  AdminFormInput,
} from '../../../components/admin-form-controls';
import { AdminWithdrawalAccountingPreview } from '../../../components/admin-withdrawal-accounting-preview';
import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { StatusBadge, statusBadgeToneFromPillClass, type StatusBadgeTone } from '../../../components/status-badge';
import type { AdminProviderWalletWithdrawalRequest } from '../../../lib/admin-api';
import { providerWalletWithdrawalStatusChangeView } from '../../../lib/provider-wallet-withdrawal-status-change';
import { formatCurrency, shortRecordId } from './partner-detail-format';
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
                <p className="muted">
                  <DateTimeText fallback="Missing" value={request.createdAt} />
                </p>
                {request.requestNote ? <p className="muted">{request.requestNote}</p> : null}
              </td>
              <td>
                <strong>
                  <MoneyText amount={request.amount} currency={request.currency} />
                </strong>
                <AdminWithdrawalAccountingPreview request={request} />
              </td>
              <td>
                <strong>{request.bankAccount?.bankName ?? 'Bank not linked'}</strong>
                <p className="muted">{bankAccountLabel(request)}</p>
              </td>
              <td>
                <StatusBadge tone={statusBadgeToneFromPillClass(statusPillClass(request.status))}>
                  {statusLabel(request.status)}
                </StatusBadge>
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
    return (
      <span className="muted">
        Paid <DateTimeText fallback="Missing" value={request.paidAt} />
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
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="APPROVED" />
          <AdminFormInput
            label={`Approval note for withdrawal ${request.id}`}
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
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="BANK_TRANSFER_PENDING" />
          <AdminFormInput
            label={`Bank pending note for withdrawal ${request.id}`}
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
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="PAID" />
          <AdminFormInput
            label={`Transfer reference for withdrawal ${request.id}`}
            name="transferRef"
            placeholder="Bank transfer ref"
            required
            type="text"
          />
          <AdminFormDateTime
            label={`Bank transfer date for withdrawal ${request.id}`}
            name="bankTransferDate"
            required
          />
          <AdminFormInput
            label={`Bank transfer evidence URL for withdrawal ${request.id}`}
            name="attachmentUrl"
            placeholder="Evidence URL"
            required
            type="url"
          />
          <AdminFormControlButton className="button-sm button-success" type="submit">
            Mark paid
          </AdminFormControlButton>
        </AdminInlineActionForm>
      ) : null}

      {request.status === 'REQUESTED' ? (
        <AdminInlineActionForm action={updateWithdrawalRequestAction}>
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="NEEDS_BANK_CORRECTION" />
          <AdminFormInput
            label={`Bank correction reason for withdrawal ${request.id}`}
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
          <input name="providerId" type="hidden" value={request.providerProfileId} />
          <input name="requestId" type="hidden" value={request.id} />
          <input name="status" type="hidden" value="REJECTED" />
          <AdminFormInput
            label={`Reject note for withdrawal ${request.id}`}
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

function WalletWithdrawalEmptyState() {
  return (
    <AdminEmptyState
      framed
      message="No recent partner wallet withdrawal request is loaded for this partner."
    />
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
