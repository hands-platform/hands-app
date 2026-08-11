import { renderToStaticMarkup } from 'react-dom/server';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceDecisionHistorySection } from './operations-handoff-finance-decision-history-section';

describe('OperationsHandoffFinanceDecisionHistorySection', () => {
  it('renders completed Finance decisions separately from open work', () => {
    const section = OperationsHandoffFinanceDecisionHistorySection({
      pagination: {
        activePage: 1,
        ariaLabel: 'Finance decision history pagination',
        hrefForPage: (page) => `/operations-handoff?details=all&decisionPage=${page}`,
        itemLabel: 'finance decisions',
        totalRows: 1,
      },
      rows: [
        {
          actorLabel: 'Finance Approver',
          completedAt: '2026-07-29T02:00:00.000Z',
          detail: 'A maker request passed independent approval and the account was created.',
          href: '/finance-tax/company-bank-accounts',
          id: 'decision-1',
          recordLabel: 'Operating account · Vietcombank · VND',
          status: 'Approved',
          title: 'Company bank account creation',
          tone: 'success',
        },
      ],
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Finance decision history');
    expect(rendered).toContain(
      'Completed approvals, bank reconciliation decisions, refunds, executions, remittances, monthly close decisions, rejections, reversals, and resolved Finance SLA alerts only.',
    );
    expect(rendered).toContain('Company bank account creation');
    expect(rendered).toContain('Finance Approver');
    expect(rendered).toContain('Approved');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/finance-tax/approval-queue',
        '/finance-tax/bank-reconciliation',
        '/finance-tax/company-bank-accounts',
      ]),
    );
    expect(classNamesIn(section)).toContain(
      'card admin-section operations-handoff-finance-decision-card',
    );
  });

  it('renders an explicit empty historical state', () => {
    const rendered = textContent(
      OperationsHandoffFinanceDecisionHistorySection({
        pagination: {
          activePage: 1,
          ariaLabel: 'Finance decision history pagination',
          hrefForPage: () => '/operations-handoff?details=all',
          itemLabel: 'finance decisions',
          totalRows: 0,
        },
        rows: [],
      }),
    );

    expect(rendered).toContain('No completed Finance decisions in this period.');
  });

  it('renders a server-bounded decision page without slicing it a second time', () => {
    const section = OperationsHandoffFinanceDecisionHistorySection({
      pagination: {
        activePage: 2,
        ariaLabel: 'Finance decision history pagination',
        hrefForPage: (page) => `/operations-handoff?details=all&decisionPage=${page}`,
        itemLabel: 'finance decisions',
        totalRows: 4,
      },
      rows: [
        {
          actorLabel: 'Finance Approver',
          completedAt: '2026-07-29T02:00:00.000Z',
          detail: 'Matched to payment clearing.',
          href: '/finance-tax/bank-reconciliation/bank-4',
          id: 'decision-4',
          recordLabel: 'Bank transaction bank-4',
          status: 'Matched',
          title: 'Bank transaction matched',
          tone: 'success',
        },
      ],
    });
    const rendered = renderToStaticMarkup(section);

    expect(rendered).toContain('Bank transaction matched');
    expect(rendered).toContain('Showing 4 to 4 of 4 finance decisions');
  });
});
