import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';
import type { ReactNode } from 'react';
import { AdminOperatorAccessGate } from '../components/admin-operator-access-gate';
import { AdminRootShell } from '../components/admin-root-shell';
import { AdminThemeScript } from '../components/admin-theme-script';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-skin="default" lang="en" suppressHydrationWarning>
      <head>
        <AdminThemeScript />
      </head>
      <body>
        <AdminRootShell>
          <AdminOperatorAccessGate>{children}</AdminOperatorAccessGate>
        </AdminRootShell>
      </body>
    </html>
  );
}
