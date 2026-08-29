'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import {
  AdminDrawerActionFooter,
  AdminDrawerFormGrid,
  AdminFormControlButton,
  AdminFormInput,
  AdminFormStaticValue,
  AdminFormTextarea,
} from '../../components/admin-form-controls';
import { AdminDetailGrid, AdminDrawerSurface, AdminNoticeCard } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';

type FormAction = (formData: FormData) => void | Promise<void>;

export type PayoutTransferEvidenceDrawerModel = {
  readonly amountLabel: string;
  readonly bankAccountDetail: string;
  readonly bankAccountLabel: string;
  readonly expectedStatus: string;
  readonly id: string;
  readonly notes: string;
  readonly partnerLabel: string;
  readonly partnerPhone: string;
  readonly phase: string;
  readonly riskDetail: string;
  readonly riskLabel: string;
  readonly shortId: string;
  readonly statusLabel: string;
  readonly transferRef: string;
};

type PayoutTransferEvidenceDrawerProps = {
  readonly action: FormAction;
  readonly closeHref: string;
  readonly detail: PayoutTransferEvidenceDrawerModel | null;
  readonly detailLoaded: boolean;
};

export function PayoutTransferEvidenceDrawer({
  action,
  closeHref,
  detail,
  detailLoaded,
}: PayoutTransferEvidenceDrawerProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const closeRequestedRef = useRef(false);
  const onClose = useCallback(() => {
    if (closeRequestedRef.current) return;
    closeRequestedRef.current = true;
    router.replace(closeHref, { scroll: false });
    const closeUrl = new URL(closeHref, window.location.href);
    window.history.replaceState(
      window.history.state,
      '',
      `${closeUrl.pathname}${closeUrl.search}${closeUrl.hash}`,
    );
  }, [closeHref, router]);

  useEffect(() => {
    returnFocusRef.current = detail
      ? document
          .getElementById(`payout-transfer-trigger-${detail.id}`)
          ?.querySelector<HTMLElement>('a, button') ?? null
      : null;
  }, [detail]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef);

  const titleId = 'payout-transfer-evidence-drawer-title';

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close payout transfer evidence editor" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Payout transfer evidence editor"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer service-menu-dialog payout-transfer-evidence-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="service-menu-dialog-shell">
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">Bank transfer evidence</span>
            <h2 id={titleId}>{detail?.partnerLabel ?? 'Payout batch unavailable'}</h2>
            <p className="muted">{detail?.shortId ?? 'The selected payout could not be loaded.'}</p>
          </div>
          <AdminFormControlButton
            aria-label="Close payout transfer evidence editor"
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlButton>
        </div>

        <div className="calendar-drawer-body">
          {!detailLoaded || !detail ? (
            <AdminNoticeCard role="alert" tone="danger">
              <strong>Transfer evidence unavailable</strong>
              <p className="muted">
                The exact payout batch could not be loaded. Close this drawer and refresh the queue before
                changing financial evidence.
              </p>
            </AdminNoticeCard>
          ) : (
            <>
              <AdminDetailGrid ariaLabel="Selected payout transfer context">
                <AdminFormStaticValue
                  label="Partner"
                  labelVisibility="visible"
                  value={`${detail.partnerLabel} · ${detail.partnerPhone}`}
                />
                <AdminFormStaticValue label="Amount" labelVisibility="visible" value={detail.amountLabel} />
                <AdminFormStaticValue
                  label="Bank account"
                  labelVisibility="visible"
                  value={`${detail.bankAccountLabel} · ${detail.bankAccountDetail}`}
                />
                <AdminFormStaticValue
                  label="Current stage"
                  labelVisibility="visible"
                  value={`${detail.statusLabel} · ${detail.phase}`}
                />
                <AdminFormStaticValue
                  label="Current reference"
                  labelVisibility="visible"
                  value={detail.transferRef || 'Not recorded'}
                />
              </AdminDetailGrid>

              <AdminNoticeCard className="admin-mt-16" tone={detail.riskLabel === 'Clear' ? 'success' : 'warning'}>
                <StatusBadge tone={detail.riskLabel === 'Clear' ? 'success' : 'warning'}>
                  {detail.riskLabel}
                </StatusBadge>
                <p className="muted admin-mt-6">{detail.riskDetail}</p>
              </AdminNoticeCard>

              <AdminDrawerFormGrid action={action} className="admin-mt-16">
                <input name="payoutBatchId" type="hidden" value={detail.id} />
                <input name="expectedStatus" type="hidden" value={detail.expectedStatus} />
                <input name="expectedTransferRef" type="hidden" value={detail.transferRef} />
                <input name="expectedNotes" type="hidden" value={detail.notes} />
                <AdminFormInput
                  defaultValue={detail.transferRef}
                  label="Transfer reference"
                  labelVisibility="visible"
                  maxLength={120}
                  name="transferRef"
                  placeholder="Bank transfer reference"
                />
                <AdminFormTextarea
                  defaultValue={detail.notes}
                  label="Transfer note"
                  labelVisibility="visible"
                  maxLength={500}
                  name="notes"
                  placeholder="Evidence checked, bank response, or exception detail"
                  rows={3}
                />
                <AdminFormTextarea
                  label="Change reason"
                  labelVisibility="visible"
                  maxLength={1000}
                  minLength={10}
                  name="reason"
                  placeholder="Why this financial evidence is changing"
                  required
                  rows={3}
                />
                <AdminFormInput
                  autoComplete="off"
                  label={`Reconfirm full batch ID: ${detail.id}`}
                  labelVisibility="visible"
                  maxLength={128}
                  name="confirmationPayoutBatchId"
                  placeholder={detail.id}
                  required
                />
                <AdminDrawerActionFooter>
                  <AdminFormControlButton className="button-secondary" onClick={onClose} type="button">
                    Cancel
                  </AdminFormControlButton>
                  <AdminFormControlButton className="button-primary" type="submit">
                    Save transfer evidence
                  </AdminFormControlButton>
                </AdminDrawerActionFooter>
              </AdminDrawerFormGrid>
            </>
          )}
        </div>
        </div>
      </AdminDrawerSurface>
    </>
  );
}
