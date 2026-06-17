import Link from 'next/link';
import { MoreVertical } from 'lucide-react';

import type { CustomerActionLink } from './customer-action-links';

type CustomerActionDropdownProps = {
  readonly actions: readonly CustomerActionLink[];
  readonly label: string;
};

export function CustomerActionDropdown({ actions, label }: CustomerActionDropdownProps) {
  return (
    <details className="vuexy-customer-action-dropdown">
      <summary aria-label={label} className="vuexy-customer-action-trigger">
        <MoreVertical aria-hidden="true" size={18} />
      </summary>
      <div className="vuexy-customer-action-menu" role="menu">
        {actions.map((action) => (
          <CustomerActionMenuItem action={action} key={action.label} />
        ))}
      </div>
    </details>
  );
}

function CustomerActionMenuItem({ action }: { readonly action: CustomerActionLink }) {
  const Icon = action.icon;

  return (
    <Link className="vuexy-customer-action-item" href={action.href} role="menuitem">
      <Icon aria-hidden="true" size={16} />
      <span>{action.label}</span>
    </Link>
  );
}
