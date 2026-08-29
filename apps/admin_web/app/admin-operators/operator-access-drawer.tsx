'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../components/admin-surface';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';

export function OperatorAccessDrawer({
  children,
  returnFocusHref,
  returnHref,
  title,
}: {
  readonly children: ReactNode;
  readonly returnFocusHref?: string;
  readonly returnHref: string;
  readonly title: string;
}) {
  const router = useRouter();
  const drawerRef = useRef<HTMLElement>(null);
  const [focusManagementActive, setFocusManagementActive] = useState(false);
  const returnFocusRef = useRef<HTMLElement>(null);
  const titleId = 'operator-access-drawer-title';
  const closeLabel = `Close ${title}`;

  useEffect(() => {
    returnFocusRef.current = returnFocusHref
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
          (link) => link.getAttribute('href') === returnFocusHref,
        ) ?? null
      : null;
  }, [returnFocusHref]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFocusManagementActive(true));

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const onClose = useCallback(() => {
    router.replace(returnHref, { scroll: false });
  }, [returnHref, router]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef, focusManagementActive);

  return (
    <>
      <AdminDrawerBackdropButton aria-hidden="true" onClick={onClose} tabIndex={-1} />
      <AdminDrawerSurface
        ariaLabel="Operator Access detail"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer operator-access-drawer"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <div className="calendar-drawer-header">
          <h2 id={titleId}>{title}</h2>
          <AdminFormControlButton
            aria-label={closeLabel}
            className="button-secondary calendar-icon-button"
            onClick={onClose}
            title={closeLabel}
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
