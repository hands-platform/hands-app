'use client';

import type { KeyboardEvent, ReactNode } from 'react';

export function WebsiteContentTableScroll({ ariaLabel, children, className = '' }: { ariaLabel: string; children: ReactNode; className?: string }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const next = websiteContentTableScrollLeft(element.scrollLeft, element.scrollWidth, event.key);
    if (next === null) return;
    element.scrollLeft = next;
    event.preventDefault();
  }

  return <div aria-label={ariaLabel} className={`admin-table-scroll ${className}`.trim()} onKeyDown={handleKeyDown} role="region" tabIndex={0}>{children}</div>;
}

export function websiteContentTableScrollLeft(current: number, maximum: number, key: string) {
  if (key === 'ArrowRight') return current + 80;
  if (key === 'ArrowLeft') return Math.max(0, current - 80);
  if (key === 'Home') return 0;
  if (key === 'End') return maximum;
  return null;
}
