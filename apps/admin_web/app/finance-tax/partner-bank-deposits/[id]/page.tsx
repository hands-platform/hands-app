import { notFound } from 'next/navigation';

import { type AdminPartnerBankDepositRequestDetail, adminGet } from '../../../../lib/admin-api';
import { AdminInlineFallback } from '../../../../components/admin-inline-fallback';
import {
  AdminFormControlLink,
} from '../../../../components/admin-form-controls';
import { AdminPageTemplate } from '../../../../components/admin-page-template';
import { AdminTextLink } from '../../../../components/admin-text-link';
import { ConfirmDialog } from '../../../../components/confirm-dialog';
import { DateTimeText } from '../../../../components/date-time-text';
import { MoneyText } from '../../../../components/money-text';
import { StatusBadge } from '../../../../components/status-badge';
import { FinanceDataTable } from '../../finance-data-table';
import { FinanceDetailGrid, FinanceDetailInfoItem } from '../../finance-detail-info-item';
import { FinanceTablePanel } from '../../finance-table-panel';
import {
  allocatePartnerBankDepositCashDebt,
} from '../actions';
import { PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT } from '../partner-bank-deposit-action-contract';

type PartnerBankDepositDetailPageProps = {
  readonly params: Promise<{ id: string }>;
  readonly searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PartnerBankDepositDetailPage({ params, searchParams }: PartnerBankDepositDetailPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const detail = await adminGet<AdminPartnerBankDepositRequestDetail | null>(
    `/admin/provider-wallet/deposit-requests/${encodeURIComponent(id)}`,
    null,
  );
  if (!detail) notFound();

  const request = detail.request;
  const partnerName = request.providerProfile?.displayName ?? request.providerProfile?.user?.fullName ?? 'Partner';
  const canAllocate = request.status === 'EXECUTED' && detail.remainingReceivableRecovery > 0;
  const bankCashEntry = detail.journal?.entries.find(
    (entry) => entry.side === 'DEBIT' && entry.accountCode === 'company_bank_cash',
  );
  const reconciliationMatches = (bankCashEntry?.bankReconciliationMatches ?? []).filter(
    (match) => match.status !== 'REVERSED',
  );
  const reconciledAmount = reconciliationMatches.reduce((sum, match) => sum + Math.abs(match.amount), 0);
  const remainingReconciliationAmount = Math.max(0, request.amount - reconciledAmount);
  const requestedAllocationEarningId =
    readSearchParam(query.confirm) === 'allocate' ? readSearchParam(query.earningId) : '';
  const requestedAllocation = canAllocate
    ? detail.availableCashDebts.find((earning) => earning.id === requestedAllocationEarningId) ?? null
    : null;
  const requestedAllocationAmount = requestedAllocation
    ? Math.min(requestedAllocation.remainingDebtAmount, detail.remainingReceivableRecovery)
    : 0;
  const detailHref = `/finance-tax/partner-bank-deposits/${encodeURIComponent(request.id)}`;
  const bankReconciliationHref = `/finance-tax/bank-reconciliation?${new URLSearchParams({
    range: 'all',
    review: 'unmatched',
    q: request.bankTransactionId,
  }).toString()}`;

  return (
    <AdminPageTemplate
      actions={
        <>
          <AdminFormControlLink href="/finance-tax/partner-bank-deposits">Deposit history</AdminFormControlLink>
          <AdminFormControlLink href="/cash-settlements">Cash debt</AdminFormControlLink>
          <AdminFormControlLink href="/finance-tax/bank-reconciliation">Bank reconciliation</AdminFormControlLink>
          {request.status === 'REQUESTED' ? (
            <AdminFormControlLink href="/finance-tax/approval-queue?view=approvals#partner-bank-deposit-requests">Review approval</AdminFormControlLink>
          ) : null}
        </>
      }
      description="Immutable bank evidence and the exact cash-booking debt attributed to this approved deposit."
      metrics={[
        {
          kind: request.status === 'REQUESTED' ? 'action' : 'record',
          label: 'Deposit amount',
          scope: request.status === 'REQUESTED' ? 'Pending' : 'Recorded',
          value: <MoneyText amount={request.amount} currency={request.currency} />,
        },
        {
          kind: 'risk',
          label: 'Receivable recovery',
          scope: 'Approved allocation',
          value: <MoneyText amount={request.requestedReceivableRecovery} currency={request.currency} />,
        },
        {
          kind: detail.remainingReceivableRecovery > 0 ? 'action' : 'record',
          label: 'Unallocated recovery',
          scope: detail.remainingReceivableRecovery > 0 ? 'Needs action' : 'Complete',
          value: <MoneyText amount={detail.remainingReceivableRecovery} currency={request.currency} />,
        },
        {
          kind: remainingReconciliationAmount > 0 ? 'risk' : 'record',
          label: 'Bank reconciliation',
          scope: remainingReconciliationAmount > 0 ? 'Needs action' : 'Matched',
          value: <MoneyText amount={reconciledAmount} currency={request.currency} />,
        },
      ]}
      title="Partner Bank Deposit Detail"
    >
      {requestedAllocation ? (
        <ConfirmDialog
          action={allocatePartnerBankDepositCashDebt}
          cancelHref={detailHref}
          confirmLabel="Allocate cash debt"
          description={
            <>
              Link <strong>{requestedAllocation.bookingId}</strong> to this deposit for{' '}
              <strong><MoneyText amount={requestedAllocationAmount} currency={request.currency} /></strong>.
              This records immutable allocation evidence and does not create another wallet or journal entry.
            </>
          }
          hiddenInputs={[
            { name: 'requestId', value: request.id },
            { name: 'earningId', value: requestedAllocation.id },
            { name: 'amount', value: requestedAllocationAmount },
            {
              name: 'confirmationIntent',
              value: PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT,
            },
          ]}
          id={`partner-bank-deposit-allocation-${requestedAllocation.id}`}
          supportingLinks={[
            {
              href: `/bookings/${encodeURIComponent(requestedAllocation.bookingId)}`,
              label: 'Open booking evidence',
            },
          ]}
          textInputs={[
            {
              label: 'Allocation reason',
              maxLength: 500,
              minLength: 12,
              name: 'notes',
              placeholder: 'Why does this bank deposit settle the selected cash-booking debt?',
              required: true,
            },
          ]}
          title="Allocate Partner deposit to cash debt?"
          tone="warning"
        />
      ) : readSearchParam(query.confirm) === 'allocate' ? (
        <AdminInlineFallback>
          This allocation is no longer available. Reload the deposit evidence before continuing.
        </AdminInlineFallback>
      ) : null}

      <FinanceTablePanel
        grouped
        description="The approved deposit moves bank, Partner receivable, and wallet liability once. Cash-debt links below add evidence only."
        resultLabel={request.status}
        resultTone={request.status === 'EXECUTED' ? 'success' : request.status === 'REQUESTED' ? 'warning' : 'danger'}
        title="Deposit record"
      >
        <FinanceDetailGrid>
          <FinanceDetailInfoItem label="Partner" value={<AdminTextLink href={`/partners/${request.providerProfileId}?section=full`}>{partnerName}</AdminTextLink>} />
          <FinanceDetailInfoItem label="Bank transfer reference" value={request.bankTransactionId} />
          <FinanceDetailInfoItem label="Deposit date" value={<DateTimeText value={request.depositDate} />} />
          <FinanceDetailInfoItem label="Bank account" value={request.bankAccount ?? 'Not recorded'} />
          <FinanceDetailInfoItem label="Before wallet" value={<MoneyText amount={request.requestedBeforeBalance} currency={request.currency} />} />
          <FinanceDetailInfoItem label="After wallet" value={<MoneyText amount={request.requestedAfterBalance} currency={request.currency} />} />
          <FinanceDetailInfoItem label="Receivable recovery" value={<MoneyText amount={request.requestedReceivableRecovery} currency={request.currency} />} />
          <FinanceDetailInfoItem label="Wallet liability increase" value={<MoneyText amount={request.requestedWalletLiabilityIncrease} currency={request.currency} />} />
          <FinanceDetailInfoItem label="Requested by" value={adminIdentityLabel(request.requestedBy, request.requestedByAdminId)} />
          <FinanceDetailInfoItem label="Approved & executed by" value={request.approvedByAdminId ? adminIdentityLabel(request.approvedBy, request.approvedByAdminId) : 'Not approved'} />
          {request.rejectedByAdminId ? (
            <FinanceDetailInfoItem label="Rejected by" value={adminIdentityLabel(request.rejectedBy, request.rejectedByAdminId)} />
          ) : null}
          <FinanceDetailInfoItem label="Recorded" value={<DateTimeText value={request.createdAt} />} />
          <FinanceDetailInfoItem label="Executed" value={request.executedAt ? <DateTimeText value={request.executedAt} /> : 'Not executed'} />
          {request.rejectedAt ? (
            <FinanceDetailInfoItem label="Rejected" value={<DateTimeText value={request.rejectedAt} />} />
          ) : null}
          {request.decisionReason ? (
            <FinanceDetailInfoItem label="Decision reason" value={request.decisionReason} />
          ) : null}
        </FinanceDetailGrid>
        {request.attachmentUrl ? (
          <div className="admin-mt-16">
            <AdminFormControlLink href={request.attachmentUrl}>Open attachment evidence</AdminFormControlLink>
          </div>
        ) : request.attachmentFileId ? (
          <p className="muted admin-mt-16">Private attachment file: {request.attachmentFileId}</p>
        ) : (
          <AdminInlineFallback>No attachment evidence reference</AdminInlineFallback>
        )}
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description="The bank inflow must reconcile to this deposit's company bank cash debit. Reversed matches remain in the bank transaction audit trail."
        resultLabel={
          remainingReconciliationAmount > 0
            ? `${remainingReconciliationAmount.toLocaleString('en-US')} ${request.currency} unmatched`
            : 'Fully reconciled'
        }
        resultTone={remainingReconciliationAmount > 0 ? 'warning' : 'success'}
        title="Bank reconciliation evidence"
      >
        <FinanceDataTable
          headers={['Bank transaction', 'Flow', 'Matched amount', 'Status', 'Occurred']}
          rowCount={reconciliationMatches.length}
          emptyMessage="No imported bank inflow has been matched to this deposit's GL bank debit."
        >
          {reconciliationMatches.map((match) => (
            <tr key={match.id}>
              <td>
                <AdminTextLink href={`/finance-tax/bank-reconciliation/${encodeURIComponent(match.bankTransactionId)}`}>
                  {match.bankTransaction?.transferRef ?? match.bankTransactionId}
                </AdminTextLink>
              </td>
              <td>{match.bankTransaction?.type ?? 'INFLOW'}</td>
              <td><MoneyText amount={match.amount} currency={match.currency} /></td>
              <td><StatusBadge tone={match.status === 'MATCHED' ? 'success' : 'warning'}>{match.status}</StatusBadge></td>
              <td>{match.bankTransaction?.occurredAt ? <DateTimeText value={match.bankTransaction.occurredAt} /> : '-'}</td>
            </tr>
          ))}
        </FinanceDataTable>
        {remainingReconciliationAmount > 0 ? (
          <div className="actions admin-mt-16">
            <AdminFormControlLink className="button-primary" href={bankReconciliationHref}>
              Find or import bank transaction
            </AdminFormControlLink>
            <span className="muted">
              Search by transfer reference, then import the bank statement if no transaction is available.
            </span>
          </div>
        ) : null}
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description="This is the single wallet movement created by approval. Allocation must never create another wallet entry."
        resultLabel={detail.ledger ? 'Recorded' : 'Not available'}
        resultTone={detail.ledger ? 'success' : 'warning'}
        title="Partner wallet evidence"
      >
        {detail.ledger ? (
          <FinanceDataTable headers={['Type', 'Amount', 'Reference', 'Created']} rowCount={1} emptyMessage="No wallet entry.">
            <tr>
              <td><StatusBadge tone="success">{detail.ledger.type}</StatusBadge></td>
              <td><MoneyText amount={detail.ledger.amount} currency={detail.ledger.currency} /></td>
              <td>{detail.ledger.reference ?? detail.ledger.sourceKey}</td>
              <td><DateTimeText value={detail.ledger.createdAt} /></td>
            </tr>
          </FinanceDataTable>
        ) : <AdminInlineFallback>Wallet entry is not available until approval completes.</AdminInlineFallback>}
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description="Debit and credit must remain balanced. Cash-debt attribution does not add journal entries."
        resultLabel={detail.journal ? `${detail.journal.entries.length} entries` : 'Not available'}
        resultTone={detail.journal && detail.journal.totalDebit === detail.journal.totalCredit ? 'success' : 'warning'}
        title="General ledger evidence"
      >
        {detail.journal ? (
          <FinanceDataTable headers={['Side', 'Account', 'Amount', 'Memo']} rowCount={detail.journal.entries.length} emptyMessage="No journal entries.">
            {detail.journal.entries.map((entry) => (
              <tr key={entry.id}>
                <td><StatusBadge tone={entry.side === 'DEBIT' ? 'info' : 'success'}>{entry.side}</StatusBadge></td>
                <td><strong>{entry.accountCode}</strong><div className="muted">{entry.accountName}</div></td>
                <td><MoneyText amount={entry.amount} currency={entry.currency} /></td>
                <td>{entry.memo ?? '-'}</td>
              </tr>
            ))}
          </FinanceDataTable>
        ) : <AdminInlineFallback>Journal evidence is not available until approval completes.</AdminInlineFallback>}
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description="Immutable links showing which cash-booking receivable was recovered by this approved deposit."
        resultLabel={`${request.cashDebtAllocations.length} allocation(s)`}
        resultTone={detail.remainingReceivableRecovery > 0 ? 'warning' : 'success'}
        title="Allocated cash debt"
      >
        <FinanceDataTable headers={['Booking', 'Debt amount', 'Allocated', 'Operator', 'Reason', 'Created']} rowCount={request.cashDebtAllocations.length} emptyMessage="No cash debt has been allocated from this deposit yet.">
          {request.cashDebtAllocations.map((allocation) => (
            <tr key={allocation.id}>
              <td><AdminTextLink href={`/bookings/${allocation.providerEarning.bookingId}`}>{allocation.providerEarning.bookingId}</AdminTextLink></td>
              <td><MoneyText amount={Math.abs(allocation.providerEarning.netAmount)} currency={allocation.currency} /></td>
              <td><strong><MoneyText amount={allocation.amount} currency={allocation.currency} /></strong></td>
              <td>{adminIdentityLabel(allocation.allocatedBy, allocation.allocatedByAdminId)}</td>
              <td>{allocation.notes ?? 'No reason stored'}</td>
              <td><DateTimeText value={allocation.createdAt} /></td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel
        className="admin-mt-16"
        grouped
        description={canAllocate ? 'Choose the exact cash-booking debt. The button allocates the smaller of debt remaining and deposit recovery remaining.' : 'Allocation opens only after approval and only while receivable recovery remains.'}
        resultLabel={canAllocate ? `${detail.availableCashDebts.length} open debt(s)` : 'No allocation available'}
        resultTone={canAllocate ? 'warning' : 'neutral'}
        title="Open cash debt available for allocation"
      >
        <FinanceDataTable headers={['Booking', 'Payment', 'Debt remaining', 'Created', 'Action']} rowCount={canAllocate ? detail.availableCashDebts.length : 0} emptyMessage="No eligible cash debt is available for this approved deposit.">
          {canAllocate ? detail.availableCashDebts.map((earning) => {
            const allocationAmount = Math.min(earning.remainingDebtAmount, detail.remainingReceivableRecovery);
            return (
              <tr key={earning.id}>
                <td><AdminTextLink href={`/bookings/${earning.bookingId}`}>{earning.bookingId}</AdminTextLink><div className="muted">{earning.status}</div></td>
                <td>{earning.booking?.payment ? `${earning.booking.payment.method} / ${earning.booking.payment.status}` : 'No payment evidence'}</td>
                <td><MoneyText amount={earning.remainingDebtAmount} currency={earning.currency} /></td>
                <td><DateTimeText value={earning.createdAt} /></td>
                <td>
                  <AdminFormControlLink
                    className="button-primary"
                    href={`${detailHref}?${new URLSearchParams({ confirm: 'allocate', earningId: earning.id }).toString()}`}
                  >
                    Review allocation <MoneyText amount={allocationAmount} currency={earning.currency} />
                  </AdminFormControlLink>
                </td>
              </tr>
            );
          }) : null}
        </FinanceDataTable>
      </FinanceTablePanel>

      <FinanceTablePanel className="admin-mt-16" grouped resultLabel={`${detail.auditLogs.length} event(s)`} resultTone="info" title="Audit trail">
        <FinanceDataTable headers={['Action', 'Operator', 'Created']} rowCount={detail.auditLogs.length} emptyMessage="No audit events were returned.">
          {detail.auditLogs.map((event) => (
            <tr key={event.id}>
              <td><strong>{event.action}</strong><div className="muted">{event.target}</div></td>
              <td>{event.actor?.fullName ?? event.actor?.email ?? event.actor?.id ?? 'System'}</td>
              <td><DateTimeText value={event.createdAt} /></td>
            </tr>
          ))}
        </FinanceDataTable>
      </FinanceTablePanel>
    </AdminPageTemplate>
  );
}

function adminIdentityLabel(
  identity: { readonly email?: string | null; readonly fullName?: string | null } | null | undefined,
  fallback: string | null | undefined,
) {
  return identity?.fullName ?? identity?.email ?? fallback ?? 'Unknown operator';
}

function readSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
