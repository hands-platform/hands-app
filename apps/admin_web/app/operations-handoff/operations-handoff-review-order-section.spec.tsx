import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffReviewOrderSection } from './operations-handoff-review-order-section';

describe('OperationsHandoffReviewOrderSection', () => {
  it('uses shared Vuexy action atoms for review order cards', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-review-order-section.tsx', 'utf8');

    expect(source).toContain('AdminActionCard');
    expect(source).toContain('AdminSection');
    expect(source).toContain('AdminTaskGrid');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<Link');
    expect(source).not.toContain('className="ops-task-card"');
  });

  it('renders only lanes that have history rows to review', () => {
    const section = OperationsHandoffReviewOrderSection({
      items: [
        {
          count: 4,
          detail: 'Open checklist items still need final confirmation.',
          href: '/operations-handoff?details=all#operations-handoff-review-checklist',
          id: 'checks',
          label: 'Review checks',
          priority: 1,
          tone: 'warn',
        },
        {
          count: 0,
          detail: 'No partner signals in this period.',
          href: '/operations-handoff?details=all#operations-handoff-partner-history',
          id: 'partners',
          label: 'Partner signals',
          priority: 2,
          tone: 'info',
        },
        {
          count: 12,
          detail: 'Booking rows are paginated below.',
          href: '/operations-handoff?details=all#operations-handoff-booking-history',
          id: 'bookings',
          label: 'Booking history',
          priority: 3,
          tone: 'info',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Review order');
    expect(rendered).toContain('2 lane(s) to review');
    expect(rendered).toContain('Review checks');
    expect(rendered).toContain('4 row(s)');
    expect(rendered).toContain('Booking history');
    expect(rendered).toContain('12 row(s)');
    expect(rendered).not.toContain('Partner signals');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/operations-handoff?details=all#operations-handoff-review-checklist',
        '/operations-handoff?details=all#operations-handoff-booking-history',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['card admin-section admin-mb-16 operations-handoff-review-order-card', 'ops-task-grid']),
    );
  });

  it('keeps an empty review order state visible when all lanes are clear', () => {
    const section = OperationsHandoffReviewOrderSection({
      items: [
        {
          count: 0,
          detail: 'No rows.',
          href: '/operations-handoff?details=all#operations-handoff-activity-stream',
          id: 'activity',
          label: 'Activity stream',
          priority: 1,
          tone: 'info',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Review order');
    expect(rendered).toContain('All reviewed');
    expect(rendered).toContain('No full-history rows need review in this window.');
  });
});
