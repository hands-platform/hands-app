import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';

describe('BookingMonitorToolbarSection', () => {
  it('renders refresh controls when auto refresh is enabled', () => {
    const section = BookingMonitorToolbarSection({
      autoRefresh: true,
      onRefreshNow: jest.fn(),
      onToggleAutoRefresh: jest.fn(),
    });
    const rendered = normalizedText(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Booking Monitor');
    expect(rendered).toContain('Live operational view for matching');
    expect(rendered).toContain('Pause refresh');
    expect(rendered).toContain('Refresh now');
  });

  it('shows resume copy when auto refresh is paused', () => {
    const section = BookingMonitorToolbarSection({
      autoRefresh: false,
      onRefreshNow: jest.fn(),
      onToggleAutoRefresh: jest.fn(),
    });

    expect(normalizedText(section)).toContain('Resume refresh');
  });

  it('allows route-specific workspace copy', () => {
    const section = BookingMonitorToolbarSection({
      autoRefresh: true,
      description: 'Completed booking workspace for closeout.',
      onRefreshNow: jest.fn(),
      onToggleAutoRefresh: jest.fn(),
      title: 'Completed Bookings',
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Completed Bookings');
    expect(rendered).toContain('Completed booking workspace for closeout.');
  });
});
