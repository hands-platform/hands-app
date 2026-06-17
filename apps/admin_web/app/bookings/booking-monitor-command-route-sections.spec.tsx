import { headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorCommandRouteSections } from './booking-monitor-command-route-sections';

describe('BookingMonitorCommandRouteSections', () => {
  it('renders command summary and primary queue cards', () => {
    const sections = BookingMonitorCommandRouteSections({
      autoRefresh: true,
      commandSummaryCards: [
        {
          action: 'Confirm the active queue.',
          detail: '2 visible booking(s).',
          href: '/bookings?view=active',
          label: 'Current lane',
          owner: 'Shift lead',
          value: 'Active',
        },
      ],
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:30',
      primaryCommandQueue: [
        {
          count: 2,
          detail: 'Address and matching checks are waiting.',
          href: '/bookings?view=attention',
          primaryAction: 'Open attention queue',
          sampleBookingIds: ['booking_123456789', 'booking_abcdefghi'],
          status: 'Needs operator',
          tone: 'pill-warn',
        },
      ],
    });
    const rendered = normalizedText(sections);

    expect(rendered).toContain('Booking operations command summary');
    expect(rendered).toContain('Auto refresh on / last 09:30');
    expect(rendered).toContain('Primary command queue');
    expect(rendered).toContain('2 booking(s)');
    expect(headingTextsIn(sections)).toEqual([
      'Booking operations command summary',
      'Primary command queue',
    ]);
    expect(hrefsIn(sections)).toEqual(
      expect.arrayContaining(['/bookings?view=active', '/bookings?view=attention']),
    );
  });

  it('renders paused and refreshing state copy', () => {
    const sections = BookingMonitorCommandRouteSections({
      autoRefresh: false,
      commandSummaryCards: [],
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: 'pending',
      primaryCommandQueue: [],
    });
    const rendered = normalizedText(sections);

    expect(rendered).toContain('Auto refresh paused / refreshing');
    expect(rendered).toContain('0 booking(s)');
  });
});
