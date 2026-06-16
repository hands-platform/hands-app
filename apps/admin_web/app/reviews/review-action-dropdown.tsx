'use client';

import Link from 'next/link';
import { CheckCircle2, EyeOff, Flag, MoreVertical } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { ReviewActionItem } from './review-page-actions';

type ReviewActionDropdownProps = {
  readonly actions: readonly ReviewActionItem[];
  readonly label: string;
};

const actionIcons = {
  'Follow-up': Flag,
  Hold: EyeOff,
  Publish: CheckCircle2,
} as const;

export function ReviewActionDropdown({ actions, label }: ReviewActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="vuexy-review-action-dropdown" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className="vuexy-review-action-trigger"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreVertical aria-hidden="true" size={20} />
      </button>
      {open ? (
        <div className="vuexy-review-action-menu" role="menu">
          {actions.map((item) => (
            <ReviewActionControl item={item} key={item.label} onSelect={() => setOpen(false)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReviewActionControl({
  item,
  onSelect,
}: {
  readonly item: ReviewActionItem;
  readonly onSelect: () => void;
}) {
  const Icon = actionIcons[item.label as keyof typeof actionIcons] ?? Flag;
  const className = `vuexy-review-action-item is-${item.tone}${item.disabled ? ' is-disabled' : ''}`;
  const content = (
    <>
      <Icon aria-hidden="true" size={16} />
      <span>{item.label}</span>
    </>
  );

  if (item.disabled) {
    return (
      <span aria-disabled="true" className={className} role="menuitem" title={item.description}>
        {content}
      </span>
    );
  }

  return (
    <Link className={className} href={item.href} onClick={onSelect} role="menuitem" title={item.description}>
      {content}
    </Link>
  );
}
