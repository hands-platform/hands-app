import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceActionSection } from './operations-handoff-finance-action-section';

describe('OperationsHandoffFinanceActionSection', () => {
  it('uses shared Vuexy badge atoms for finance action labels', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-finance-action-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<span className={item.statusClass}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.countLabel}</span>');
  });

  it('renders finance handoff action rows and closeout link', () => {
    const section = OperationsHandoffFinanceActionSection({
      actions: [
        {
          className: 'signal signal-warn',
          count: 2,
          countLabel: '2 row(s)',
          detail: '100.000 VND in visible open payment state for this range.',
          href: '/payments?review=needs-action',
          id: 'finance-payment-state',
          nextAction: 'Capture, release, refund, or record cash collection evidence.',
          owner: 'Finance',
          status: 'Open',
          statusClass: 'pill pill-warn',
          title: 'Payment state handoff',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Finance handoff action map');
    expect(rendered).toContain('Payment state handoff');
    expect(rendered).toContain('100.000 VND');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/finance-closeout', '/payments?review=needs-action']),
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

    expect(textContent(section)).toContain('Open Finance Closeout');
    expect(hrefsIn(section)).toContain('/finance-closeout');
  });
});
