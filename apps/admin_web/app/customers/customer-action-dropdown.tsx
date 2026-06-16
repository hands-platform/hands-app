import Link from 'next/link';
import { Eye, MessageSquareText, MoreVertical, ReceiptText } from 'lucide-react';

type CustomerActionDropdownProps = {
  readonly chatHref: string;
  readonly detailHref: string;
  readonly label: string;
  readonly paymentsHref: string;
};

export function CustomerActionDropdown({
  chatHref,
  detailHref,
  label,
  paymentsHref,
}: CustomerActionDropdownProps) {
  return (
    <details className="vuexy-customer-action-dropdown">
      <summary aria-label={label} className="vuexy-customer-action-trigger">
        <MoreVertical aria-hidden="true" size={18} />
      </summary>
      <div className="vuexy-customer-action-menu" role="menu">
        <Link className="vuexy-customer-action-item" href={detailHref} role="menuitem">
          <Eye aria-hidden="true" size={16} />
          <span>View profile</span>
        </Link>
        <Link className="vuexy-customer-action-item" href={paymentsHref} role="menuitem">
          <ReceiptText aria-hidden="true" size={16} />
          <span>Payment records</span>
        </Link>
        <Link className="vuexy-customer-action-item" href={chatHref} role="menuitem">
          <MessageSquareText aria-hidden="true" size={16} />
          <span>Chat archive</span>
        </Link>
      </div>
    </details>
  );
}
