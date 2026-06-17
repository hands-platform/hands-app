import { ActionDropdown } from '../../components/action-dropdown';

import type { CustomerActionLink } from './customer-action-links';

type CustomerActionDropdownProps = {
  readonly actions: readonly CustomerActionLink[];
  readonly label: string;
};

export function CustomerActionDropdown({ actions, label }: CustomerActionDropdownProps) {
  return (
    <ActionDropdown
      actions={actions}
      className="vuexy-customer-action-dropdown"
      itemClassName="vuexy-customer-action-item"
      label={label}
      menuClassName="vuexy-customer-action-menu"
      triggerClassName="vuexy-customer-action-trigger"
    />
  );
}
