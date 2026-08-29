'use client';

import '../app/globals.css';
import type { ReactNode } from 'react';
import { Suspense, useEffect, useState } from 'react';
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
type ConfirmationReturnFocusTarget = {
  readonly href?: string;
  readonly index?: number;
  readonly pathname?: string;
  readonly triggerIndex?: number;
  readonly triggerLabel?: string;
};

type ConfirmationFocusDocument = Pick<Document, 'getElementById' | 'querySelectorAll'>;

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
      const trigger = link
        .closest('.admin-action-dropdown')
        ?.querySelector<HTMLButtonElement>(':scope > button[aria-label]');
      const triggerLabel = trigger?.getAttribute('aria-label') ?? '';
      const matchingTriggers = triggerLabel
        ? Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]')).filter(
            (candidate) => candidate.getAttribute('aria-label') === triggerLabel,
          )
        : [];
      sessionStorage.setItem(
        confirmationReturnFocusKey,
        JSON.stringify({
          href,
          index: matchingLinks.indexOf(link),
          pathname: window.location.pathname,
          triggerIndex: trigger ? matchingTriggers.indexOf(trigger) : -1,
          triggerLabel,
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
      const target = JSON.parse(stored) as ConfirmationReturnFocusTarget;
      if (!restoreConfirmationFocus(target, window.location.pathname, document)) {
        sessionStorage.removeItem(confirmationReturnFocusKey);
        return;
      }
      sessionStorage.removeItem(confirmationReturnFocusKey);
    } catch {
      sessionStorage.removeItem(confirmationReturnFocusKey);
      document.getElementById('admin-main-content')?.focus();
    }
  });

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

export function restoreConfirmationFocus(
  target: ConfirmationReturnFocusTarget,
  currentPathname: string,
  focusDocument: ConfirmationFocusDocument,
) {
  if (target.pathname !== currentPathname) return false;

  const matchingTriggers = target.triggerLabel
    ? Array.from(focusDocument.querySelectorAll<HTMLButtonElement>('button[aria-label]')).filter(
        (button) => button.getAttribute('aria-label') === target.triggerLabel,
      )
    : [];
  const trigger = matchingTriggers[target.triggerIndex ?? 0];
  const matchingLinks = target.href
    ? Array.from(focusDocument.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
        (link) => link.getAttribute('href') === target.href,
      )
    : [];
  const link = matchingLinks[target.index ?? 0];
  const legacyTarget = link?.closest('details')?.querySelector<HTMLElement>(':scope > summary') ?? link;
  (trigger ?? legacyTarget ?? focusDocument.getElementById('admin-main-content'))?.focus();
  return true;
}
