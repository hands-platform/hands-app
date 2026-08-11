'use client';

import type { ReactNode } from 'react';

type AdminDetailsProps = {
  readonly 'aria-label'?: string;
  readonly 'aria-labelledby'?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
  readonly name?: string;
  readonly open?: boolean;
};

export function closeAdminDetailsOnEscape(key: string, details: HTMLDetailsElement) {
  if (key !== 'Escape' || !details.open) return false;

  details.open = false;
  details.querySelector('summary')?.focus();
  return true;
}

export function AdminDetails({ children, ...props }: AdminDetailsProps) {
  return (
    <details
      {...props}
      suppressHydrationWarning
      onKeyDown={(event) => {
        if (!closeAdminDetailsOnEscape(event.key, event.currentTarget)) return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {children}
    </details>
  );
}
