'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function TaxPolicyHashFocus() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';

  useEffect(() => {
    const focusTarget = () => {
      if (!window.location.hash) return;
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      target.focus({ preventScroll: true });
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
