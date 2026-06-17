import Link from 'next/link';
import type { ReactNode } from 'react';

import { MoreVertical, type LucideIcon } from 'lucide-react';

import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

type FormAction = string | ((formData: FormData) => void | Promise<void>);

type ActionMenuHiddenInput = {
  readonly name: string;
  readonly value: boolean | number | string;
};

type ActionMenuBaseItem = {
  readonly ariaLabel?: string;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly icon?: LucideIcon;
  readonly label: string;
  readonly tone?: StatusBadgeTone;
};

type ActionMenuLinkItem = ActionMenuBaseItem & {
  readonly href: string;
  readonly kind: 'link';
};

type ActionMenuSubmitItem = ActionMenuBaseItem & {
  readonly action: FormAction;
  readonly hiddenInputs?: readonly ActionMenuHiddenInput[];
  readonly kind: 'submit';
};

export type ActionMenuItem = ActionMenuLinkItem | ActionMenuSubmitItem;

type ActionMenuProps = {
  readonly actions: readonly ActionMenuItem[];
  readonly className?: string;
  readonly itemClassName?: string;
  readonly label: string;
  readonly menuClassName?: string;
  readonly title?: ReactNode;
  readonly triggerClassName?: string;
  readonly variant?: 'dropdown' | 'pill-list';
};

export function actionMenuItemClassName(item: Pick<ActionMenuBaseItem, 'disabled' | 'tone'>) {
  if (item.disabled) {
    return statusBadgeClassName('neutral');
  }
  return statusBadgeClassName(item.tone ?? 'info');
}

export function ActionMenu({
  actions,
  className,
  itemClassName,
  label,
  menuClassName,
  title,
  triggerClassName,
  variant = 'pill-list',
}: ActionMenuProps) {
  if (variant === 'dropdown') {
    return (
      <details className={joinClassNames('admin-action-dropdown', className ?? 'action-menu-dropdown')}>
        <summary aria-label={label} className={joinClassNames('admin-action-trigger', triggerClassName ?? 'action-menu-trigger')}>
          <MoreVertical aria-hidden="true" size={18} />
        </summary>
        <div className={joinClassNames('admin-action-menu', menuClassName ?? 'action-menu-panel')} role="menu">
          {title ? <strong className="action-menu-title">{title}</strong> : null}
          {actions.map((item) => (
            <ActionMenuDropdownControl item={item} itemClassName={itemClassName} key={`${item.kind}:${item.label}`} />
          ))}
        </div>
      </details>
    );
  }

  return (
    <nav aria-label={label} className="action-menu">
      {title ? <strong>{title}</strong> : null}
      <div className="participant-list">
        {actions.map((item) => (
          <ActionMenuControl item={item} key={`${item.kind}:${item.label}`} />
        ))}
      </div>
    </nav>
  );
}

function ActionMenuDropdownControl({
  item,
  itemClassName,
}: {
  readonly item: ActionMenuItem;
  readonly itemClassName?: string;
}) {
  const Icon = item.icon;
  const content = (
    <>
      {Icon ? <Icon aria-hidden="true" size={16} /> : null}
      <span>{item.label}</span>
    </>
  );

  if (item.kind === 'link') {
    if (item.disabled) {
      return (
        <span
          aria-disabled="true"
          className={joinClassNames('admin-action-item is-disabled', itemClassName)}
          role="menuitem"
          title={readActionMenuTitle(item.description)}
        >
          {content}
        </span>
      );
    }

    return (
      <Link
        aria-label={item.ariaLabel}
        className={joinClassNames('admin-action-item', itemClassName)}
        href={item.href}
        role="menuitem"
        title={readActionMenuTitle(item.description)}
      >
        {content}
      </Link>
    );
  }

  return (
    <form action={item.action} className="admin-action-form" role="none">
      {item.hiddenInputs?.map((input) => (
        <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <button
        aria-label={item.ariaLabel}
        className={joinClassNames('admin-action-item admin-action-button', itemClassName)}
        disabled={item.disabled}
        role="menuitem"
        title={readActionMenuTitle(item.description)}
        type="submit"
      >
        {content}
      </button>
    </form>
  );
}

function ActionMenuControl({ item }: { readonly item: ActionMenuItem }) {
  if (item.kind === 'link') {
    if (item.disabled) {
      return (
        <span aria-disabled="true" className={actionMenuItemClassName(item)} title={readActionMenuTitle(item.description)}>
          {item.label}
        </span>
      );
    }

    return (
      <Link className={actionMenuItemClassName(item)} href={item.href} title={readActionMenuTitle(item.description)}>
        {item.label}
      </Link>
    );
  }

  return (
    <form action={item.action} className="action-menu-form">
      {item.hiddenInputs?.map((input) => (
        <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <button className={actionMenuItemClassName(item)} disabled={item.disabled} title={readActionMenuTitle(item.description)} type="submit">
        {item.label}
      </button>
    </form>
  );
}

export function readActionMenuTitle(description: ReactNode) {
  return typeof description === 'string' ? description : undefined;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
