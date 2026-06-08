import Link from 'next/link';
import type { ReactNode } from 'react';

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
};

export function actionMenuItemClassName(item: Pick<ActionMenuBaseItem, 'disabled' | 'tone'>) {
  if (item.disabled) {
    return statusBadgeClassName('neutral');
  }
  return statusBadgeClassName(item.tone ?? 'info');
}

export function ActionMenu({ actions, label, title }: ActionMenuProps) {
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

function ActionMenuControl({ item }: { readonly item: ActionMenuItem }) {
  if (item.kind === 'link') {
    if (item.disabled) {
      return (
        <span aria-disabled="true" className={actionMenuItemClassName(item)} title={readTitle(item.description)}>
          {item.label}
        </span>
      );
    }

    return (
      <Link className={actionMenuItemClassName(item)} href={item.href} title={readTitle(item.description)}>
        {item.label}
      </Link>
    );
  }

  return (
    <form action={item.action} style={{ display: 'inline' }}>
      {item.hiddenInputs?.map((input) => (
        <input key={input.name} name={input.name} type="hidden" value={String(input.value)} />
      ))}
      <button className={actionMenuItemClassName(item)} disabled={item.disabled} title={readTitle(item.description)} type="submit">
        {item.label}
      </button>
    </form>
  );
}

function readTitle(description: ReactNode) {
  return typeof description === 'string' ? description : undefined;
}
