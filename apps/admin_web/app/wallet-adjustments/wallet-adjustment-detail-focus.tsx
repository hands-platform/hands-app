'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export function WalletAdjustmentDetailFocusManager({ targetId }: { readonly targetId: string }) {
  useEffect(() => {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    target?.focus();
    const url = new URL(window.location.href);
    url.searchParams.delete('returnFocus');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [targetId]);
  return null;
}

export function WalletAdjustmentDetailPanel({
  children,
  closeHref,
  headingId,
}: {
  readonly children: ReactNode;
  readonly closeHref: string;
  readonly headingId: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.getElementById(headingId)?.focus();
    const panel = panelRef.current;
    if (!panel) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      router.push(closeHref, { scroll: false });
    };
    panel.addEventListener('keydown', closeOnEscape);
    return () => panel.removeEventListener('keydown', closeOnEscape);
  }, [closeHref, headingId, router]);

  return (
    <section
      aria-labelledby={headingId}
      className="wallet-adjustment-evidence-panel"
      id="wallet-adjustment-detail"
      ref={panelRef}
    >
      {children}
    </section>
  );
}
