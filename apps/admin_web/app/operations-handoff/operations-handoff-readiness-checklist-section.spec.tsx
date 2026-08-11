import { readFileSync } from 'node:fs';

import { hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffReadinessChecklistSection } from './operations-handoff-readiness-checklist-section';

describe('OperationsHandoffReadinessChecklistSection', () => {
  it('uses shared Vuexy badge atoms for readiness checklist labels', () => {
    const source = readFileSync(
      'app/operations-handoff/operations-handoff-readiness-checklist-section.tsx',
      'utf8',
    );

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminDisclosure');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminQueueMeta');
    expect(source).toContain('actionLabel={`Review ${item.title}`}');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain("<span className={openCount ? 'pill pill-warn' : 'pill pill-success'}>");
    expect(source).not.toContain('<span className={item.badgeClass}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.countLabel}</span>');
    expect(source).not.toContain('<span className={item.badgeClass}>{item.owner}</span>');
  });

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
        {
          badgeClass: 'pill pill-success',
          count: 0,
          countLabel: '0 open',
          detail: 'All notification retries are clear.',
          href: '/notifications',
          id: 'notifications-clear',
          operatorAction: 'No action needed.',
          owner: 'Ops',
          status: 'Ready',
          title: 'Notifications clear',
          tone: 'success',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected readiness checklist section to render.');
    expect(section.type.name).toBe('AdminSection');
    expect(rendered).toContain('Operations review checklist');
    expect(rendered).toContain('Past checks that still need booking, chat, cash, alert, customer, or note review.');
    expect(rendered).toContain('1 check open');
    expect(rendered).toContain('Live matching reviewed');
    expect(rendered).toContain('Completed checks');
    expect(rendered).toContain('1');
    expect(rendered).toContain('Notifications clear');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/bookings?view=matching', '/notifications']),
    );
  });

  it('keeps the review checklist anchor visible when nothing is open', () => {
    const section = OperationsHandoffReadinessChecklistSection({ openCount: 0, rows: [] });

    expect(section).not.toBeNull();
    if (section === null) throw new Error('Expected readiness checklist section to render.');

    const rendered = textContent(section);

    expect(section.type.name).toBe('AdminSection');
    expect(section.props.id).toBe('operations-handoff-review-checklist');
    expect(section.props.bodyClassName).toBeUndefined();
    expect(rendered).toContain('Ready to hand over');
    expect(rendered).toContain('No open review checks');
    expect(rendered).toContain('The selected history window has no handoff review items.');
  });
});
