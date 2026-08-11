import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { classNamesIn, hrefsIn, textContent } from './operations-handoff-section-test-utils';
import { OperationsHandoffActivityStreamSection } from './operations-handoff-activity-stream-section';

describe('OperationsHandoffActivityStreamSection', () => {
  it('uses the shared AdminFormControlLink atom for stream actions', () => {
    const source = readFileSync('app/operations-handoff/operations-handoff-activity-stream-section.tsx', 'utf8');

    expect(source).toContain('AdminFormControlLink');
    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('paginateOperationsHandoffRows');
    expect(source).not.toContain('<small className="muted">{formatDateTime(item.createdAt)}</small>');
    expect(source).not.toContain('<Link className="button button-secondary"');
    expect(source).not.toContain('<a\n            className="button button-secondary"');
    expect(source).not.toContain('<div className="admin-table-scroll">');
  });

  it('renders activity stream rows and export links', () => {
    const section = OperationsHandoffActivityStreamSection({
      ...sourceFilter(),
      csvHref: 'data:text/csv,created_at',
      pagination: pagination(1),
      rows: [
        {
          area: 'Notification',
          className: 'pill pill-warn',
          createdAt: '2026-06-14T00:00:00.000Z',
          href: '/audit-log?bucket=Notification&range=all',
          id: 'activity-1',
          record: 'notification:abc123',
          reviewReason: 'Failed delivery can hide booking, payment, or status updates from users.',
          source: 'PUSH',
          summary: 'Partner booking update failed',
        },
      ],
    });

    const rendered = textContent(section);
    const markup = renderToStaticMarkup(section);

    expect(rendered).toContain('Unified activity stream');
    expect(rendered).toContain('Export visible rows');
    expect(rendered).toContain('Booking chats');
    expect(markup).toContain('All activity');
    expect(markup).toContain('Bookings');
    expect(markup).toContain('Finance');
    expect(markup).toContain('Needs review');
    expect(markup).toContain('All records');
    expect(markup).toContain('Current 7d (156)');
    expect(markup).toContain('Legacy 7d+ (971)');
    expect(markup).toContain('All unresolved (1127)');
    expect(markup).toContain('activityBacklog=legacy');
    expect(markup).toContain('activityReview=all');
    expect(markup).toContain('activitySource=finance');
    expect(markup).toContain('24h+ priority');
    expect(markup).toContain('All 17');
    expect(markup).toContain('Booking state 2');
    expect(markup).toContain('Payment / refund 3');
    expect(markup).toContain('Missing settlement 1');
    expect(markup).toContain('Notification failure 7');
    expect(markup).toContain('Finance unpaid 4');
    expect(markup).toContain('activityAge=over-24h');
    expect(markup).toContain('All reasons (186)');
    expect(markup).toContain('Booking state (27)');
    expect(markup).toContain('Payment / refund (60)');
    expect(markup).toContain('Missing settlement (0)');
    expect(markup).toContain('Notification failure (63)');
    expect(markup).toContain('Finance unpaid (36)');
    expect(markup).toContain('activityReason=payment');
    expect(markup).toContain('Priority then oldest');
    expect(markup).toContain('Newest first');
    expect(markup).toContain('24h+');
    expect(markup).toContain('activityAge=over-24h');
    expect(markup).toContain('activitySort=newest');
    expect(markup).not.toContain('pill pill-danger');
    expect(rendered).toContain('Review reason');
    expect(rendered).toContain('Notification');
    expect(rendered).toContain('Partner booking update failed');
    expect(rendered).toContain('Failed delivery can hide booking, payment, or status updates from users.');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        'data:text/csv,created_at',
        '/audit-log',
        '/bookings?view=chat',
        '/audit-log?bucket=Notification&range=all',
      ]),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-section admin-mb-16 operations-handoff-activity-stream-card',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders the empty state when there are no rows', () => {
    const rendered = textContent(
      OperationsHandoffActivityStreamSection({
        ...sourceFilter(),
        csvHref: 'data:text/csv,',
        pagination: pagination(0),
        rows: [],
      }),
    );

    expect(rendered).toContain('No recent activity stream rows.');
  });

  it('returns to chronological labels after selecting one review reason', () => {
    const section = OperationsHandoffActivityStreamSection({
      ...sourceFilter(),
      activeReason: 'payment',
      csvHref: 'data:text/csv,',
      pagination: pagination(0),
      rows: [],
    });

    const markup = renderToStaticMarkup(section);
    expect(markup).toContain('Oldest first');
    expect(markup).not.toContain('Priority then oldest');
  });

  it('treats incoming rows as the current server-rendered activity page', () => {
    const section = OperationsHandoffActivityStreamSection({
      ...sourceFilter('chat'),
      csvHref: 'data:text/csv,created_at',
      pagination: {
        ...pagination(8),
        activePage: 2,
      },
      rows: [
        {
          area: 'Booking',
          className: 'pill pill-info',
          createdAt: '2026-06-14T00:00:00.000Z',
          href: '/bookings/booking-page-2',
          id: 'activity-page-2',
          record: 'page-2',
          reviewReason: 'Review the current event.',
          source: 'MATCHED',
          summary: 'Current server page row',
        },
      ],
    });

    const rendered = renderToStaticMarkup(section);
    expect(rendered).toContain('Current server page row');
    expect(rendered).toContain('Showing 4 to 4 of 8 activity rows');
    expect(rendered).toContain('aria-label="Activity source"');
    expect(rendered).toContain('aria-current="page"');
  });
});

function pagination(totalRows: number) {
  return {
    activePage: 1,
    ariaLabel: 'Operations activity pagination',
    hrefForPage: (page: number) => `/operations-handoff?details=all&activityPage=${page}`,
    itemLabel: 'activity rows',
    totalRows,
  };
}

function sourceFilter(activeSource: 'all' | 'chat' = 'all') {
  return {
    activeAge: 'all' as const,
    activeBacklog: 'current' as const,
    activeReason: 'all' as const,
    activeReview: 'needs-review' as const,
    activeSort: 'oldest' as const,
    activeSource,
    hrefForAge: (age: string) =>
      age === 'all'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activityAge=${age}`,
    hrefForBacklog: (backlog: string) =>
      backlog === 'current'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activityBacklog=${backlog}`,
    hrefForOver24h: (reason: string) => {
      const query = new URLSearchParams({
        activityAge: 'over-24h',
        details: 'all',
      });
      if (reason !== 'all') {
        query.set('activityReason', reason);
      }
      return `/operations-handoff?${query.toString()}`;
    },
    hrefForReason: (reason: string) =>
      reason === 'all'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activityReason=${reason}`,
    hrefForReview: (review: string) =>
      review === 'needs-review'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activityReview=${review}`,
    hrefForSort: (sort: string) =>
      sort === 'oldest'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activitySort=${sort}`,
    hrefForSource: (source: string) =>
      source === 'all'
        ? '/operations-handoff?details=all'
        : `/operations-handoff?details=all&activitySource=${source}`,
    reasonCounts: {
      all: 186,
      'booking-state': 27,
      'finance-unpaid': 36,
      'missing-settlement': 0,
      'notification-failure': 63,
      payment: 60,
    },
    backlogCounts: {
      all: 1127,
      current: 156,
      legacy: 971,
    },
    over24hCounts: {
      all: 17,
      'booking-state': 2,
      'finance-unpaid': 4,
      'missing-settlement': 1,
      'notification-failure': 7,
      payment: 3,
    },
  } as const;
}
