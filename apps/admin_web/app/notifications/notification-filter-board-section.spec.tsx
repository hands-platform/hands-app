import {
  NotificationFilterBoardSection,
  type NotificationDateRangeLink,
  type NotificationFilterLink,
} from './notification-filter-board-section';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ariaCurrentValuesIn,
  classNamesIn,
  hrefsIn,
  normalizedText,
} from './notification-section-test-utils';

describe('NotificationFilterBoardSection', () => {
  it('renders active queue, booking context, and quick filter links', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: 'book-1234',
      activeFilterDescription: 'latest delivery attempts that returned an FCM push failure.',
      activeFilterLabel: 'Failed sends',
      activeIncidentState: 'all',
      activeReview: 'failed',
      activeReviewRunbook: {
        detail: 'The latest send attempt failed.',
        primaryAction: 'Open delivery evidence before retry.',
        title: 'Retry gate',
      },
      activeRange: '7d',
      activeRangeLabel: 'Last 7 days',
      clearHref: '/notifications?range=7d&review=all',
      filteredCount: 2,
      incidentStateLinks: [],
      links: buildLinks('7d'),
      rangeLinks: buildRangeLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Notification operation filters');
    expect(rendered).toContain('Active range: Last 7 days');
    expect(rendered).toContain('Active queue: Failed sends');
    expect(rendered).toContain('Range: Last 7 days');
    expect(rendered).toContain('Queue: Failed sends');
    expect(rendered).toContain('Rows: 2/10');
    expect(rendered).toContain('Booking: book-1234');
    expect(rendered).toContain('latest delivery attempts that returned an FCM push failure.');
    expect(rendered).toContain('Retry gate');
    expect(rendered).toContain('The latest send attempt failed.');
    expect(rendered).toContain('Next action: Open delivery evidence before retry.');
    expect(rendered).toContain('Active booking context: book-1234');
    expect(rendered).not.toContain('Active booking trace');
    expect(rendered).toContain('Showing 2 loaded row(s) of 10 total / Last 7 days');
    expect(rendered).toContain('Clear filter');
    expect(rendered).toContain('Booking book-1234');
    expect(rendered).toContain('Today');
    expect(rendered).toContain('Previous day');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/notifications?range=7d', '/notifications?range=7d&review=failed']),
    );
    expect(ariaCurrentValuesIn(section)).toEqual(['page', 'page']);
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'booking-date-filter-button is-active',
        'pill pill-warn',
        'pill pill-info',
        'booking-date-filter-bar notification-review-filter-bar',
        'notification-filter-group-label',
        'booking-date-filter-buttons notification-review-filter-buttons',
      ]),
    );
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: null,
      activeFilterLabel: 'All notifications',
      activeIncidentState: 'all',
      activeReview: 'all',
      activeReviewRunbook: null,
      activeRange: 'today',
      activeRangeLabel: 'Today',
      clearHref: '/notifications?review=all',
      filteredCount: 10,
      incidentStateLinks: [],
      links: buildLinks(),
      rangeLinks: buildRangeLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 10 loaded row(s) of 10 total / Today');
    expect(rendered).not.toContain('Clear filter');
    expect(ariaCurrentValuesIn(section)).toEqual(['page', 'page']);
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['booking-date-filter-button is-active', 'pill pill-success']),
    );
  });

  it('renders server-backed system incident state controls only when supplied', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: 'Admin system alerts.',
      activeFilterLabel: 'System incidents',
      activeIncidentState: 'open',
      activeReview: 'system-incidents',
      activeReviewRunbook: null,
      activeRange: 'today',
      activeRangeLabel: 'Today',
      clearHref: '/notifications?review=all',
      filteredCount: 2,
      incidentStateLinks: [
        { href: '/notifications?review=system-incidents', label: 'All system', state: 'all' },
        {
          href: '/notifications?review=system-incidents&incidentState=open',
          label: 'Open',
          state: 'open',
        },
        {
          href: '/notifications?review=system-incidents&incidentState=recovered',
          label: 'Recovered',
          state: 'recovered',
        },
        {
          href: '/notifications?review=system-incidents&incidentState=legacy',
          label: 'Legacy review',
          state: 'legacy',
        },
      ],
      links: buildLinks(),
      rangeLinks: buildRangeLinks(),
      totalCount: 2,
    });

    const rendered = normalizedText(section);
    expect(rendered).toContain('Incident state');
    expect(rendered).toContain('Incident: Open');
    expect(rendered).toContain('Recovered');
    expect(rendered).toContain('Legacy review');
    expect(hrefsIn(section)).toContain('/notifications?review=system-incidents&incidentState=open');
  });

  it('renders Finance SLA age and owner controls only when supplied', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: 'Overdue Finance reviews.',
      activeFilterLabel: 'Finance overdue',
      activeFinanceAge: '72-plus',
      activeIncidentState: 'all',
      activeReview: 'finance-overdue',
      activeReviewRunbook: null,
      activeRange: 'all',
      activeRangeLabel: 'All loaded',
      clearHref: '/notifications?range=all&review=all',
      filteredCount: 2,
      financeAgeLinks: [
        { href: '/notifications?range=all&review=finance-overdue', label: 'All overdue', value: 'all' },
        { href: '/notifications?range=all&review=finance-overdue&financeAge=48-72', label: '48–72h', value: '48-72' },
        { href: '/notifications?range=all&review=finance-overdue&financeAge=72-plus', label: '72h+', value: '72-plus' },
      ],
      financeOwner: 'admin-owner-1',
      financeOwnerLinks: [
        { href: '/notifications?range=all&review=finance-overdue', label: 'All (5)', value: '' },
        {
          href: '/notifications?range=all&review=finance-overdue&financeOwner=admin-owner-1',
          label: 'My reviews (2)',
          value: 'admin-owner-1',
        },
        {
          href: '/notifications?range=all&review=finance-overdue&financeOwner=unassigned',
          label: 'Unassigned (3)',
          value: 'unassigned',
        },
      ],
      financeOwnerOptions: [
        { label: 'All owners (5)', value: '' },
        { label: 'Unassigned (3)', value: 'unassigned' },
        { label: 'Finance Owner (2)', value: 'admin-owner-1' },
      ],
      incidentStateLinks: [],
      links: buildLinks(),
      rangeLinks: buildRangeLinks(),
      totalCount: 2,
    });

    const rendered = normalizedText(section);
    expect(rendered).toContain('SLA age');
    expect(rendered).toContain('SLA: 72h+');
    expect(rendered).toContain('Owner: Finance Owner');
    expect(rendered).toContain('Review owner');
    expect(rendered).toContain('Apply owner');
    expect(rendered).toContain('Owner workload');
    expect(rendered).toContain('My reviews (2)');
    expect(rendered).toContain('Unassigned (3)');
    expect(hrefsIn(section)).toContain(
      '/notifications?range=all&review=finance-overdue&financeOwner=admin-owner-1',
    );
    expect(hrefsIn(section)).toContain(
      '/notifications?range=all&review=finance-overdue&financeAge=72-plus',
    );
  });

  it('uses shared segmented controls for date and review filters', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-filter-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('AdminFilterChipGroup');
    expect(source).not.toContain('StatusBadgeLink');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<span className="pill pill-info">{activeReviewRunbook.title}</span>');
    expect(source).not.toContain('<AdminFormControlLink className="pill pill-success" href={clearHref}>');
    expect(source).not.toContain('{activeBookingLabel ? <span className="pill pill-info">Booking {activeBookingLabel}</span> : null}');
    expect(source).not.toContain("className={`pill ${activeReview === link.review ? 'pill-warn' : 'pill-neutral'}`}");
  });
});

function buildLinks(range?: '7d'): NotificationFilterLink[] {
  const reviewPrefix = range ? '?range=7d&review=' : '?review=';
  return [
    {
      href: `/notifications${range ? '?range=7d&review=all' : '?review=all'}`,
      label: 'All notifications',
      review: 'all',
    },
    { href: `/notifications${reviewPrefix}failed`, label: 'Failed sends', review: 'failed' },
  ];
}

function buildRangeLinks(): NotificationDateRangeLink[] {
  return [
    { href: '/notifications', label: 'Today', range: 'today' },
    { href: '/notifications?range=yesterday', label: 'Previous day', range: 'yesterday' },
    { href: '/notifications?range=7d', label: 'Last 7 days', range: '7d' },
  ];
}
