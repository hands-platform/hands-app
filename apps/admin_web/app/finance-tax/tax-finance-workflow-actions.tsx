import type { ReactNode } from 'react';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

import { ActionMenu } from '../../components/action-menu';
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
        {children ? (
          <details className="tax-finance-workflow-dropdown tax-finance-workflow-export-dropdown">
            <summary
              aria-label="Finance export actions"
              className="admin-form-control-button button button-secondary tax-finance-workflow-dropdown-trigger"
            >
              <span>Export CSV</span>
              <ChevronDown aria-hidden="true" size={16} />
            </summary>
            <div className="admin-action-menu tax-finance-workflow-dropdown-menu tax-finance-workflow-export-menu" role="menu">
              {children}
            </div>
          </details>
        ) : null}
        {primaryLink ? (
          <AdminFormControlLink className="button-secondary" href={primaryLink.href}>
            {primaryLink.label}
          </AdminFormControlLink>
        ) : null}
        <details className="tax-finance-workflow-dropdown">
          <summary
            aria-label="More finance workflow actions"
            className="admin-form-control-button button button-secondary tax-finance-workflow-dropdown-trigger"
          >
            <span>More finance pages</span>
            <ChevronDown aria-hidden="true" size={16} />
          </summary>
          <div className="admin-action-menu tax-finance-workflow-dropdown-menu" role="menu">
            {secondaryLinks.map((link) => (
              <Link
                className="admin-action-item tax-finance-workflow-dropdown-link"
                href={link.href}
                key={link.key}
                prefetch={false}
                role="menuitem"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
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
