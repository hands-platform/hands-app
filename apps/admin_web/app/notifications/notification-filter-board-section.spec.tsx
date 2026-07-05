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
  it('renders active queue, booking trace, and quick filter links', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: 'book-1234',
      activeFilterDescription: 'latest delivery attempts that returned an FCM push failure.',
      activeFilterLabel: 'Failed sends',
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
      links: buildLinks('7d'),
      rangeLinks: buildRangeLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Notification operation filters');
    expect(rendered).toContain('Active range: Last 7 days');
    expect(rendered).toContain('Active queue: Failed sends');
    expect(rendered).toContain('latest delivery attempts that returned an FCM push failure.');
    expect(rendered).toContain('Retry gate');
    expect(rendered).toContain('The latest send attempt failed.');
    expect(rendered).toContain('Next action: Open delivery evidence before retry.');
    expect(rendered).toContain('Active booking trace: book-1234');
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
        'pill pill-success',
        'pill pill-warn',
      ]),
    );
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: null,
      activeFilterLabel: 'All notifications',
      activeReview: 'all',
      activeReviewRunbook: null,
      activeRange: 'today',
      activeRangeLabel: 'Today',
      clearHref: '/notifications?review=all',
      filteredCount: 10,
      links: buildLinks(),
      rangeLinks: buildRangeLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 10 loaded row(s) of 10 total / Today');
    expect(rendered).not.toContain('Clear filter');
    expect(ariaCurrentValuesIn(section)).toEqual(['page', 'page']);
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['booking-date-filter-button is-active', 'pill pill-warn']),
    );
  });

  it('uses shared badge atoms for runbook and review filter chips', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/notifications/notification-filter-board-section.tsx'),
      'utf8',
    );

    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('AdminSegmentedControl');
    expect(source).not.toContain('PillClassBadgeLink');
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
