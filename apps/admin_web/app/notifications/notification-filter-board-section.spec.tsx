import {
  NotificationFilterBoardSection,
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
      filteredCount: 2,
      links: buildLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Notification operation filters');
    expect(rendered).toContain('Active queue: Failed sends');
    expect(rendered).toContain('latest delivery attempts that returned an FCM push failure.');
    expect(rendered).toContain('Active booking trace: book-1234');
    expect(rendered).toContain('Showing 2 of 10');
    expect(rendered).toContain('Clear filter');
    expect(rendered).toContain('Booking book-1234');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/notifications', '/notifications?review=failed']));
    expect(ariaCurrentValuesIn(section)).toEqual(['page']);
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-warn']));
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = NotificationFilterBoardSection({
      activeBookingLabel: null,
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeReview: '',
      filteredCount: 10,
      links: buildLinks(),
      totalCount: 10,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 10 of 10');
    expect(rendered).not.toContain('Clear filter');
    expect(ariaCurrentValuesIn(section)).toEqual(['page']);
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });
});

function buildLinks(): NotificationFilterLink[] {
  return [
    { href: '/notifications', label: 'All notifications', review: '' },
    { href: '/notifications?review=failed', label: 'Failed sends', review: 'failed' },
  ];
}
