'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../components/admin-surface';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';

type CouponDrawerShellProps = {
  readonly children: ReactNode;
  readonly closeHref: string;
  readonly eyebrow: string;
  readonly subtitle?: ReactNode;
  readonly title: string;
  readonly titleId: string;
};

export function CouponDrawerShell({
  children,
  closeHref,
  eyebrow,
  subtitle,
  title,
  titleId,
}: CouponDrawerShellProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const onClose = useCallback(() => router.replace(closeHref, { scroll: false }), [closeHref, router]);

  useEffect(() => {
    const currentHref = `${window.location.pathname}${window.location.search}`;
    returnFocusRef.current = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
      (link) => link.getAttribute('href') === currentHref,
    ) ?? null;
  }, []);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef);

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close coupon workspace" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Coupon workspace"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer coupon-operations-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="calendar-drawer-header">
          <div>
            <span className="calendar-drawer-eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <AdminFormControlButton
            aria-label="Close coupon workspace"
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            title="Close coupon workspace"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </AdminFormControlButton>
        </div>
        <div className="calendar-drawer-body">{children}</div>
      </AdminDrawerSurface>
    </>
  );
}
