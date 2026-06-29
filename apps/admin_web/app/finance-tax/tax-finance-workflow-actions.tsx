import Link from 'next/link';
import type { ReactNode } from 'react';

import type { TaxFinanceWorkflowLink } from './tax-settlement-page-model';

export function TaxFinanceWorkflowActions({
  children,
  links,
}: {
  readonly children?: ReactNode;
  readonly links: readonly TaxFinanceWorkflowLink[];
}) {
  return (
    <>
      {children}
      {links.map((link) => (
        <Link className="pill pill-info" href={link.href} key={link.key}>
          {link.label}
        </Link>
      ))}
    </>
  );
}
