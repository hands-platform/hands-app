'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';

import { adminNavSections } from '../lib/admin-navigation';
import { AdminShellNav } from './admin-shell-nav';
import { AdminWorkspaceHeader } from './admin-workspace-header';

type AdminRootShellProps = {
  readonly children: ReactNode;
};

export function AdminRootShell({ children }: AdminRootShellProps) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return <div className="auth-shell">{children}</div>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <strong>HANDS Admin</strong>
        </div>
        <Suspense fallback={<nav className="nav" aria-label="Admin navigation" />}>
          <AdminShellNav sections={adminNavSections} />
        </Suspense>
      </aside>
      <main className="content">
        <Suspense fallback={<header className="topbar vuexy-navbar" aria-label="Admin workspace" />}>
          <AdminWorkspaceHeader sections={adminNavSections} />
        </Suspense>
        <div className="content-inner">{children}</div>
      </main>
    </div>
  );
}
