import Link from 'next/link';
import type { ReactNode } from 'react';

import { MoreVertical } from 'lucide-react';

import type { StatusBadgeTone } from './status-badge';
import { statusBadgeClassName } from './status-badge';

type FormAction = string | ((formData: FormData) => void | Promise<void>);

type ActionMenuHiddenInput = {
  readonly name: string;
  readonly value: boolean | number | string;
};

type ActionMenuBaseItem = {
  readonly description?: ReactNode;
  readonly disabled?: boolean;
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
  readonly label: string;
  readonly title?: ReactNode;
  readonly variant?: 'dropdown' | 'pill-list';
};

export function actionMenuItemClassName(item: Pick<ActionMenuBaseItem, 'disabled' | 'tone'>) {
  if (item.disabled) {
    return statusBadgeClassName('neutral');
  }
  return statusBadgeClassName(item.tone ?? 'info');
}

export function ActionMenu({ actions, label, title, variant = 'pill-list' }: ActionMenuProps) {
  if (variant === 'dropdown') {
    return (
      <details className="admin-action-dropdown action-menu-dropdown">
        <summary aria-label={label} className="admin-action-trigger action-menu-trigger">
          <MoreVertical aria-hidden="true" size={18} />
        </summary>
        <div className="admin-action-menu action-menu-panel" role="menu">
          {title ? <strong className="action-menu-title">{title}</strong> : null}
          {actions.map((item) => (
            <ActionMenuDropdownControl item={item} key={`${item.kind}:${item.label}`} />
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

function ActionMenuDropdownControl({ item }: { readonly item: ActionMenuItem }) {
  if (item.kind === 'link') {
    if (item.disabled) {
      return (
        <span
          aria-disabled="true"
          className="admin-action-item is-disabled"
          role="menuitem"
          title={readActionMenuTitle(item.description)}
        >
          {item.label}
        </span>
      );
    }

    return (
      <Link className="admin-action-item" href={item.href} role="menuitem" title={readActionMenuTitle(item.description)}>
        {item.label}
      </Link>
    );
  }

  return (
    <form action={item.action} className="admin-action-form" role="none">
      {item.hiddenInputs?.map((input) => (
        <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <button
        className="admin-action-item admin-action-button"
        disabled={item.disabled}
        role="menuitem"
        title={readActionMenuTitle(item.description)}
        type="submit"
      >
        {item.label}
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
