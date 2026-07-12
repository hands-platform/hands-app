import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { TaxFinanceWorkflowActions } from './tax-finance-workflow-actions';

describe('TaxFinanceWorkflowActions', () => {
  it('renders short workflow links through the shared ActionMenu atom', () => {
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

  it('collapses long finance workflow lists so page headers keep title space', () => {
    const markup = renderToStaticMarkup(
      <TaxFinanceWorkflowActions
        links={[
          { href: '/finance-tax', key: 'overview', label: 'Tax overview' },
          {
            href: '/finance-tax/booking-settlement-audit',
            key: 'booking-settlement-audit',
            label: 'Booking settlement audit',
          },
          { href: '/finance-tax/settlement-reversals', key: 'settlement-reversals', label: 'Settlement reversals' },
          { href: '/finance-tax/general-ledger', key: 'general-ledger', label: 'General ledger' },
          { href: '/finance-tax/payment-clearing', key: 'payment-clearing', label: 'Payment clearing' },
        ]}
      />,
    );

    expect(markup).toContain('tax-finance-workflow-actions');
    expect(markup).toContain('Tax overview');
    expect(markup).toContain('More finance pages');
    expect(markup).toContain('tax-finance-workflow-dropdown-menu');
    expect(markup).toContain('Booking settlement audit');
    expect(markup).toContain('Payment clearing');
    expect(markup).not.toContain('action-menu action-menu-button-list');
  });

  it('keeps export links inside a dropdown when the workflow list is long', () => {
    const markup = renderToStaticMarkup(
      <TaxFinanceWorkflowActions
        links={[
          { href: '/finance-tax', key: 'overview', label: 'Tax overview' },
          { href: '/finance-tax/general-ledger', key: 'general-ledger', label: 'General ledger' },
          { href: '/finance-tax/payment-clearing', key: 'payment-clearing', label: 'Payment clearing' },
          { href: '/finance-tax/bank-reconciliation', key: 'bank-reconciliation', label: 'Bank reconciliation' },
          { href: '/finance-tax/payment-fees', key: 'payment-fees', label: 'Payment fees' },
        ]}
      >
        <a className="pill pill-success" href="/finance-tax/export.csv">
          Export visible CSV
        </a>
      </TaxFinanceWorkflowActions>,
    );

    expect(markup).toContain('tax-finance-workflow-export-dropdown');
    expect(markup).toContain('Finance export actions');
    expect(markup).toContain('Export visible CSV');
    expect(markup).toContain('tax-finance-workflow-export-menu');
  });
});
