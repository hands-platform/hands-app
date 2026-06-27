import {
  NotificationFilterBoardSection,
  type NotificationDateRangeLink,
  type NotificationFilterLink,
} from './notification-filter-board-section';
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
      clearHref: '/notifications?range=7d',
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
        'admin-form-control-link is-active',
        'admin-form-control-link pill pill-success',
        'admin-form-control-link pill pill-warn',
      ]),
    );
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeReview: '',
      activeReviewRunbook: null,
      activeRange: 'today',
      activeRangeLabel: 'Today',
      clearHref: '/notifications',
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
      expect.arrayContaining(['admin-form-control-link is-active', 'admin-form-control-link pill pill-warn']),
    );
  });
});

function buildLinks(range?: '7d'): NotificationFilterLink[] {
  const rangePrefix = range ? '?range=7d' : '';
  const reviewPrefix = range ? '?range=7d&review=' : '?review=';
  return [
    { href: `/notifications${rangePrefix}`, label: 'All notifications', review: '' },
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
