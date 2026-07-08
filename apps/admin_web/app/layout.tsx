import './globals.css';
import type { ReactNode } from 'react';
import { AdminOperatorAccessGate } from '../components/admin-operator-access-gate';
import { AdminRootShell } from '../components/admin-root-shell';
import { AdminThemeScript } from '../components/admin-theme-script';
import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import { adminNavSectionsForAccess } from '../lib/admin-navigation';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const navSections = adminNavSectionsForAccess(operatorAccess);

  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
        <AdminRootShell sections={navSections}>
          <AdminOperatorAccessGate operatorAccess={operatorAccess}>{children}</AdminOperatorAccessGate>
        </AdminRootShell>
      </body>
    </html>
  );
}
