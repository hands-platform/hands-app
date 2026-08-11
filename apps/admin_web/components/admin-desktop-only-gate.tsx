import type { ReactNode } from 'react';
import { Monitor } from 'lucide-react';

export function AdminDesktopOnlyGate({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <main className="admin-desktop-only-blocker" role="main">
        <div
          aria-describedby="admin-desktop-only-description"
          aria-labelledby="admin-desktop-only-title"
          className="admin-desktop-only-message"
          role="alert"
        >
          <span aria-hidden="true" className="admin-desktop-only-icon">
            <Monitor size={28} strokeWidth={2} />
          </span>
          <div>
            <strong className="admin-desktop-only-title" id="admin-desktop-only-title">
              Desktop required
            </strong>
            <p id="admin-desktop-only-description">
              Use a screen at least 1024 px wide to make Admin changes.
            </p>
          </div>
        </div>
      </main>
      <div className="admin-desktop-only-app">{children}</div>
    </>
  );
}
