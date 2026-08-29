'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormInput,
  AdminFormSelect,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminDetailGrid, AdminDrawerSurface, AdminNoticeCard } from '../../components/admin-surface';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';
import type { AdminCashSettlementDetail } from '../../lib/admin-api';
import { formatDateTime, shortRecordId } from '../../lib/admin-format';
import { allocateApprovedDepositToCashDebt } from './actions';

type CashSettlementReviewDrawerProps = {
  readonly canAllocate: boolean;
  readonly closeHref: string;
  readonly detail: AdminCashSettlementDetail | null;
  readonly detailLoaded: boolean;
  readonly returnTo: string;
};

export function CashSettlementReviewDrawer({
  canAllocate,
  closeHref,
  detail,
  detailLoaded,
  returnTo,
}: CashSettlementReviewDrawerProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const onClose = useCallback(() => router.replace(closeHref, { scroll: false }), [closeHref, router]);
  useAdminModalFocus(drawerRef, onClose);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, []);

  const titleId = 'cash-settlement-review-title';
  const earning = detail?.earning;
  const partnerName =
    earning?.providerProfile?.displayName ?? earning?.providerProfile?.user?.fullName ?? 'Partner';
  const reviewAvailable = Boolean(detailLoaded && detail && earning);

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close cash settlement review" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Cash settlement review"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer service-menu-dialog cash-settlement-review-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="cash-settlement-review-drawer-shell service-menu-dialog-shell">
          <div className="calendar-drawer-header">
            <div>
              <span className="calendar-drawer-eyebrow">
                {reviewAvailable ? 'Approved evidence allocation' : 'Review unavailable'}
              </span>
              <h2 id={titleId}>{reviewAvailable ? partnerName : 'Cash settlement evidence'}</h2>
              <p className="muted">
                {reviewAvailable
                  ? 'One open cash fee receivable'
                  : 'The selected receivable could not be verified.'}
              </p>
            </div>
            <AdminFormControlButton
              aria-label="Close cash settlement review"
              className="button-secondary calendar-icon-button"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </AdminFormControlButton>
          </div>

          <div className="calendar-drawer-body">
            {!detailLoaded || !detail || !earning ? (
              <AdminNoticeCard role="alert" tone="danger">
                <strong>Debt evidence unavailable</strong>
                <p className="muted">
                  The exact open earning could not be loaded. No financial action is available.
                </p>
              </AdminNoticeCard>
            ) : (
              <>
              <AdminNoticeCard tone="warning">
                <strong>Settlement requires approved deposit evidence</strong>
                <p className="muted">
                  Allocation links the executed deposit ledger and journal to this earning. It does not create
                  another wallet or accounting entry.
                </p>
              </AdminNoticeCard>

              <AdminDetailGrid ariaLabel="Cash settlement debt evidence" className="admin-mt-16">
                <AdminFormStaticValue label="Earning" labelVisibility="visible" value={earning.id} />
                <AdminFormStaticValue label="Booking" labelVisibility="visible" value={earning.bookingId} />
                <AdminFormStaticValue
                  label="Original debt"
                  labelVisibility="visible"
                  value={<MoneyText amount={detail.originalDebtAmount} currency={earning.currency} />}
                />
                <AdminFormStaticValue
                  label="Allocated"
                  labelVisibility="visible"
                  value={<MoneyText amount={detail.allocatedAmount} currency={earning.currency} />}
                />
                <AdminFormStaticValue
                  label="Remaining exposure"
                  labelVisibility="visible"
                  value={<MoneyText amount={detail.remainingDebtAmount} currency={earning.currency} />}
                />
                <AdminFormStaticValue
                  label="Partner wallet"
                  labelVisibility="visible"
                  value={<MoneyText amount={detail.walletBalance} currency={earning.currency} />}
                />
                <AdminFormStaticValue
                  label="Opened"
                  labelVisibility="visible"
                  value={earning.createdAt ? formatDateTime(earning.createdAt) : 'Unknown'}
                />
              </AdminDetailGrid>

              <div className="admin-mt-16">
                <AdminFormControlLink className="button-secondary" href={`/bookings/${earning.bookingId}`}>
                  Open booking {shortRecordId(earning.bookingId)}
                </AdminFormControlLink>{' '}
                <AdminFormControlLink
                  className="button-secondary"
                  href={`/partners/${earning.providerProfileId}`}
                >
                  Open Partner
                </AdminFormControlLink>
              </div>

              <section className="admin-mt-20" aria-labelledby="cash-settlement-linked-evidence-title">
                <h3 id="cash-settlement-linked-evidence-title">Linked settlement evidence</h3>
                {earning.bankDepositCashDebtAllocations?.length ? (
                  <div className="admin-stage-list admin-mt-10">
                    {earning.bankDepositCashDebtAllocations.map((allocation) => (
                      <div className="admin-stage-item" key={allocation.id}>
                        <StatusBadge tone="info">Linked</StatusBadge>
                        <div>
                          <strong>{allocation.partnerBankDepositRequest.bankTransactionId}</strong>
                          <p className="muted">
                            <MoneyText amount={allocation.amount} currency={allocation.currency} /> ·{' '}
                            {formatDateTime(allocation.createdAt)}
                          </p>
                          <p className="muted cash-settlement-evidence-ids">
                            Deposit {allocation.partnerBankDepositRequest.id} · Ledger{' '}
                            {allocation.partnerBankDepositRequest.ledgerEntryId ?? 'missing'} · Journal{' '}
                            {allocation.partnerBankDepositRequest.journalBatchId ?? 'missing'}
                          </p>
                          <AdminFormControlLink
                            className="button-secondary"
                            href={`/finance-tax/partner-bank-deposits/${allocation.partnerBankDepositRequest.id}`}
                          >
                            Open deposit evidence
                          </AdminFormControlLink>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No approved deposit allocation is linked.</p>
                )}
              </section>

              <section className="admin-mt-20" aria-labelledby="cash-settlement-audit-title">
                <h3 id="cash-settlement-audit-title">Recent audit timeline</h3>
                {detail.auditLogs.length ? (
                  <div className="admin-stage-list admin-mt-10">
                    {detail.auditLogs.map((log) => {
                      const metadata = cashSettlementAuditMetadata(log.metadata);
                      const evidenceId = cashSettlementAuditEvidenceId(log.target, metadata);
                      return (
                        <div className="admin-stage-item" key={log.id}>
                          <StatusBadge tone="info">Audit</StatusBadge>
                          <div>
                            <strong>{cashSettlementAuditActionLabel(log.action)}</strong>
                            <p className="muted">
                              {cashSettlementAuditActor(log.actor)} · {formatDateTime(log.createdAt)}
                            </p>
                            <p className="muted">
                              {cashSettlementAuditResult(metadata, earning.currency)}
                            </p>
                            {evidenceId ? (
                              <AdminFormControlLink
                                className="button-secondary"
                                href={`/finance-tax/partner-bank-deposits/${encodeURIComponent(evidenceId)}`}
                              >
                                Open target evidence
                              </AdminFormControlLink>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">No allocation audit has been recorded for this receivable.</p>
                )}
              </section>

              <section className="admin-mt-20" aria-labelledby="cash-settlement-available-evidence-title">
                <h3 id="cash-settlement-available-evidence-title">Available approved deposits</h3>
                {!canAllocate ? (
                  <AdminNoticeCard className="admin-mt-10" tone="info">
                    <strong>Review only</strong>
                    <p className="muted">
                      FINANCE_SETTLEMENTS permission is required to allocate approved deposit evidence.
                    </p>
                  </AdminNoticeCard>
                ) : detail.availableDeposits.length ? (
                  detail.availableDeposits.map((deposit) => {
                    const allocationAmount = Math.min(
                      detail.remainingDebtAmount,
                      deposit.remainingReceivableRecovery,
                    );
                    return (
                      <AdminDrawerFormGrid
                        action={allocateApprovedDepositToCashDebt}
                        className="admin-card admin-mt-10"
                        key={deposit.id}
                      >
                        <input name="requestId" type="hidden" value={deposit.id} />
                        <input name="earningId" type="hidden" value={earning.id} />
                        <input name="returnTo" type="hidden" value={returnTo} />
                        <AdminFormStaticValue
                          label="Bank transaction"
                          labelVisibility="visible"
                          value={deposit.bankTransactionId}
                        />
                        <AdminFormStaticValue
                          label="Available recovery"
                          labelVisibility="visible"
                          value={
                            <MoneyText
                              amount={deposit.remainingReceivableRecovery}
                              currency={deposit.currency}
                            />
                          }
                        />
                        <AdminFormInput
                          defaultValue={String(allocationAmount)}
                          label="Allocation amount"
                          labelVisibility="visible"
                          max={String(allocationAmount)}
                          min="1"
                          name="amount"
                          required
                          step="1"
                          type="number"
                        />
                        <AdminFormSelect
                          defaultValue="BANK_DEPOSIT_CONFIRMED"
                          label="Allocation reason"
                          labelVisibility="visible"
                          name="reasonCode"
                          options={[
                            { label: 'Bank deposit confirmed', value: 'BANK_DEPOSIT_CONFIRMED' },
                            { label: 'Partial recovery', value: 'PARTIAL_RECOVERY' },
                            { label: 'Final recovery', value: 'FINAL_RECOVERY' },
                            { label: 'Other reviewed reason', value: 'OTHER_REVIEWED' },
                          ]}
                        />
                        <AdminFormTextarea
                          label="Review detail"
                          labelVisibility="visible"
                          minLength={12}
                          name="notes"
                          placeholder="Describe the bank evidence checked and why this allocation amount is correct."
                          required
                          rows={3}
                        />
                        <AdminDrawerActionFooter>
                          <AdminFormControlLink
                            className="button-secondary"
                            href={`/finance-tax/partner-bank-deposits/${deposit.id}`}
                          >
                            Inspect evidence
                          </AdminFormControlLink>
                          <CashSettlementAllocationSubmitButton earningId={earning.id} />
                        </AdminDrawerActionFooter>
                      </AdminDrawerFormGrid>
                    );
                  })
                ) : (
                  <AdminNoticeCard className="admin-mt-10" tone="info">
                    <strong>No allocatable approved deposit</strong>
                    <p className="muted">
                      Record and execute a Partner bank deposit before returning to this debt.
                    </p>
                    <AdminFormControlLink
                      className="button-secondary"
                      href={`/finance-tax/partner-bank-deposits?q=${encodeURIComponent(earning.providerProfileId)}`}
                    >
                      Open Partner deposits
                    </AdminFormControlLink>
                  </AdminNoticeCard>
                )}
              </section>

              <AdminNoticeCard className="admin-mt-20" tone="info">
                <strong>Admin offset is not available here</strong>
                <p className="muted">
                  The current system has no dedicated approved admin-offset evidence record. A free-text
                  reference cannot settle this receivable.
                </p>
              </AdminNoticeCard>
              </>
            )}
          </div>
        </div>
      </AdminDrawerSurface>
    </>
  );
}

function cashSettlementAuditMetadata(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cashSettlementAuditEvidenceId(target: string, metadata: Record<string, unknown>) {
  if (target.startsWith('partner_bank_deposit_request:')) {
    return target.slice('partner_bank_deposit_request:'.length);
  }
  return typeof metadata.partnerBankDepositRequestId === 'string'
    ? metadata.partnerBankDepositRequestId
    : null;
}

function cashSettlementAuditActor(actor: AdminCashSettlementDetail['auditLogs'][number]['actor']) {
  return actor?.fullName || actor?.email || actor?.id || 'System actor';
}

function cashSettlementAuditActionLabel(action: string) {
  if (action === 'partner_bank_deposit.cash_debt_allocate') return 'Approved deposit allocated';
  if (action === 'partner_bank_deposit_request.execute') return 'Partner deposit executed';
  return action.replaceAll('_', ' ').replaceAll('.', ' · ');
}

function cashSettlementAuditResult(metadata: Record<string, unknown>, fallbackCurrency: string) {
  const amount = typeof metadata.amount === 'number' ? metadata.amount : null;
  const currency = typeof metadata.currency === 'string' ? metadata.currency : fallbackCurrency;
  const reasonCode = typeof metadata.reasonCode === 'string' ? metadata.reasonCode : null;
  const result = metadata.cashDebtFullyAllocated === true ? 'Fully recovered' : 'Partial or evidence event';
  return [
    amount === null ? null : `${amount.toLocaleString('vi-VN')} ${currency}`,
    reasonCode?.replaceAll('_', ' '),
    result,
  ].filter(Boolean).join(' · ');
}

function CashSettlementAllocationSubmitButton({ earningId }: { readonly earningId: string }) {
  const { pending } = useFormStatus();
  return (
    <AdminFormControlButton
      aria-label={`Allocate approved deposit to cash settlement ${earningId}`}
      className="button-primary"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Allocating evidence...' : 'Allocate approved deposit'}
    </AdminFormControlButton>
  );
}
