import type { ReactNode } from 'react';

export function AdminCard({ children, className, ariaLabel }: { readonly ariaLabel: string; readonly children: ReactNode; readonly className: string }) {
  return <section aria-label={ariaLabel} className={`card admin-card ${className}`}>{children}</section>;
}
