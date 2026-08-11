import type { ReactNode } from 'react';

import { ActionMenu } from '../../components/action-menu';
import { ClientActionDropdown } from '../../components/client-action-dropdown';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import type { TaxFinanceWorkflowLink } from './tax-settlement-page-model';

const FINANCE_WORKFLOW_INLINE_LIMIT = 4;

export function TaxFinanceWorkflowActions({
  children,
  links,
}: {
  readonly children?: ReactNode;
  readonly links: readonly TaxFinanceWorkflowLink[];
}) {
  if (links.length > FINANCE_WORKFLOW_INLINE_LIMIT) {
    const [primaryLink, ...secondaryLinks] = links;

    return (
      <div className="tax-finance-workflow-actions">
        {children}
        {primaryLink ? (
          <AdminFormControlLink className="button-secondary" href={primaryLink.href}>
            {primaryLink.label}
          </AdminFormControlLink>
        ) : null}
        <ClientActionDropdown
          actions={secondaryLinks.map((link) => ({ href: link.href, label: link.label }))}
          className="tax-finance-workflow-dropdown"
          itemClassName="tax-finance-workflow-dropdown-link"
          label="More finance pages"
          menuClassName="tax-finance-workflow-dropdown-menu"
          triggerClassName="button-secondary tax-finance-workflow-dropdown-trigger"
        />
      </div>
    );
  }

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
