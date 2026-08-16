'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton } from '../../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../../components/admin-surface';
import { useAdminModalFocus } from '../../../components/use-admin-modal-focus';

type FinanceApproverDrawerShellProps = {
  readonly children: ReactNode;
  readonly returnFocusHref?: string;
  readonly returnHref: string;
  readonly title: string;
};

export const FINANCE_APPROVER_FORM_SUCCESS_EVENT = 'finance-approver-form-succeeded';
export const FINANCE_APPROVER_REQUEST_CLOSE_EVENT = 'finance-approver-request-close';

export function FinanceApproverDrawerShell({
  children,
  returnFocusHref,
  returnHref,
  title,
}: FinanceApproverDrawerShellProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement>(null);
  const titleId = 'finance-approver-drawer-title';

  useEffect(() => {
    returnFocusRef.current = returnFocusHref
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
          (link) => link.getAttribute('href') === returnFocusHref,
        ) ?? null
      : null;
  }, [returnFocusHref]);

  const restoreFocusAfterNavigation = useCallback(() => {
    if (!returnFocusHref) return;

    const findReturnLink = () =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
        (link) => link.getAttribute('href') === returnFocusHref,
      ) ?? null;
    let settled = false;
    let pendingFrame: number | null = null;
    const observer = new MutationObserver(() => {
      if (settled || pendingFrame !== null) return;
      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = null;
        const returnLink = findReturnLink();
        if (!returnLink?.isConnected) return;
        returnLink.focus({ preventScroll: true });
        settled = true;
        observer.disconnect();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => {
      if (!settled) {
        findReturnLink()?.focus({ preventScroll: true });
      }
      observer.disconnect();
      if (pendingFrame !== null) window.cancelAnimationFrame(pendingFrame);
    }, 1_000);
  }, [returnFocusHref]);

  const onClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard the finance access review input?')) return;
    restoreFocusAfterNavigation();
    router.replace(returnHref, { scroll: false });
  }, [restoreFocusAfterNavigation, returnHref, router]);

  useEffect(() => {
    const clearDirty = () => {
      dirtyRef.current = false;
    };
    const requestClose = () => {
      onClose();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(FINANCE_APPROVER_FORM_SUCCESS_EVENT, clearDirty);
    window.addEventListener(FINANCE_APPROVER_REQUEST_CLOSE_EVENT, requestClose);
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => {
      window.removeEventListener(FINANCE_APPROVER_FORM_SUCCESS_EVENT, clearDirty);
      window.removeEventListener(FINANCE_APPROVER_REQUEST_CLOSE_EVENT, requestClose);
      window.removeEventListener('beforeunload', warnBeforeUnload);
    };
  }, [onClose]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef);

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close finance access review" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Finance approval access review"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer finance-approver-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div
          onChangeCapture={() => {
            dirtyRef.current = true;
          }}
          onInputCapture={() => {
            dirtyRef.current = true;
          }}
        >
          <div className="calendar-drawer-header">
            <h2 id={titleId}>{title}</h2>
            <AdminFormControlButton
              aria-label="Close finance access review"
              className="button-secondary calendar-icon-button"
              onClick={onClose}
              title="Close finance access review"
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </AdminFormControlButton>
          </div>
          <div className="calendar-drawer-body">{children}</div>
        </div>
      </AdminDrawerSurface>
    </>
  );
}
