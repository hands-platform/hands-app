import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceActionSection } from './operations-handoff-finance-action-section';

describe('OperationsHandoffFinanceActionSection', () => {
  it('uses shared Vuexy badge atoms for finance action labels', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-finance-action-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminDisclosure');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminQueueMeta');
    expect(source).toContain('actionLabel={`Review ${item.title}`}');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className={item.statusClass}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.countLabel}</span>');
  });

  it('renders finance history review rows and closeout link', () => {
    const section = OperationsHandoffFinanceActionSection({
      actions: [
        {
          className: 'signal signal-warn',
          assignee: 'Finance Operator',
          count: 2,
          countLabel: '2 rows',
          detail: '100.000 VND in visible open payment state for this range.',
          href: '/payments?review=needs-action',
          id: 'finance-payment-state',
          nextAction: 'Capture, release, refund, or record cash collection evidence.',
          oldestOpenAt: '2026-07-23T00:00:00.000Z',
          owner: 'Finance',
          status: 'Open',
          statusClass: 'pill pill-warn',
          title: 'Payment state review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Finance history review');
    expect(rendered).toContain('1 finance lane open');
    expect(rendered).toContain('Payment state review');
    expect(rendered).toContain('100.000 VND');
    expect(rendered).toContain('Assignee');
    expect(rendered).toContain('Finance Operator');
    expect(rendered).toContain('Oldest');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/finance-overview', '/payments?review=needs-action']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 operations-handoff-finance-action-card',
        'ops-task-grid',
      ]),
    );
  });

  it('renders the finance closeout link without action rows', () => {
    const section = OperationsHandoffFinanceActionSection({ actions: [] });

    expect(textContent(section)).toContain('Finance clear');
    expect(textContent(section)).toContain('Open Finance Overview');
    expect(hrefsIn(section)).toContain('/finance-overview');
  });

  it('keeps completed finance checks collapsed below open work', () => {
    const section = OperationsHandoffFinanceActionSection({
      actions: [
        {
          className: 'signal signal-ok',
          assignee: undefined,
          count: 0,
          countLabel: '0 rows',
          detail: 'No refund rows need final evidence.',
          href: '/refunds?review=open',
          id: 'finance-refund-state',
          nextAction: 'No action needed.',
          oldestOpenAt: null,
          owner: 'Finance',
          status: 'Clear',
          statusClass: 'pill pill-success',
          title: 'Refund state review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Completed finance checks');
    expect(rendered).toContain('1');
    expect(rendered).toContain('Refund state review');
    expect(hrefsIn(section)).toContain('/refunds?review=open');
  });
});
