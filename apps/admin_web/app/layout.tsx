import './globals.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { AdminDesktopOnlyGate } from '../components/admin-desktop-only-gate';
import { AdminOperatorAccessGate } from '../components/admin-operator-access-gate';
import { AdminRootShell } from '../components/admin-root-shell';
import { AdminThemeScript } from '../components/admin-theme-script';
import { getCurrentAdminOperatorAccessResult } from '../lib/admin-operator-access';
import { adminNavSectionsForAccess } from '../lib/admin-navigation';

export const metadata: Metadata = {
  title: {
    default: 'HANDS Admin',
    template: '%s · HANDS Admin',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestPathname = (await headers()).get('x-admin-pathname')?.split('?', 1)[0];
  if (requestPathname === '/login') {
    return (
      <html data-skin="default" lang="en" suppressHydrationWarning>
        <head>
          <AdminThemeScript />
        </head>
        <body>
          <AdminDesktopOnlyGate>
            <div className="auth-shell">{children}</div>
          </AdminDesktopOnlyGate>
        </body>
      </html>
    );
  }

  const operatorAccessResult = await getCurrentAdminOperatorAccessResult();
  const operatorAccess = operatorAccessResult.data;
  const navSections = adminNavSectionsForAccess(operatorAccess);

  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
        <AdminDesktopOnlyGate>
          <AdminRootShell sections={navSections}>
            <AdminOperatorAccessGate operatorAccess={operatorAccess} operatorAccessAvailable={operatorAccessResult.ok}>{children}</AdminOperatorAccessGate>
          </AdminRootShell>
        </AdminDesktopOnlyGate>
      </body>
    </html>
  );
}
