'use client';

import type { ReactNode } from 'react';
import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import type { AdminNavSection } from '../lib/admin-navigation';
import { AdminIconButton } from './admin-icon-button';
import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader } from './admin-workspace-header';
import { AdminWorkspaceLocalNav } from './admin-workspace-local-nav';

type AdminRootShellProps = {
  readonly children: ReactNode;
  readonly sections: readonly AdminNavSection[];
};

const confirmationReturnFocusKey = 'hands-admin-confirmation-return-focus';
const confirmationSearchKeys = [
  'confirm',
  'confirmPublish',
  'controlAction',
  'deviceAction',
  'deletePageId',
  'deleteSectionId',
  'discardDraft',
  'drawer',
  'editCouponId',
  'repairBookingId',
  'reviewAction',
  'rollbackRevisionId',
  'usageCouponId',
];

export function AdminRootShell({ children, sections }: AdminRootShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  useEffect(() => {
    function rememberConfirmationTrigger(event: MouseEvent) {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!(event.target instanceof Element)) return;

      const link = event.target.closest<HTMLAnchorElement>('a[href]');
      const href = link?.getAttribute('href');
      if (!link || !href) return;

      const search = new URL(href, window.location.href).searchParams;
      if (!confirmationSearchKeys.some((key) => search.has(key))) return;

      const matchingLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
        (candidate) => candidate.getAttribute('href') === href,
      );
      sessionStorage.setItem(
        confirmationReturnFocusKey,
        JSON.stringify({
          href,
          index: matchingLinks.indexOf(link),
          pathname: window.location.pathname,
        }),
      );
    }

    document.addEventListener('click', rememberConfirmationTrigger, true);
    return () => document.removeEventListener('click', rememberConfirmationTrigger, true);
  }, []);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (confirmationSearchKeys.some((key) => search.has(key))) return;

    const stored = sessionStorage.getItem(confirmationReturnFocusKey);
    if (!stored) return;

    try {
      const target = JSON.parse(stored) as { href?: string; index?: number; pathname?: string };
      if (target.pathname !== window.location.pathname || !target.href) return;

      const matchingLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
        (link) => link.getAttribute('href') === target.href,
      );
      const link = matchingLinks[target.index ?? 0];
      (link?.closest('details')?.querySelector<HTMLElement>(':scope > summary') ?? link)?.focus();
      sessionStorage.removeItem(confirmationReturnFocusKey);
    } catch {
      sessionStorage.removeItem(confirmationReturnFocusKey);
    }
  });

  if (pathname === '/login') {
    return <div className="auth-shell">{children}</div>;
  }

  return (
    <div className="shell" data-mobile-nav-open={mobileNavigationOpen ? 'true' : undefined}>
      <a className="admin-skip-link" href="#admin-main-content">
        Skip to main content
      </a>
      <button
        aria-hidden={mobileNavigationOpen ? undefined : true}
        aria-label="Close navigation menu"
        className="sidebar-backdrop"
        onClick={() => setMobileNavigationOpen(false)}
        tabIndex={mobileNavigationOpen ? 0 : -1}
        type="button"
      />
      <aside className="sidebar" id="admin-mobile-sidebar">
        <div className="brand-block">
          <strong>HANDS Admin</strong>
          <button
            aria-label="Close navigation menu"
            className="sidebar-close-button"
            onClick={() => setMobileNavigationOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <Suspense fallback={<nav className="nav" aria-label="Admin navigation" />}>
          <AdminShellNav onNavigate={() => setMobileNavigationOpen(false)} sections={sections} />
        </Suspense>
      </aside>
      <main className="content" id="admin-main-content" tabIndex={-1}>
        <Suspense fallback={<header className="topbar vuexy-navbar" aria-label="Admin workspace" />}>
          <AdminWorkspaceHeader
            navigationToggle={
              <AdminIconButton
                aria-controls="admin-mobile-sidebar"
                aria-expanded={mobileNavigationOpen}
                aria-label="Open navigation menu"
                className="topbar-icon-chip topbar-icon-button topbar-mobile-menu-button"
                onClick={() => setMobileNavigationOpen((open) => !open)}
              >
                <Menu aria-hidden="true" size={18} />
              </AdminIconButton>
            }
            sections={sections}
          />
        </Suspense>
        <Suspense fallback={null}>
          <AdminWorkspaceLocalNav sections={sections} />
        </Suspense>
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
