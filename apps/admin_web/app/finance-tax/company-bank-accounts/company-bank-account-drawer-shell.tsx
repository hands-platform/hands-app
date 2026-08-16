'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton } from '../../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../../components/admin-surface';
import { useAdminModalFocus } from '../../../components/use-admin-modal-focus';

type CompanyBankAccountDrawerShellProps = {
  readonly children: ReactNode;
  readonly returnFocusHref?: string;
  readonly returnHref: string;
  readonly title: string;
};

const CompanyBankAccountDrawerCloseContext = createContext<(() => void) | null>(null);

export function CompanyBankAccountDrawerCancelButton() {
  const onClose = useContext(CompanyBankAccountDrawerCloseContext);
  return (
    <AdminFormControlButton className="button-secondary" onClick={onClose ?? undefined} type="button">
      Cancel
    </AdminFormControlButton>
  );
}

export function CompanyBankAccountDrawerShell({
  children,
  returnFocusHref,
  returnHref,
  title,
}: CompanyBankAccountDrawerShellProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement>(null);
  const titleId = 'company-bank-account-drawer-title';

  useEffect(() => {
    returnFocusRef.current = returnFocusHref
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
          (link) => link.getAttribute('href') === returnFocusHref,
        ) ?? null
      : null;
  }, [returnFocusHref]);

  const onClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard unsaved company bank account changes?')) return;
    router.replace(returnHref, { scroll: false });
  }, [returnHref, router]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef);

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close company bank account drawer" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Company bank account editor"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer company-bank-account-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <CompanyBankAccountDrawerCloseContext.Provider value={onClose}>
          <div
            onChangeCapture={() => {
              dirtyRef.current = true;
            }}
            onInputCapture={() => {
              dirtyRef.current = true;
            }}
            onSubmitCapture={() => {
              dirtyRef.current = false;
            }}
          >
          <div className="calendar-drawer-header">
            <div>
              <span className="eyebrow">Finance control</span>
              <h2 id={titleId}>{title}</h2>
            </div>
            <AdminFormControlButton
              aria-label="Close company bank account drawer"
              className="button-secondary calendar-icon-button"
              onClick={onClose}
              title="Close company bank account drawer"
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </AdminFormControlButton>
          </div>
          <div className="calendar-drawer-body">{children}</div>
          </div>
        </CompanyBankAccountDrawerCloseContext.Provider>
      </AdminDrawerSurface>
    </>
  );
}
