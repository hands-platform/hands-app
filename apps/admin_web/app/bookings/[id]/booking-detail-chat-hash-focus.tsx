'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

const BOOKING_CHAT_HASH = '#booking-chat-history';

export function BookingDetailChatHashFocus() {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';

  useEffect(() => {
    let frame = 0;
    const focusTranscript = () => {
      window.cancelAnimationFrame(frame);
      if (window.location.hash !== BOOKING_CHAT_HASH) return;
      const target = document.getElementById(BOOKING_CHAT_HASH.slice(1));
      if (!target) return;
      frame = openBookingChatDisclosuresAndFocus(target, window.requestAnimationFrame);
    };

    focusTranscript();
    window.addEventListener('hashchange', focusTranscript);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', focusTranscript);
    };
  }, [pathname, search]);

  return null;
}

export function openBookingChatDisclosuresAndFocus(
  target: HTMLElement,
  requestFrame: (callback: FrameRequestCallback) => number,
) {
  let disclosure = target.parentElement?.closest('details');
  while (disclosure) {
    disclosure.open = true;
    disclosure = disclosure.parentElement?.closest('details') ?? null;
  }

  return requestFrame(() => {
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  });
}
