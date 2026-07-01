import './globals.css';
import type { ReactNode } from 'react';
import { AdminRootShell } from '../components/admin-root-shell';
import { AdminThemeScript } from '../components/admin-theme-script';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
        <AdminRootShell>{children}</AdminRootShell>
      </body>
    </html>
  );
}
