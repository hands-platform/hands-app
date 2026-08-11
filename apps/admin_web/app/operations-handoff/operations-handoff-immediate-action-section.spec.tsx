import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffImmediateActionSection } from './operations-handoff-immediate-action-section';

describe('OperationsHandoffImmediateActionSection', () => {
  it('uses shared Vuexy badge atoms for immediate action labels', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-immediate-action-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('AdminTaskGrid');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminQueueMeta');
    expect(source).toContain('actionLabel={`Review ${item.title}`}');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className="pill pill-info">{visibleActions.length} action lane(s)</span>');
    expect(source).not.toContain('<span className="pill">{item.countLabel}</span>');
    expect(source).not.toContain('<span className={item.statusClass}>{item.status}</span>');
  });

  it('renders historical issue lanes', () => {
    const section = OperationsHandoffImmediateActionSection({
      actions: [
        {
          className: 'signal signal-warn',
          count: 2,
          countLabel: '2 bookings',
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
          countLabel: '0 bookings',
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

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected immediate action section to render.');
    expect(rendered).toContain('Historical issue signals');
    expect(rendered).toContain('Past issue lanes that still need booking, chat, cash, alert, or note follow-up.');
    expect(rendered).toContain('1');
    expect(rendered).toContain('issue lanes');
    expect(rendered).toContain('Open matching windows');
    expect(rendered).not.toContain('Closeout clear');
    expect(hrefsIn(section)).toContain('/bookings?view=matching');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 operations-handoff-immediate-action-card',
        'ops-task-grid',
      ]),
    );
  });

  it('keeps the issue signal section visible when there are no open actions', () => {
    const section = OperationsHandoffImmediateActionSection({ actions: [] });

    const rendered = textContent(section);

    expect(rendered).toContain('Historical issue signals');
    expect(rendered).toContain('No issue lanes');
    expect(rendered).toContain('No historical issue lanes');
    expect(rendered).toContain('The selected history window has no booking, chat, cash, notification, or written-note issue lanes.');
  });
});
