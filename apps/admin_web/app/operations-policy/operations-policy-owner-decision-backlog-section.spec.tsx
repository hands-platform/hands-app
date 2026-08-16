import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { OperationsPolicyOwnerDecisionBacklogSection } from './operations-policy-owner-decision-backlog-section';
import { classNamesIn, hrefsIn, normalizedTextContent } from './operations-policy-section-test-utils';

const sectionSource = readFileSync(
  new URL('./operations-policy-owner-decision-backlog-section.tsx', import.meta.url),
  'utf8',
);

describe('OperationsPolicyOwnerDecisionBacklogSection', () => {
  it('uses the shared Vuexy section header atom for decision pressure', () => {
    expect(sectionSource).toContain('AdminNotePanel');
    expect(sectionSource).toContain('AdminSectionHeader');
    expect(sectionSource).toContain('AdminTraceSummary');
    expect(sectionSource).toContain('StatusBadgeFromPillClass');
    expect(sectionSource).not.toContain('statusBadgeToneFromPillClass');
    expect(sectionSource).not.toContain('PillClassBadge');
    expect(sectionSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(sectionSource).not.toContain('<div className="ops-task-note admin-mt-14">');
    expect(sectionSource).not.toContain('<div className="ops-task-note admin-mt-12">');
    expect(sectionSource).not.toContain('<div className="ops-section-header">');
  });

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
    const markup = renderToStaticMarkup(section);

    expect(classNamesIn(section)).toContain('card admin-section admin-mt-16');
    expect(markup).toContain('class="card admin-card insight-card"');
    expect(sectionSource).toContain('AdminInsightCard');
    expect(sectionSource).not.toContain('<AdminCard className="insight-card"');
    expect(sectionSource).not.toContain('className="card admin-card insight-card"');
    expect(rendered).toContain('Owner decision backlog');
    expect(rendered).toContain('Current decision pressure');
    expect(rendered).toContain('1 active record');
    expect(rendered).toContain('First-pick Partner timer');
    expect(rendered).toContain('Recommended direction');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=matching', '/operations-policy#policy-matching']),
    );
  });

  it('does not duplicate the base pill class for pressure and backlog badges', () => {
    const section = OperationsPolicyOwnerDecisionBacklogSection({
      pressure: {
        alertCount: 1,
        cards: [
          {
            className: 'ops-task-pending',
            detail: 'First-pick response rate needs review.',
            href: '/bookings?view=matching',
            operatorAction: 'Review matching records.',
            pillClass: 'pill pill-warn',
            status: 'Needs review',
            title: 'Matching pressure',
          },
        ],
        summary: [],
      },
      backlog: [
        {
          className: 'ops-task-pending',
          decisionTrigger: 'Revisit when response rate drops.',
          evidence: 'Review open matching wait time.',
          href: '/operations-policy#policy-matching',
          options: [],
          owner: 'Dispatch',
          pillClass: 'pill pill-info',
          question: 'Should the first-pick Partner keep the full response window?',
          recommendation: 'Keep the launch policy until real data is stable.',
          title: 'First-pick Partner timer',
        },
      ],
    });

    const classNames = classNamesIn(section);

    expect(classNames).toContain('pill pill-warn');
    expect(classNames).toContain('pill pill-info');
    expect(classNames).not.toContain('pill pill pill-warn');
    expect(classNames).not.toContain('pill pill pill-info');
  });
});
