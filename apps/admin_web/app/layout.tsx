import './globals.css';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { AdminShellNav } from '../components/admin-shell-nav';
import { AdminThemeScript } from '../components/admin-theme-script';
import { AdminWorkspaceHeader } from '../components/admin-workspace-header';
import { adminNavSections } from '../lib/admin-navigation';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
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
      </body>
    </html>
  );
}
