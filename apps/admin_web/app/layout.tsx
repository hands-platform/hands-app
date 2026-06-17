import './globals.css';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import {
  MapPinned,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AdminShellNav } from '../components/admin-shell-nav';
import { AdminThemeScript } from '../components/admin-theme-script';
import { AdminThemeToggle } from '../components/admin-theme-toggle';
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
              <span className="brand-mark" aria-hidden="true">
                <Sparkles size={18} strokeWidth={2.4} />
              </span>
              <div>
                <strong>HANDS Admin</strong>
                <span>Operations Command Center</span>
              </div>
            </div>
            <Suspense fallback={<nav className="nav" aria-label="Admin navigation" />}>
              <AdminShellNav sections={adminNavSections} />
            </Suspense>
          </aside>
          <main className="content">
            <header className="topbar" aria-label="Admin workspace">
              <div>
                <span className="topbar-eyebrow">HANDS VN MVP</span>
                <strong>Operations Command Center</strong>
              </div>
              <div className="topbar-actions" aria-label="Workspace status">
                <AdminThemeToggle />
                <span className="topbar-chip">
                  <MapPinned aria-hidden="true" size={14} />
                  Vietnam Operations
                </span>
                <span className="topbar-chip topbar-chip-primary">
                  <ShieldCheck aria-hidden="true" size={14} />
                  Live Workspace
                </span>
              </div>
            </header>
            <div className="content-inner">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
