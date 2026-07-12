import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';

describe('BookingMonitorToolbarSection', () => {
  it('renders only the live update action when realtime is enabled', () => {
    const section = BookingMonitorToolbarSection({
      liveUpdates: true,
      onToggleLiveUpdates: vi.fn(),
    });
    const rendered = normalizedText(section);
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('admin-form-control-button button button-secondary');
    expect(rendered).toContain('Pause live');
    expect(rendered).not.toContain('Booking Monitor');
    expect(markup).not.toContain('admin-page-header admin-page-header-toolbar');
    expect(rendered).not.toContain('Refresh now');
  });

  it('shows resume copy when realtime is paused', () => {
    const section = BookingMonitorToolbarSection({
      liveUpdates: false,
      onToggleLiveUpdates: vi.fn(),
    });

    expect(normalizedText(section)).toContain('Resume live');
  });

  it('leaves route-specific workspace copy to the page shell', () => {
    const source = readFileSync('app/bookings/booking-monitor-toolbar-section.tsx', 'utf8');

    expect(source).not.toContain('pageTitle');
    expect(source).not.toContain('pageDescription');
    expect(source).not.toContain('AdminPageTemplate');
  });
});
