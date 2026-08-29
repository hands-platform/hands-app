'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

import { AdminDrawerBackdropButton } from '../../components/admin-drawer-backdrop-button';
import { AdminFormControlButton } from '../../components/admin-form-controls';
import { AdminDrawerSurface } from '../../components/admin-surface';
import { useAdminModalFocus } from '../../components/use-admin-modal-focus';

type ServiceCatalogDrawerShellProps = {
  readonly children: ReactNode;
  readonly returnFocusHref?: string;
  readonly returnHref: string;
  readonly title: string;
};

const ServiceCatalogDrawerContext = createContext<{
  requestClose: () => void;
  setChildModalOpen: (open: boolean) => void;
} | null>(null);

export function useServiceCatalogDrawer() {
  const context = useContext(ServiceCatalogDrawerContext);
  if (!context) throw new Error('Service catalog editor must be rendered inside its drawer.');
  return context;
}

export function ServiceCatalogDrawerShell({
  children,
  returnFocusHref,
  returnHref,
  title,
}: ServiceCatalogDrawerShellProps) {
  const router = useRouter();
  const [childModalOpen, setChildModalOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const dirtyRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement>(null);
  const titleId = 'service-catalog-drawer-title';

  useEffect(() => {
    returnFocusRef.current = returnFocusHref
      ? Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).find(
          (link) => link.getAttribute('href') === returnFocusHref,
        ) ?? null
      : null;
  }, [returnFocusHref]);

  const onClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm('Discard unsaved service catalog changes?')) return;
    router.replace(returnHref, { scroll: false });
  }, [returnHref, router]);

  useAdminModalFocus(drawerRef, onClose, returnFocusRef, !childModalOpen);
  const contextValue = useMemo(
    () => ({ requestClose: onClose, setChildModalOpen }),
    [onClose],
  );

  return (
    <>
      <AdminDrawerBackdropButton aria-label="Close service catalog drawer" onClick={onClose} />
      <AdminDrawerSurface
        ariaLabel="Service catalog editor"
        ariaLabelledBy={titleId}
        ariaModal
        className="calendar-drawer service-menu-dialog"
        surfaceRef={drawerRef}
        tabIndex={-1}
      >
        <ServiceCatalogDrawerContext.Provider value={contextValue}>
        <div
          className="service-menu-dialog-shell"
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
              aria-label="Close service catalog drawer"
              className="button-secondary calendar-icon-button"
              onClick={onClose}
              title="Close service catalog drawer"
              type="button"
            >
              <X aria-hidden="true" size={16} />
            </AdminFormControlButton>
          </div>
          <div className="calendar-drawer-body">{children}</div>
        </div>
        </ServiceCatalogDrawerContext.Provider>
      </AdminDrawerSurface>
    </>
  );
}
