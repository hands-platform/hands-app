import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { TaxFinanceWorkflowActions } from './tax-finance-workflow-actions';

describe('TaxFinanceWorkflowActions', () => {
  it('renders workflow links through the shared ActionMenu atom', () => {
    const source = readFileSync(join(process.cwd(), 'app/finance-tax/tax-finance-workflow-actions.tsx'), 'utf8');

    expect(source).toContain('ActionMenu');
    expect(source).not.toContain('<Link className="pill pill-info"');

    const markup = renderToStaticMarkup(
      <TaxFinanceWorkflowActions
        links={[
          { href: '/finance-tax/general-ledger', key: 'general-ledger', label: 'General ledger' },
          { href: '/finance-tax/payment-clearing', key: 'payment-clearing', label: 'Payment clearing' },
        ]}
      >
        <a className="pill pill-success" href="/finance-tax/export.csv">
          Export CSV
        </a>
      </TaxFinanceWorkflowActions>,
    );

    expect(markup).toContain('Export CSV');
    expect(markup).toContain('Finance workflow actions');
    expect(markup).toContain('/finance-tax/general-ledger');
    expect(markup).toContain('/finance-tax/payment-clearing');
    expect(markup).toContain('action-menu action-menu-button-list');
    expect(markup).toContain('admin-form-control-link button button-secondary');
    expect(markup).not.toContain('participant-list');
    expect(markup).not.toContain('pill pill-info');
  });
});
