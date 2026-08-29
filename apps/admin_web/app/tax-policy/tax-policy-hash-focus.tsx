'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

export function TaxPolicyHashFocus() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';

  useEffect(() => {
    let frame = 0;
    let observer: MutationObserver | null = null;
    let timeout = 0;

    const stopWaiting = () => {
      observer?.disconnect();
      observer = null;
      if (timeout) window.clearTimeout(timeout);
      timeout = 0;
    };

    const focusTarget = () => {
      if (!window.location.hash) return true;
      let id = window.location.hash.slice(1);
      try {
        id = decodeURIComponent(id);
      } catch {
        return true;
      }
      const target = document.getElementById(id);
      if (!target) return false;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      target.focus({ preventScroll: true });
      return true;
    };

    const focusWhenReady = () => {
      stopWaiting();
      if (focusTarget()) return;
      observer = new MutationObserver(() => {
        if (focusTarget()) stopWaiting();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = window.setTimeout(stopWaiting, 5_000);
    };

    const handleHashChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(focusWhenReady);
    };

    frame = window.requestAnimationFrame(focusWhenReady);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.cancelAnimationFrame(frame);
      stopWaiting();
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [pathname, search]);
  return null;
}
