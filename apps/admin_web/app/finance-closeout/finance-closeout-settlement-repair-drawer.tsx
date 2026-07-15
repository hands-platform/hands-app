import { ShieldCheck, X } from 'lucide-react';

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
import { MoneyText } from '../../components/money-text';
import { StatusBadge } from '../../components/status-badge';

type FinanceCloseoutSettlementRepairDrawerProps = {
  readonly action: (formData: FormData) => void | Promise<void>;
  readonly approvers: readonly AdminUser[];
  readonly closeHref: string;
  readonly preview: AdminBookingSettlementGapRepairPreview | null;
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
  returnFilters,
}: FinanceCloseoutSettlementRepairDrawerProps) {
  const financeApprovers = approvers.filter((approver) => approver.roles.includes('FINANCE_APPROVER'));
  const isHistorical = preview?.repairMode === 'HISTORICAL_PAID_EVIDENCE_RECONSTRUCTION';

  return (
    <>
      <a aria-label="Close settlement repair preview" className="calendar-drawer-backdrop" href={closeHref} />
      <AdminDrawerSurface
        ariaLabel="Settlement repair preview"
        ariaModal
        className="calendar-drawer service-menu-dialog"
        role="dialog"
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Governed finance repair</span>
            <h2>Settlement repair preview</h2>
          </div>
          <AdminFormControlLink
            aria-label="Close settlement repair preview"
            className="button-secondary calendar-icon-button"
            href={closeHref}
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlLink>
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
              <AdminNoticeCard tone={preview.canRepair ? 'warning' : 'danger'}>
                <strong>{preview.canRepair ? 'Eligible for controlled repair' : 'Repair blocked'}</strong>
                <p className="muted">
                  {isHistorical
                    ? 'This action preserves the paid earning and wallet lifecycle, then reconstructs the missing snapshot, journal, and non-cash clearing from retained evidence.'
                    : 'This action reruns the canonical completed-booking settlement path while preserving any existing earning lifecycle.'}{' '}
                  Monthly closing, payment, and dual-approval controls remain enforced.
                </p>
                <StatusBadge tone={preview.canRepair ? 'warning' : 'danger'}>
                  {preview.canRepair ? 'Dual approval required' : `${preview.blockers.length} blocker(s)`}
                </StatusBadge>
              </AdminNoticeCard>

              <AdminDetailGrid ariaLabel="Settlement repair evidence" className="admin-mt-16">
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

              {preview.blockers.length ? (
                <AdminNoticeCard className="admin-mt-16" role="alert" tone="danger">
                  <strong>Resolve before repair</strong>
                  <ul>
                    {preview.blockers.map((blocker) => (
                      <li key={blocker.code}>{blocker.message}</li>
                    ))}
                  </ul>
                </AdminNoticeCard>
              ) : null}

              {preview.canRepair ? (
                <AdminDrawerFormGrid action={action} className="service-menu-dialog-form admin-mt-16">
                  <input name="bookingId" type="hidden" value={preview.bookingId} />
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
                    minLength={8}
                    name="reason"
                    required
                    rows={4}
                  />
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
              ) : null}
            </>
          )}
        </div>
      </AdminDrawerSurface>
    </>
  );
}
