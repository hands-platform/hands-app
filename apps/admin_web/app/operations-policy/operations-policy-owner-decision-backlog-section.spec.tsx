import { OperationsPolicyOwnerDecisionBacklogSection } from './operations-policy-owner-decision-backlog-section';
import { hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

describe('OperationsPolicyOwnerDecisionBacklogSection', () => {
  it('renders owner pressure, backlog choices, and review links', () => {
    const section = OperationsPolicyOwnerDecisionBacklogSection({
      pressure: {
        alertCount: 1,
        cards: [
          {
            className: 'ops-task-pending',
            detail: 'First-pick response rate needs review.',
            href: '/bookings?view=matching',
            operatorAction: 'Review matching records.',
            pillClass: 'pill-warn',
            status: 'Needs review',
            title: 'Matching pressure',
          },
        ],
        summary: [{ helper: 'Open matching records', label: 'Matching', value: '1' }],
      },
      backlog: [
        {
          className: 'ops-task-pending',
          decisionTrigger: 'Revisit when response rate drops.',
          evidence: 'Review open matching wait time.',
          href: '/operations-policy#policy-matching',
          options: [
            {
              label: 'Keep 10 minutes',
              tradeoff: 'Protects the customer-selected Partner.',
            },
          ],
          owner: 'Dispatch',
          pillClass: 'pill-info',
          question: 'Should the first-pick Partner keep the full response window?',
          recommendation: 'Keep the launch policy until real data is stable.',
          title: 'First-pick Partner timer',
        },
      ],
    });

    const rendered = normalizedTextContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Owner decision backlog');
    expect(rendered).toContain('Current decision pressure');
    expect(rendered).toContain('1 active record(s)');
    expect(rendered).toContain('First-pick Partner timer');
    expect(rendered).toContain('Recommended direction');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=matching', '/operations-policy#policy-matching']),
    );
  });
});
