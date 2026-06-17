import Link from 'next/link';

import { MoreVertical, type LucideIcon } from 'lucide-react';

export type ActionDropdownItem = {
  readonly ariaLabel?: string;
  readonly href: string;
  readonly icon?: LucideIcon;
  readonly label: string;
};

type ActionDropdownProps = {
  readonly actions: readonly ActionDropdownItem[];
  readonly className?: string;
  readonly itemClassName?: string;
  readonly label: string;
  readonly menuClassName?: string;
  readonly triggerClassName?: string;
};

export function ActionDropdown({
  actions,
  className,
  itemClassName,
  label,
  menuClassName,
  triggerClassName,
}: ActionDropdownProps) {
  return (
    <details className={joinClassNames('admin-action-dropdown', className)}>
      <summary aria-label={label} className={joinClassNames('admin-action-trigger', triggerClassName)}>
        <MoreVertical aria-hidden="true" size={18} />
      </summary>
      <div className={joinClassNames('admin-action-menu', menuClassName)} role="menu">
        {actions.map((action) => (
          <ActionDropdownLink action={action} itemClassName={itemClassName} key={action.label} />
        ))}
      </div>
    </details>
  );
}

function ActionDropdownLink({
  action,
  itemClassName,
}: {
  readonly action: ActionDropdownItem;
  readonly itemClassName?: string;
}) {
  const Icon = action.icon;

  return (
    <Link
      aria-label={action.ariaLabel}
      className={joinClassNames('admin-action-item', itemClassName)}
      href={action.href}
      role="menuitem"
    >
      {Icon ? <Icon aria-hidden="true" size={16} /> : null}
      <span>{action.label}</span>
    </Link>
  );
}

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(' ');
}
