'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import { StatusBadge } from '../../components/status-badge';

export function OperatorInvitationsDisclosure({
  children,
  pendingCount,
}: {
  readonly children: ReactNode;
  readonly pendingCount: number;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const openedFromHashRef = useRef(false);
  const summaryRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const revealFromHash = () => {
      if (window.location.hash === '#invitations') {
        if (detailsRef.current) detailsRef.current.open = true;
        openedFromHashRef.current = true;
        requestAnimationFrame(() => {
          summaryRef.current?.focus({ preventScroll: true });
          summaryRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
        return;
      }
      if (openedFromHashRef.current && detailsRef.current) {
        detailsRef.current.open = false;
      }
      openedFromHashRef.current = false;
    };

    revealFromHash();
    window.addEventListener('hashchange', revealFromHash);
    return () => window.removeEventListener('hashchange', revealFromHash);
  }, []);

  return (
    <details ref={detailsRef}>
      <summary ref={summaryRef}>
        Invitations{' '}
        <StatusBadge tone={pendingCount ? 'warning' : 'neutral'}>{pendingCount} pending</StatusBadge>
      </summary>
      {children}
    </details>
  );
}
