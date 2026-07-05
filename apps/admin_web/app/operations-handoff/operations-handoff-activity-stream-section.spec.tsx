import { readFileSync } from 'node:fs';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffActivityStreamSection } from './operations-handoff-activity-stream-section';

describe('OperationsHandoffActivityStreamSection', () => {
  it('uses the shared AdminFormControlLink atom for stream actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-activity-stream-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('<small className="muted">{formatDateTime(item.createdAt)}</small>');
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('<a\n            className="button button-secondary"');
    expect(source).not.toContain('<div className="admin-table-scroll">');
  });

  it('renders activity stream rows and export links', () => {
    const section = OperationsHandoffActivityStreamSection({
      csvHref: 'data:text/csv,created_at',
      rows: [
        {
          area: 'Notification',
          className: 'pill pill-warn',
          createdAt: '2026-06-14T00:00:00.000Z',
          href: '/audit-log?bucket=Notification&range=all',
          id: 'activity-1',
          record: 'notification:abc123',
          source: 'PUSH',
          summary: 'Partner booking update failed',
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Unified activity stream');
    expect(rendered).toContain('Export activity CSV');
    expect(rendered).toContain('Notification');
    expect(rendered).toContain('Partner booking update failed');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        'data:text/csv,created_at',
        '/audit-log',
        '/chat-archive',
        '/audit-log?bucket=Notification&range=all',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 operations-handoff-activity-stream-card',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('renders the empty state when there are no rows', () => {
    const rendered = textContent(
      OperationsHandoffActivityStreamSection({ csvHref: 'data:text/csv,', rows: [] }),
    );

    expect(rendered).toContain('No recent activity stream rows.');
  });
});
