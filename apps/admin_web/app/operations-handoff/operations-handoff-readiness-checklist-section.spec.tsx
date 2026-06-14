import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffReadinessChecklistSection } from './operations-handoff-readiness-checklist-section';

describe('OperationsHandoffReadinessChecklistSection', () => {
  it('renders open checklist items and review count', () => {
    const section = OperationsHandoffReadinessChecklistSection({
      openCount: 1,
      rows: [
        {
          badgeClass: 'pill pill-warn',
          count: 2,
          countLabel: '2 open',
          detail: 'Open matching rows need a visible next step.',
          href: '/bookings?view=matching',
          id: 'live-matching-reviewed',
          operatorAction: 'Open booking monitor.',
          owner: 'Dispatch',
          status: 'Check live',
          title: 'Live matching reviewed',
          tone: 'warn',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Shift handoff checklist');
    expect(rendered).toContain('1 check(s) open');
    expect(rendered).toContain('Live matching reviewed');
    expect(hrefsIn(section)).toContain('/bookings?view=matching');
  });

  it('renders ready state when nothing is open', () => {
    const rendered = textContent(
      OperationsHandoffReadinessChecklistSection({ openCount: 0, rows: [] }),
    );

    expect(rendered).toContain('Ready to hand over');
  });
});
