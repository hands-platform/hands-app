'use client';

import Link from 'next/link';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { AdminFormControlButton } from './admin-form-controls';

type ClientActionDropdownBaseItem = {
  readonly description?: string;
  readonly disabled?: boolean;
  readonly icon?: LucideIcon;
  readonly label: string;
  readonly tone?: string;
};

type ClientActionDropdownLinkItem = ClientActionDropdownBaseItem & {
  readonly href: string;
  readonly onSelect?: never;
};

type ClientActionDropdownButtonItem = ClientActionDropdownBaseItem & {
  readonly href?: never;
  readonly onSelect: () => void;
};

export type ClientActionDropdownItem = ClientActionDropdownLinkItem | ClientActionDropdownButtonItem;

type ClientActionDropdownProps = {
  readonly actions: readonly ClientActionDropdownItem[];
  readonly className?: string;
  readonly itemClassName?: string | ((item: ClientActionDropdownItem) => string);
  readonly label: string;
  readonly menuClassName?: string;
  readonly triggerClassName?: string;
};

export function ClientActionDropdown({
  actions,
  className,
  itemClassName,
  label,
  menuClassName,
  triggerClassName,
}: ClientActionDropdownProps) {
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
    <div className={joinClassNames('admin-action-dropdown', className)} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={joinClassNames('admin-action-trigger', triggerClassName)}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <MoreVertical aria-hidden="true" size={20} />
      </button>
      {open ? (
        <div className={joinClassNames('admin-action-menu', menuClassName)} role="menu">
          {actions.map((item) => (
            <ClientActionDropdownControl
              item={item}
              itemClassName={readItemClassName(item, itemClassName)}
              key={item.label}
              onSelect={() => setOpen(false)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ClientActionDropdownControl({
  item,
  itemClassName,
  onSelect,
}: {
  readonly item: ClientActionDropdownItem;
  readonly itemClassName?: string;
  readonly onSelect: () => void;
}) {
  const Icon = item.icon;
  const className = joinClassNames('admin-action-item', itemClassName, item.disabled ? 'is-disabled' : undefined);
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" size={16} /> : null}
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

  if (typeof item.href === 'string') {
    return (
      <Link className={className} href={item.href} onClick={onSelect} role="menuitem" title={item.description}>
        {content}
      </Link>
    );
  }

  const handleItemSelect = item.onSelect;

  return (
    <AdminFormControlButton
      className={joinClassNames('button-secondary', className)}
      onClick={() => {
        handleItemSelect();
        onSelect();
      }}
      role="menuitem"
      title={item.description}
      type="button"
    >
      {content}
    </AdminFormControlButton>
  );
}

function readItemClassName(
  item: ClientActionDropdownItem,
  itemClassName?: string | ((item: ClientActionDropdownItem) => string),
) {
  return typeof itemClassName === 'function' ? itemClassName(item) : itemClassName;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
