import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffShiftBriefSection } from './operations-handoff-shift-brief-section';

describe('OperationsHandoffShiftBriefSection', () => {
  it('uses shared Vuexy badge atoms for the factual queue label', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-shift-brief-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<Link className="ops-task-card"');
    expect(source).not.toContain('<div className="ops-task-grid"');
    expect(source).not.toContain('actions={<span className="pill pill-info">Factual queue</span>}');
  });

  it('renders period brief cards from count props', () => {
    const section = OperationsHandoffShiftBriefSection({
      activeBookingCount: 4,
      cashDebtPartnerCount: 2,
      customerSignalCount: 3,
      failedNotificationCount: 1,
      matchingBookingCount: 5,
      partnerIssueCount: 6,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Period brief');
    expect(rendered).toContain('Factual queue');
    expect(rendered).toContain('5 matching wait');
    expect(rendered).toContain('6 Partner facts to check');
    expect(rendered).toContain('2 cash wallet gate(s)');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section',
        'ops-section-header admin-section-header',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/bookings?view=matching',
        '/partners',
        '/cash-settlements',
        '/customers',
        '/notifications?review=failed',
      ]),
    );
  });
});
