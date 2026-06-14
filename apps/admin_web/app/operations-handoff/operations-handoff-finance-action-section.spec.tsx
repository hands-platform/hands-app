import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffFinanceActionSection } from './operations-handoff-finance-action-section';

describe('OperationsHandoffFinanceActionSection', () => {
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

    expect(section.type).toBe('section');
    expect(rendered).toContain('Finance handoff action map');
    expect(rendered).toContain('Payment state handoff');
    expect(rendered).toContain('100.000 VND');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/finance-closeout', '/payments?review=needs-action']),
    );
  });

  it('renders the finance closeout link without action rows', () => {
    const section = OperationsHandoffFinanceActionSection({ actions: [] });

    expect(textContent(section)).toContain('Open Finance Closeout');
    expect(hrefsIn(section)).toContain('/finance-closeout');
  });
});
