import 'react-datepicker/dist/react-datepicker.css';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminDesktopOnlyGate } from '../components/admin-desktop-only-gate';
import { AdminOperatorAccessGate } from '../components/admin-operator-access-gate';
import { AdminRootShell } from '../components/admin-root-shell';
import { AdminThemeScript } from '../components/admin-theme-script';
import { getCurrentAdminOperatorAccess } from '../lib/admin-operator-access';
import { adminNavSectionsForAccess } from '../lib/admin-navigation';

export const metadata: Metadata = {
  title: {
    default: 'HANDS Admin',
    template: '%s · HANDS Admin',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const operatorAccess = await getCurrentAdminOperatorAccess();
  const navSections = adminNavSectionsForAccess(operatorAccess);

  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
        <AdminDesktopOnlyGate>
          <AdminRootShell sections={navSections}>
            <AdminOperatorAccessGate operatorAccess={operatorAccess}>{children}</AdminOperatorAccessGate>
          </AdminRootShell>
        </AdminDesktopOnlyGate>
      </body>
    </html>
  );
}
