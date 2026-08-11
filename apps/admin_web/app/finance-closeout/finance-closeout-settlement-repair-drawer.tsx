'use client';

import { useCallback, useRef } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

import type { AdminBookingSettlementGapRepairPreview, AdminUser } from '../../lib/admin-api';
import { formatDateTime } from '../../lib/admin-format';
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
import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';
import { AdminTextLink } from '../../components/admin-text-link';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';

type FinanceCloseoutSettlementRepairDrawerProps = {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly approvers: readonly AdminUser[];
  readonly closeHref: string;
  readonly preview: AdminBookingSettlementGapRepairPreview | null;
  readonly recheckHref: string;
  readonly returnFilters: {
    readonly q: string;
    readonly range: string;
    readonly settlementAge: string;
    readonly settlementPage: number;
    readonly settlementPaymentMethod: string;
    readonly settlementPeriod: string;
    readonly settlementTrack: string;
  };
};

export function FinanceCloseoutSettlementRepairDrawer({
  action,
  approvers,
  closeHref,
  preview,
  recheckHref,
  returnFilters,
}: FinanceCloseoutSettlementRepairDrawerProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const onClose = useCallback(() => router.replace(closeHref, { scroll: false }), [closeHref, router]);
  useAdminModalFocus(drawerRef, onClose);

  const financeApprovers = approvers.filter(
    (approver) =>
      approver.roles.includes('FINANCE_APPROVER') &&
      !/\b(test|smoke|demo)\b/i.test(
        [approver.id, approver.fullName, approver.email, approver.phone].filter(Boolean).join(' '),
      ),
  );
  const isHistorical = preview?.repairMode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION';
  const policyDecision = preview?.policyDecision ?? (preview?.canRepair ? 'APPROVED' : 'BLOCKED');
  const policyReasons = preview?.policyReasons ?? [];
  const policyExceptionCodes = preview?.policyExceptionCodes ?? [];
  const repairApproved = policyDecision === 'APPROVED' && preview?.canRepair;
  const titleId = 'settlement-repair-preview-title';

  return (
    <>
      <AdminDrawerBackdropButton aria-hidden="true" onClick={onClose} tabIndex={-1} />
      <AdminDrawerSurface
        ariaLabel="Settlement repair preview"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer service-menu-dialog"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Governed finance repair</span>
            <h2 id={titleId}>Settlement repair preview</h2>
          </div>
          <AdminFormControlButton
            aria-label="Close settlement repair preview"
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlButton>
        </div>

        <div className="calendar-drawer-body">
          {!preview ? (
            <AdminNoticeCard role="alert" tone="danger">
              <strong>Preview unavailable</strong>
              <p className="muted">
                The booking evidence could not be loaded. No finance write is available.
              </p>
            </AdminNoticeCard>
          ) : (
            <>
              <section aria-labelledby="settlement-repair-summary-title">
                <h3 id="settlement-repair-summary-title">Summary</h3>
                <AdminNoticeCard tone={repairApproved ? 'warning' : 'danger'}>
                <strong>
                  {repairApproved
                    ? 'Approved for controlled repair'
                    : policyDecision === 'REVIEW_REQUIRED'
                      ? 'Policy review required — repair locked'
                      : 'Repair blocked'}
                </strong>
                <p className="muted">
                  {isHistorical
                    ? 'This action preserves the paid earning and wallet lifecycle, then reconstructs the missing snapshot, journal, and non-cash clearing from retained evidence.'
                    : 'This action reruns the canonical completed-booking settlement path while preserving any existing earning lifecycle.'}{' '}
                  Monthly closing, payment, and dual-approval controls remain enforced.
                </p>
                <StatusBadge tone={repairApproved ? 'warning' : 'danger'}>
                  {repairApproved ? 'Dual approval required' : policyDecision.replace('_', ' ')}
                </StatusBadge>
                </AdminNoticeCard>
              </section>

              <section aria-labelledby="settlement-repair-change-title" className="admin-mt-16">
                <h3 id="settlement-repair-change-title">Before and after</h3>
                <AdminDetailGrid ariaLabel="Settlement repair before and after">
                  <AdminFormStaticValue
                    label="Before"
                    labelVisibility="visible"
                    value="Settlement snapshot missing; existing earning lifecycle retained"
                  />
                  <AdminFormStaticValue
                    label="After"
                    labelVisibility="visible"
                    value={
                      isHistorical
                        ? 'Snapshot, journal, and non-cash clearing reconstructed from retained evidence'
                        : 'Canonical completion settlement creates the missing snapshot and accounting records'
                    }
                  />
                </AdminDetailGrid>
              </section>

              <section aria-labelledby="settlement-repair-evidence-title" className="admin-mt-16">
                <h3 id="settlement-repair-evidence-title">Evidence</h3>
                <AdminDetailGrid ariaLabel="Settlement repair evidence">
                <AdminFormStaticValue label="Booking" labelVisibility="visible" value={preview.bookingId} />
                <AdminFormStaticValue
                  label="Completed"
                  labelVisibility="visible"
                  value={formatDateTime(preview.completedAt)}
                />
                <AdminFormStaticValue
                  label="Monthly period"
                  labelVisibility="visible"
                  value={preview.monthlyPeriod}
                />
                <AdminFormStaticValue
                  label="Monthly close"
                  labelVisibility="visible"
                  value={preview.monthlyClosingStatus ?? 'Not created'}
                />
                <AdminFormStaticValue
                  label="Services"
                  labelVisibility="visible"
                  value={String(preview.serviceCount)}
                />
                <AdminFormStaticValue
                  label="Payment"
                  labelVisibility="visible"
                  value={
                    preview.payment ? (
                      <>
                        {preview.payment.status} · {preview.payment.method} ·{' '}
                        <MoneyText amount={preview.payment.amount} currency={preview.payment.currency} />
                      </>
                    ) : (
                      'Missing'
                    )
                  }
                />
                <AdminFormStaticValue
                  label="Existing earning"
                  labelVisibility="visible"
                  value={
                    preview.earning ? (
                      <>
                        {preview.earning.status} ·{' '}
                        <MoneyText amount={preview.earning.netAmount} currency={preview.earning.currency} />
                      </>
                    ) : (
                      'Will be created by canonical settlement'
                    )
                  }
                />
                <AdminFormStaticValue
                  label="Repair mode"
                  labelVisibility="visible"
                  value={isHistorical ? 'Historical paid evidence' : 'Canonical completion'}
                />
                <AdminFormStaticValue
                  label="Lifecycle"
                  labelVisibility="visible"
                  value={
                    preview.preservesExistingEarningLifecycle ? 'Existing status preserved' : 'Recreated'
                  }
                />
                {preview.historicalEvidenceSummary ? (
                  <AdminFormStaticValue
                    label="Retained evidence"
                    labelVisibility="visible"
                    value={`${preview.historicalEvidenceSummary.platformFeeLogCount} fee · ${preview.historicalEvidenceSummary.taxLogCount} tax · ${preview.historicalEvidenceSummary.walletLedgerEntryCount} wallet`}
                  />
                ) : null}
                </AdminDetailGrid>
              </section>

              {preview.blockers.length ? (
                <section aria-labelledby="settlement-repair-remediation-title" className="admin-mt-16">
                  <h3 id="settlement-repair-remediation-title">Blocker remediation</h3>
                  <AdminNoticeCard role="alert" tone="danger">
                    <strong>Resolve {preview.blockers.length} evidence issue(s) before repair</strong>
                    <p className="muted">
                      Repair remains locked until the source evidence is corrected and the preview is run again.
                    </p>
                  </AdminNoticeCard>
                  <div className="finance-closeout-remediation-list">
                    {preview.blockers.map((blocker) => {
                      const remediation = settlementBlockerRemediation(preview, blocker);
                      return (
                        <section className="finance-closeout-remediation-item" key={blocker.code}>
                          <strong>{blocker.message}</strong>
                          <dl>
                            <div>
                              <dt>Responsible team</dt>
                              <dd>{remediation.responsibleTeam}</dd>
                            </div>
                            <div>
                              <dt>Missing evidence</dt>
                              <dd>{remediation.missingEvidence}</dd>
                            </div>
                            <div>
                              <dt>Next action</dt>
                              <dd>{remediation.nextAction}</dd>
                            </div>
                          </dl>
                          <AdminTextLink href={remediation.href}>{remediation.linkLabel}</AdminTextLink>
                          <details>
                            <summary>Technical details</summary>
                            <code>{blocker.code}</code>
                          </details>
                        </section>
                      );
                    })}
                  </div>
                  <p className="admin-mt-12">
                    <AdminTextLink href={recheckHref}>Recheck evidence</AdminTextLink>
                  </p>
                </section>
              ) : null}

              <section aria-labelledby="settlement-repair-policy-title" className="admin-mt-16">
                <h3 id="settlement-repair-policy-title">Policy gate</h3>
                <AdminNoticeCard
                  role={policyDecision === 'APPROVED' ? 'status' : 'alert'}
                  tone={policyDecision === 'APPROVED' ? 'success' : 'danger'}
                >
                  <strong>{policyDecision.replace('_', ' ')}</strong>
                  <p className="muted">Policy version: {preview.policyVersion ?? 'Current policy'}</p>
                  {preview.blockers.length ? (
                    <p className="muted">
                      Blocked by {preview.blockers.length} evidence issue(s) listed above. Repair remains locked
                      until a new preview passes.
                    </p>
                  ) : policyReasons.length ? (
                    <ul>
                      {policyReasons.map((reason, index) => (
                        <li key={`${policyExceptionCodes[index] ?? 'POLICY'}-${index}`}>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Technical evidence and retained finance policy both passed.</p>
                  )}
                  {policyDecision === 'REVIEW_REQUIRED' ? (
                    <p>
                      <AdminTextLink href="/finance-tax/payment-fees">
                        Review payment fee policy evidence
                      </AdminTextLink>
                    </p>
                  ) : null}
                  {policyDecision !== 'APPROVED' ? (
                    <p>
                      <AdminTextLink href={`/bookings/${encodeURIComponent(preview.bookingId)}`}>
                        Open source booking evidence
                      </AdminTextLink>
                    </p>
                  ) : null}
                </AdminNoticeCard>
              </section>

              {repairApproved ? (
                <section aria-labelledby="settlement-repair-approval-title" className="admin-mt-16">
                  <h3 id="settlement-repair-approval-title">Approval</h3>
                <AdminDrawerFormGrid action={action} className="service-menu-dialog-form admin-mt-16">
                  <input name="bookingId" type="hidden" value={preview.bookingId} />
                  <input name="sourceVersion" type="hidden" value={preview.sourceVersion ?? ''} />
                  <input name="range" type="hidden" value={returnFilters.range} />
                  <input name="settlementAge" type="hidden" value={returnFilters.settlementAge} />
                  <input name="settlementPage" type="hidden" value={String(returnFilters.settlementPage)} />
                  <input
                    name="settlementPaymentMethod"
                    type="hidden"
                    value={returnFilters.settlementPaymentMethod}
                  />
                  <input name="settlementPeriod" type="hidden" value={returnFilters.settlementPeriod} />
                  <input name="settlementTrack" type="hidden" value={returnFilters.settlementTrack} />
                  <input name="q" type="hidden" value={returnFilters.q} />
                  <AdminFormSelect
                    defaultValue=""
                    label="Approving finance admin"
                    labelVisibility="visible"
                    name="approvalAdminId"
                    options={[
                      { label: 'Select a different finance approver', value: '' },
                      ...financeApprovers.map((approver) => ({
                        label: `${approver.fullName || approver.email || approver.phone || approver.id} · ${approver.id}`,
                        value: approver.id,
                      })),
                    ]}
                    required
                  />
                  <AdminFormTextarea
                    label="Repair reason"
                    labelVisibility="visible"
                    maxLength={500}
                    minLength={12}
                    name="reason"
                    required
                    rows={4}
                  />
                  <p className="muted">Use at least 12 non-whitespace characters and state the evidence basis.</p>
                  <AdminFormInput
                    autoComplete="off"
                    label="Confirm booking ID"
                    labelVisibility="visible"
                    name="confirmationBookingId"
                    required
                  />

                  {financeApprovers.length === 0 ? (
                    <AdminNoticeCard role="alert" tone="danger">
                      <strong>No finance approver available</strong>
                      <p className="muted">Grant the FINANCE_APPROVER role before attempting this repair.</p>
                    </AdminNoticeCard>
                  ) : null}

                  <AdminDrawerActionFooter className="service-menu-dialog-footer">
                    <AdminFormControlButton
                      className="button-primary"
                      disabled={financeApprovers.length === 0}
                      type="submit"
                    >
                      <ShieldCheck aria-hidden="true" size={16} />
                      {isHistorical ? 'Reconstruct historical settlement' : 'Create missing settlement'}
                    </AdminFormControlButton>
                    <AdminFormControlLink className="button-secondary" href={closeHref}>
                      Cancel
                    </AdminFormControlLink>
                  </AdminDrawerActionFooter>
                </AdminDrawerFormGrid>
                </section>
              ) : null}
            </>
          )}
        </div>
      </AdminDrawerSurface>
    </>
  );
}

type SettlementBlocker = AdminBookingSettlementGapRepairPreview['blockers'][number];

function settlementBlockerRemediation(
  preview: AdminBookingSettlementGapRepairPreview,
  blocker: SettlementBlocker,
) {
  const bookingHref = `/bookings/${encodeURIComponent(preview.bookingId)}`;
  const code = blocker.code.toUpperCase();

  if (code === 'SETTLEMENT_EXISTS') {
    return {
      responsibleTeam: 'Finance Operations',
      missingEvidence: 'The existing settlement record must be reconciled before another repair is considered.',
      nextAction: 'Open the settlement ledger, confirm the existing snapshot, then return and recheck.',
      href: `/finance-tax/booking-settlement-audit?q=${encodeURIComponent(preview.bookingId)}`,
      linkLabel: 'Open settlement records',
    };
  }
  if (code.includes('MONTHLY_PERIOD')) {
    return {
      responsibleTeam: 'Finance Close & Tax',
      missingEvidence: 'The monthly close state does not permit this settlement repair.',
      nextAction: 'Review the monthly close and its retained evidence before requesting another preview.',
      href: `/finance-tax/monthly-tax-closing?period=${encodeURIComponent(preview.monthlyPeriod)}`,
      linkLabel: 'Open monthly close',
    };
  }
  if (code.includes('PAYMENT')) {
    return {
      responsibleTeam: 'Payments Operations',
      missingEvidence: 'A captured payment and its retained payment evidence are required.',
      nextAction: 'Verify payment status, amount, and callback evidence, then recheck this repair.',
      href: preview.payment ? `/payments/${encodeURIComponent(preview.payment.id)}` : bookingHref,
      linkLabel: preview.payment ? 'Open payment evidence' : 'Open booking payment evidence',
    };
  }
  if (code.includes('PLATFORM_FEE')) {
    return {
      responsibleTeam: 'Finance Policy',
      missingEvidence: 'Platform-fee logs or the applicable fee policy do not reconcile.',
      nextAction: 'Review the fee policy and retained fee logs before running the preview again.',
      href: '/finance-tax/payment-fees',
      linkLabel: 'Open payment fee policy',
    };
  }
  if (code.includes('VAT')) {
    return {
      responsibleTeam: 'Finance Close & Tax',
      missingEvidence: 'Platform VAT evidence or the applicable VAT rate is incomplete.',
      nextAction: 'Reconcile the period VAT evidence, then return and recheck.',
      href: `/finance-tax/platform-vat?period=${encodeURIComponent(preview.monthlyPeriod)}`,
      linkLabel: 'Open platform VAT',
    };
  }
  if (code.includes('TAX') || code.includes('WITHHOLDING')) {
    return {
      responsibleTeam: 'Finance Close & Tax',
      missingEvidence: 'Partner withholding evidence or the applicable tax rate is incomplete.',
      nextAction: 'Reconcile the Partner tax evidence for this period, then recheck.',
      href: `/finance-tax/partner-withholding-tax?period=${encodeURIComponent(preview.monthlyPeriod)}`,
      linkLabel: 'Open Partner withholding',
    };
  }
  if (code.includes('WALLET')) {
    return {
      responsibleTeam: 'Finance Operations',
      missingEvidence: 'The retained Partner wallet lifecycle does not reconcile with the paid earning.',
      nextAction: 'Review the Partner wallet ledger and correct the evidence before rechecking.',
      href: preview.partner
        ? `/wallet-adjustments?view=records&recordOwnerId=${encodeURIComponent(preview.partner.id)}`
        : bookingHref,
      linkLabel: preview.partner ? 'Open Partner wallet records' : 'Open booking evidence',
    };
  }
  if (code.includes('EARNING') || code.includes('PAYOUT')) {
    return {
      responsibleTeam: 'Partner Finance',
      missingEvidence: 'The Partner earning or payout lifecycle does not match the booking evidence.',
      nextAction: 'Verify the earning status and payout linkage before running another preview.',
      href: preview.earning ? `/earnings?q=${encodeURIComponent(preview.earning.id)}` : bookingHref,
      linkLabel: preview.earning ? 'Open Partner earning' : 'Open booking evidence',
    };
  }

  return {
    responsibleTeam: 'Booking Operations',
    missingEvidence: 'Booking, Partner, service, coupon, or amount evidence is incomplete or inconsistent.',
    nextAction: 'Correct the source booking evidence, then return and run the preview again.',
    href: bookingHref,
    linkLabel: 'Open source booking evidence',
  };
}
