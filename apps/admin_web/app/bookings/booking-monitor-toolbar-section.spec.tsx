import { readFileSync } from 'node:fs';
import { Children, isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorToolbarSection } from './booking-monitor-toolbar-section';

describe('BookingMonitorToolbarSection', () => {
  it('renders only the live update action when realtime is enabled', () => {
    const section = BookingMonitorToolbarSection({
      isPending: false,
      liveUpdates: true,
      onRefreshNow: vi.fn(),
      onToggleLiveUpdates: vi.fn(),
      realtimeState: 'live',
    });
    const rendered = normalizedText(section);
    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('admin-form-control-button button button-secondary');
    expect(rendered).toContain('Pause live updates');
    expect(rendered).not.toContain('Booking Monitor');
    expect(markup).not.toContain('admin-page-header admin-page-header-toolbar');
    expect(rendered).not.toContain('Refresh now');
  });

  it('shows resume copy when realtime is paused', () => {
    const section = BookingMonitorToolbarSection({
      isPending: false,
      liveUpdates: false,
      onRefreshNow: vi.fn(),
      onToggleLiveUpdates: vi.fn(),
      realtimeState: 'paused',
    });

    expect(normalizedText(section)).toContain('Resume live updates');
  });

  it('runs one manual refresh from a degraded realtime state', () => {
    const onRefreshNow = vi.fn();
    const section = BookingMonitorToolbarSection({
      isPending: false,
      liveUpdates: true,
      onRefreshNow,
      onToggleLiveUpdates: vi.fn(),
      realtimeState: 'error',
    });
    const refreshAction = Children.toArray(section.props.children).find(
      (child) => isValidElement(child) && normalizedText(child).includes('Refresh now'),
    ) as ReactElement<{ onClick: () => void }>;

    refreshAction.props.onClick();

    expect(onRefreshNow).toHaveBeenCalledOnce();
    expect(normalizedText(section)).toContain('Refresh now');
  });

  it('leaves route-specific workspace copy to the page shell', () => {
    const source = readFileSync('app/bookings/booking-monitor-toolbar-section.tsx', 'utf8');

    expect(source).not.toContain('pageTitle');
    expect(source).not.toContain('pageDescription');
    expect(source).not.toContain('AdminPageTemplate');
  });
});
