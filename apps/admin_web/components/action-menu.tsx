import Link from 'next/link';
import type { FormHTMLAttributes, ReactNode } from 'react';

import { MoreVertical, type LucideIcon } from 'lucide-react';

import { AdminFormControlButton, AdminFormControlLink } from './admin-form-controls';
import { ClientActionDropdownSurface } from './client-action-dropdown';
import type { StatusBadgeTone } from './status-badge';
import { StatusBadge, StatusBadgeButton, StatusBadgeLink, statusBadgeClassName } from './status-badge';

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
  readonly managedDropdown?: boolean;
  readonly menuClassName?: string;
  readonly title?: ReactNode;
  readonly triggerClassName?: string;
  readonly variant?: 'button-list' | 'dropdown' | 'pill-list';
};

type ActionMenuDropdownFormProps = {
  readonly children: ReactNode;
  readonly className?: string;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'children' | 'className'>;

export function actionMenuItemClassName(item: Pick<ActionMenuBaseItem, 'disabled' | 'tone'>) {
  return statusBadgeClassName(actionMenuItemTone(item));
}

function actionMenuItemTone(item: Pick<ActionMenuBaseItem, 'disabled' | 'tone'>): StatusBadgeTone {
  return item.disabled ? 'neutral' : (item.tone ?? 'info');
}

export function ActionMenu({
  actions,
  className,
  itemClassName,
  label,
  managedDropdown = false,
  menuClassName,
  title,
  triggerClassName,
  variant = 'pill-list',
}: ActionMenuProps) {
  if (variant === 'dropdown') {
    const children = actions.map((item, itemIndex) => (
      <ActionMenuDropdownControl
        item={item}
        itemClassName={itemClassName}
        key={`${item.kind}:${item.label}:${itemIndex}`}
      />
    ));

    if (managedDropdown) {
      return (
        <ClientActionDropdownSurface
          className={className ?? 'action-menu-dropdown'}
          label={label}
          menuClassName={menuClassName ?? 'action-menu-panel'}
          title={title}
          triggerClassName={triggerClassName ?? 'action-menu-trigger'}
        >
          {children}
        </ClientActionDropdownSurface>
      );
    }

    return ActionMenuDropdownSurface({
      children,
      className: className ?? 'action-menu-dropdown',
      label,
      menuClassName: menuClassName ?? 'action-menu-panel',
      title,
      triggerClassName: triggerClassName ?? 'action-menu-trigger',
    });
  }

  if (variant === 'button-list') {
    return (
      <nav aria-label={label} className={joinClassNames('action-menu action-menu-button-list', className)}>
        {title ? <strong className="action-menu-title">{title}</strong> : null}
        <div className={joinClassNames('action-menu-button-list-items', menuClassName)}>
          {actions.map((item, itemIndex) => (
            <ActionMenuButtonListControl
              item={item}
              itemClassName={itemClassName}
              key={`${item.kind}:${item.label}:${itemIndex}`}
            />
          ))}
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label={label} className="action-menu">
      {title ? <strong>{title}</strong> : null}
      <div className="participant-list">
        {actions.map((item, itemIndex) => (
          <ActionMenuControl item={item} key={`${item.kind}:${item.label}:${itemIndex}`} />
        ))}
      </div>
    </nav>
  );
}

function ActionMenuButtonListControl({
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
          className={joinClassNames('admin-form-control-link button button-secondary is-disabled', itemClassName)}
          title={readActionMenuTitle(item.description)}
        >
          {content}
        </span>
      );
    }

    return (
      <AdminFormControlLink
        aria-label={item.ariaLabel}
        className={joinClassNames('button-secondary', itemClassName)}
        href={item.href}
        title={readActionMenuTitle(item.description)}
      >
        {content}
      </AdminFormControlLink>
    );
  }

  return (
    <form action={item.action} className="action-menu-form action-menu-button-form">
      {item.hiddenInputs?.map((input, inputIndex) => (
        <input key={`${input.name}-${inputIndex}`} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <AdminFormControlButton
        aria-label={item.ariaLabel}
        className={joinClassNames('button-secondary', itemClassName)}
        disabled={item.disabled}
        title={readActionMenuTitle(item.description)}
        type="submit"
      >
        {content}
      </AdminFormControlButton>
    </form>
  );
}

export function ActionMenuDropdownSurface({
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
  return (
    <details className={joinClassNames('admin-action-dropdown', className ?? 'action-menu-dropdown')}>
      <summary aria-label={label} className={joinClassNames('admin-action-trigger', triggerClassName ?? 'action-menu-trigger')}>
        <MoreVertical aria-hidden="true" size={18} />
      </summary>
      <div className={joinClassNames('admin-action-menu', menuClassName ?? 'action-menu-panel')} role="menu">
        {title ? <strong className="action-menu-title">{title}</strong> : null}
        {children}
      </div>
    </details>
  );
}

export function ActionMenuDropdownForm({
  children,
  className,
  role = 'none',
  ...formProps
}: ActionMenuDropdownFormProps) {
  return (
    <form {...formProps} className={joinClassNames('admin-action-form', className)} role={role}>
      {children}
    </form>
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
        prefetch={false}
        role="menuitem"
        title={readActionMenuTitle(item.description)}
      >
        {content}
      </Link>
    );
  }

  return (
    <ActionMenuDropdownForm action={item.action}>
      {item.hiddenInputs?.map((input, inputIndex) => (
        <input key={`${input.name}-${inputIndex}`} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <AdminFormControlButton
        aria-label={item.ariaLabel}
        className={joinClassNames('button-secondary admin-action-item admin-action-button', itemClassName)}
        disabled={item.disabled}
        role="menuitem"
        title={readActionMenuTitle(item.description)}
        type="submit"
      >
        {content}
      </AdminFormControlButton>
    </ActionMenuDropdownForm>
  );
}

function ActionMenuControl({ item }: { readonly item: ActionMenuItem }) {
  if (item.kind === 'link') {
    if (item.disabled) {
      return (
        <StatusBadge
          ariaDisabled
          title={readActionMenuTitle(item.description)}
          tone={actionMenuItemTone(item)}
        >
          {item.label}
        </StatusBadge>
      );
    }

    return (
      <StatusBadgeLink href={item.href} title={readActionMenuTitle(item.description)} tone={actionMenuItemTone(item)}>
        {item.label}
      </StatusBadgeLink>
    );
  }

  return (
    <form action={item.action} className="action-menu-form">
      {item.hiddenInputs?.map((input, inputIndex) => (
        <input key={`${input.name}-${inputIndex}`} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <StatusBadgeButton
        disabled={item.disabled}
        title={readActionMenuTitle(item.description)}
        tone={actionMenuItemTone(item)}
        type="submit"
      >
        {item.label}
      </StatusBadgeButton>
    </form>
  );
}

export function readActionMenuTitle(description: ReactNode) {
  return typeof description === 'string' ? description : undefined;
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames
    .flatMap((className) => className?.split(/\s+/).filter(Boolean) ?? [])
    .filter((className, index, values) => values.indexOf(className) === index)
    .join(' ');
}
