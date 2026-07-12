import type { ReactNode } from 'react';

import { ActionMenu } from '../../components/action-menu';
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
      <ActionMenu
        actions={links.map((link) => ({
          href: link.href,
          kind: 'link',
          label: link.label,
          tone: 'info',
        }))}
        label="Finance workflow actions"
        variant="button-list"
      />
    </>
  );
}
