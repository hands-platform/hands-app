'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const PAYOUT_RECORD_HASH = /^(payout-batch|withdrawal)-[A-Za-z0-9_-]+$/u;

export function focusPayoutRecordHashTarget(target: HTMLElement, reducedMotion: boolean) {
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  target.focus({ preventScroll: true });
}

export function PayoutRecordHashFocus() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';

  useEffect(() => {
    const focusTarget = () => {
      let targetId = '';
      try {
        targetId = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      if (!PAYOUT_RECORD_HASH.test(targetId)) return;
      const target = document.getElementById(targetId);
      if (!target) return;
      focusPayoutRecordHashTarget(
        target,
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    };
    const frame = window.requestAnimationFrame(focusTarget);
    window.addEventListener('hashchange', focusTarget);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', focusTarget);
    };
  }, [pathname, search]);

  return null;
}
