'use client';

import { useRef, type MouseEvent, type ReactNode, type RefObject } from 'react';

import { AdminDrawerBackdropButton } from './admin-drawer-backdrop-button';
import { AdminDialogCard } from './admin-surface';
import { useAdminModalFocus } from './use-admin-modal-focus';

type ConfirmDialogFocusBoundaryProps = {
  readonly ariaDescribedBy: string;
  readonly ariaLabelledBy: string;
  readonly cancelHref: string;
  readonly children: ReactNode;
  readonly id: string;
  readonly loading?: boolean;
  readonly onCancel?: () => void;
  readonly returnFocusRef?: RefObject<HTMLElement | null>;
};

export function ConfirmDialogFocusBoundary({
  ariaDescribedBy,
  ariaLabelledBy,
  cancelHref,
  children,
  id,
  loading,
  onCancel,
  returnFocusRef,
}: ConfirmDialogFocusBoundaryProps) {
  const dialogRef = useRef<HTMLElement>(null);

  function closeDialog() {
    if (onCancel) {
      onCancel();
      return;
    }
    const returnFocus = window.sessionStorage.getItem('hands-admin-confirmation-return-focus');
    if (returnFocus && window.history.length > 1) {
      window.history.back();
      return;
    }
    const cancelUrl = new URL(cancelHref, window.location.href);
    window.sessionStorage.setItem(
      'hands-admin-confirmation-return-focus',
      JSON.stringify({ pathname: cancelUrl.pathname }),
    );
    window.location.assign(cancelHref);
  }

  useAdminModalFocus(dialogRef, closeDialog, returnFocusRef);

  function handleCancelClick(event: MouseEvent<HTMLElement>) {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[href]');
    if (link?.getAttribute('href') !== cancelHref) return;
    event.preventDefault();
    closeDialog();
  }

  return (
    <>
      <AdminDrawerBackdropButton
        aria-label="Cancel confirmation"
        className="confirm-dialog-backdrop"
        onClick={closeDialog}
      />
      <AdminDialogCard
        ariaDescribedBy={ariaDescribedBy}
        ariaLabelledBy={ariaLabelledBy}
        ariaModal
        className="admin-dialog-card"
        id={id}
        loading={loading}
        onClickCapture={handleCancelClick}
        surfaceRef={dialogRef}
        tabIndex={-1}
      >
        {children}
      </AdminDialogCard>
    </>
  );
}
