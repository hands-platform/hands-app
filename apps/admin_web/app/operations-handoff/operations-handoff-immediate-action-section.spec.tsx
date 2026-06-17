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
        {
          className: 'signal signal-ok',
          count: 0,
          countLabel: '0 booking(s)',
          detail: 'All closeout checks are clear.',
          href: '/operations-handoff',
          id: 'closeout-clear',
          nextAction: 'No action needed.',
          owner: 'Ops',
          status: 'Ready',
          statusClass: 'pill pill-success',
          title: 'Closeout clear',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Immediate action queue');
    expect(rendered).toContain('1');
    expect(rendered).toContain('action lane(s)');
    expect(rendered).toContain('Open matching windows');
    expect(rendered).not.toContain('Closeout clear');
    expect(hrefsIn(section)).toContain('/bookings?view=matching');
  });

  it('renders a clear lane card when there are no actions', () => {
    const rendered = textContent(OperationsHandoffImmediateActionSection({ actions: [] }));

    expect(rendered).toContain('0');
    expect(rendered).toContain('action lane(s)');
    expect(rendered).toContain('No immediate action lane');
    expect(rendered).toContain('Continue monitoring the current range');
  });
});
