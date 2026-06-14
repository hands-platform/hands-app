import { OperationsPolicyChangeImpactSection } from './operations-policy-change-impact-section';
import { normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyChangeImpactSection', () => {
  it('renders policy change metrics, snapshots, rows, and cards', () => {
    const section = OperationsPolicyChangeImpactSection({
      dashboard: {
        cards: [
          {
            className: 'ops-task-done',
            detail: 'Existing bookings keep their saved expiresAt value.',
            operatorAction: 'Do not expect open countdowns to recalculate.',
            pillClass: 'pill-success',
            scope: 'New bookings',
            title: 'Response timer changes are forward-only',
          },
        ],
        metrics: [
          {
            helper: 'Existing open bookings keep their saved policy snapshot.',
            label: 'Open matching now',
            value: '2',
          },
        ],
        snapshotRows: [
          {
            liveValue: '10 min',
            operatorMeaning: 'Saved at booking open.',
            policy: 'First-pick response timer',
            savedValue: '10 min',
            scope: 'Timer / expiry',
          },
        ],
        snapshotSummary: [
          {
            helper: 'HANDS copies active matching policy into booking metadata.',
            label: 'Live policy applies to new bookings',
            scope: 'Forward-only',
            value: 'Create time snapshot',
          },
        ],
      },
      sampledBookingCount: 5,
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Policy change impact');
    expect(rendered).toContain('5 booking(s) sampled');
    expect(rendered).toContain('First-pick response timer');
    expect(rendered).toContain('Response timer changes are forward-only');
  });
});
