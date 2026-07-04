import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';

describe('BookingMonitorToolbarSection', () => {
  it('renders live update controls when realtime is enabled', () => {
    const section = BookingMonitorToolbarSection({
      liveUpdates: true,
      onToggleLiveUpdates: vi.fn(),
    });
    const rendered = normalizedText(section);
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('toolbar admin-page-header');
    expect(markup).toContain('admin-form-control-button button button-secondary');
    expect(rendered).toContain('Booking Monitor');
    expect(rendered).toContain('Live operational view for matching');
    expect(rendered).toContain('Pause live');
    expect(rendered).not.toContain('Refresh now');
  });

  it('shows resume copy when realtime is paused', () => {
    const section = BookingMonitorToolbarSection({
      liveUpdates: false,
      onToggleLiveUpdates: vi.fn(),
    });

    expect(normalizedText(section)).toContain('Resume live');
  });

  it('allows route-specific workspace copy', () => {
    const section = BookingMonitorToolbarSection({
      liveUpdates: true,
      description: 'Completed booking workspace for closeout.',
      onToggleLiveUpdates: vi.fn(),
      title: 'Completed Bookings',
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Completed Bookings');
    expect(rendered).toContain('Completed booking workspace for closeout.');
  });
});
