import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffImmediateActionSection } from './operations-handoff-immediate-action-section';

describe('OperationsHandoffImmediateActionSection', () => {
  it('renders immediate action lanes', () => {
    const section = OperationsHandoffImmediateActionSection({
      actions: [
        {
          className: 'signal signal-warn',
          count: 2,
          countLabel: '2 booking(s)',
          detail: 'Customers are waiting for Partner response.',
          href: '/bookings?view=matching',
          id: 'matching-live-window',
          nextAction: 'Open the matching board.',
          owner: 'Dispatch',
          status: 'Monitor now',
          statusClass: 'pill pill-warn',
          title: 'Open matching windows',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Immediate action queue');
    expect(rendered).toContain('1');
    expect(rendered).toContain('action lane(s)');
    expect(rendered).toContain('Open matching windows');
    expect(hrefsIn(section)).toContain('/bookings?view=matching');
  });

  it('renders an empty lane count when there are no actions', () => {
    const rendered = textContent(OperationsHandoffImmediateActionSection({ actions: [] }));

    expect(rendered).toContain('0');
    expect(rendered).toContain('action lane(s)');
  });
});
