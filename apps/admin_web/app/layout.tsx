import './login.css';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { AdminDesktopOnlyGate } from '../components/admin-desktop-only-gate';
import { AdminRootShellLoader } from '../components/admin-root-shell-loader';
import { AdminThemeScript } from '../components/admin-theme-script';
import { getCurrentAdminOperatorAccessResult } from '../lib/admin-operator-access';

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

  const [{ AdminOperatorAccessGate }, { adminNavSectionsForAccess }] = await Promise.all([
    import('../components/admin-operator-access-gate'),
    import('../lib/admin-navigation'),
  ]);
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
          <AdminRootShellLoader sections={navSections}>
            <AdminOperatorAccessGate operatorAccess={operatorAccess} operatorAccessAvailable={operatorAccessResult.ok}>{children}</AdminOperatorAccessGate>
          </AdminRootShellLoader>
        </AdminDesktopOnlyGate>
      </body>
    </html>
  );
}
