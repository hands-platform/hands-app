'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import { AdminFormControlButton } from './admin-form-controls';
import { AdminIconButton } from './admin-icon-button';

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
  return (
    <ClientActionDropdownSurface
      className={className}
      label={label}
      menuClassName={menuClassName}
      triggerClassName={triggerClassName}
    >
      {actions.map((item, itemIndex) => (
        <ClientActionDropdownControl
          item={item}
          itemClassName={readItemClassName(item, itemClassName)}
          key={`${item.label}:${itemIndex}`}
        />
      ))}
    </ClientActionDropdownSurface>
  );
}

export function ClientActionDropdownSurface({
  children,
  className,
  label,
  menuClassName,
  title,
  triggerClassName,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly label: string;
  readonly menuClassName?: string;
  readonly title?: ReactNode;
  readonly triggerClassName?: string;
}) {
  const pathname = usePathname();
  const currentPathname = pathname ?? '__unknown_route__';
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const open = openPathname === currentPathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const internalTriggerRef = useRef<HTMLButtonElement>(null);
  const componentId = useId();
  const menuId = `${componentId}-menu`;

  useEffect(() => {
    if (!open) {
      return;
    }

    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPathname(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPathname(null);
        internalTriggerRef.current?.focus();
      }
    }

    function closeWhenAnotherMenuOpens(event: Event) {
      const openedId = (event as CustomEvent<string>).detail;
      if (openedId !== componentId) setOpenPathname(null);
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('admin-action-dropdown-open', closeWhenAnotherMenuOpens);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('admin-action-dropdown-open', closeWhenAnotherMenuOpens);
    };
  }, [componentId, open]);

  function moveMenuFocus(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;

    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'),
    );
    if (items.length === 0) return;

    event.preventDefault();
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Home') items[0]?.focus();
    else if (event.key === 'End') items.at(-1)?.focus();
    else if (event.key === 'ArrowDown') items[(currentIndex + 1 + items.length) % items.length]?.focus();
    else items[(currentIndex - 1 + items.length) % items.length]?.focus();
  }

  return (
    <div className={joinClassNames('admin-action-dropdown', className)} ref={rootRef}>
      <AdminIconButton
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={joinClassNames('admin-action-trigger', triggerClassName)}
        onClick={() => {
          if (!open) {
            document.dispatchEvent(new CustomEvent('admin-action-dropdown-open', { detail: componentId }));
          }
          setOpenPathname((value) => value === currentPathname ? null : currentPathname);
        }}
        ref={internalTriggerRef}
        type="button"
      >
        <MoreVertical aria-hidden="true" size={20} />
      </AdminIconButton>
      {open ? (
        <div
          aria-label={`${label} menu`}
          className={joinClassNames('admin-action-menu', menuClassName)}
          id={menuId}
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('[role="menuitem"]')) {
              setOpenPathname(null);
              internalTriggerRef.current?.focus();
            }
          }}
          onKeyDown={moveMenuFocus}
          role="menu"
        >
          {title ? <strong className="action-menu-title">{title}</strong> : null}
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ClientActionDropdownControl({
  item,
  itemClassName,
}: {
  readonly item: ClientActionDropdownItem;
  readonly itemClassName?: string;
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
      <Link className={className} href={item.href} prefetch={false} role="menuitem" title={item.description}>
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
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
