import type { LucideIcon } from 'lucide-react';

import { ActionMenu, type ActionMenuItem } from './action-menu';

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
  const menuActions: readonly ActionMenuItem[] = actions.map((action) => ({
    ariaLabel: action.ariaLabel,
    href: action.href,
    icon: action.icon,
    kind: 'link',
    label: action.label,
  }));

  return ActionMenu({
    actions: menuActions,
    className,
    itemClassName,
    label,
    menuClassName,
    triggerClassName,
    variant: 'dropdown',
  });
}
