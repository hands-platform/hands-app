'use client';

import type { ReactNode } from 'react';
import { Suspense, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import type { AdminNavSection } from '../lib/admin-navigation';
import { AdminIconButton } from './admin-icon-button';
import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader } from './admin-workspace-header';

type AdminRootShellProps = {
  readonly children: ReactNode;
  readonly sections: readonly AdminNavSection[];
};

export function AdminRootShell({ children, sections }: AdminRootShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  if (pathname === '/login') {
    return <div className="auth-shell">{children}</div>;
  }

  return (
    <div className="shell" data-mobile-nav-open={mobileNavigationOpen ? 'true' : undefined}>
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
      <main className="content">
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
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
