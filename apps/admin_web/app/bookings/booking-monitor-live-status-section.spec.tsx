import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizedText } from './booking-section-test-utils';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';

describe('BookingMonitorLiveStatusSection', () => {
  it('keeps normal queue counts in the queue controls and only renders data status here', () => {
    const section = BookingMonitorLiveStatusSection({
      dataGeneratedAt: '2026-08-04T12:40:00.000Z',
      dataPartialSourceCount: 0,
      dataScope: 'all-open',
      dataSourceState: 'available',
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:45',
      realtimeState: 'live',
      summary: [
        ['Active bookings', '3'],
        ['Payment checks', '1'],
      ],
    });
    const markup = renderToStaticMarkup(section);
    const rendered = normalizedText(markup);

    expect(rendered).not.toContain('Active bookings');
    expect(rendered).not.toContain('Payment checks');
    expect(rendered).not.toContain('Realtime live');
    expect(rendered).not.toContain('Socket push updates active');
    expect(rendered).not.toContain('Last refresh 09:45');
    const markupText = normalizedText(markup);
    const source = readFileSync(
      join(process.cwd(), 'app/bookings/booking-monitor-live-status-section.tsx'),
      'utf8',
    );

    expect(markup).toContain('aria-label="Booking data status"');
    expect(markup).not.toContain('Active bookings: 3');
    expect(markup).not.toContain('admin-metric-grid');
    expect(markup).not.toContain('href=');
    expect(markupText).toContain('All open');
    expect(markupText).toContain('Live · updated');
    expect(markup).not.toContain('href="/bookings/completed?view=active"');
    expect(source).toContain('AdminFilterSummary');
    expect(source).not.toContain('AdminMetricGrid');
    expect(source).not.toContain('<section className="grid">');
  });

  it('renders pending refresh metadata before mount', () => {
    const section = BookingMonitorLiveStatusSection({
      dataGeneratedAt: '2026-08-04T12:40:00.000Z',
      dataPartialSourceCount: 1,
      dataScope: 'all-open',
      dataSourceState: 'available',
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: '09:45',
      realtimeState: 'paused',
      summary: [],
    });

    expect(normalizedText(section)).toContain('Syncing... Socket push updates paused Last refresh pending');
    expect(normalizedText(renderToStaticMarkup(section))).toContain(
      'Partial data · 1 source unavailable',
    );
  });

  it('shows an actionable warning when realtime is unavailable', () => {
    const section = BookingMonitorLiveStatusSection({
      dataPartialSourceCount: 4,
      dataScope: 'all-open',
      dataSourceState: 'unavailable',
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:45',
      realtimeState: 'error',
      summary: [],
    });
    const markup = renderToStaticMarkup(section);

    expect(normalizedText(section)).toContain(
      'Realtime disconnected Waiting for realtime connection Last refresh 09:45',
    );
    expect(markup).toContain('role="alert"');
    expect(normalizedText(markup)).toContain('Source unavailable');
  });

  it('renders historical queue summary without realtime status copy', () => {
    const markup = renderToStaticMarkup(
      BookingMonitorLiveStatusSection({
        dataPartialSourceCount: 0,
        dataScope: 'historical',
        dataSourceState: 'available',
        hasMounted: true,
        isPending: false,
        lastRefreshLabel: '21:55',
        realtimeState: 'connecting',
        summary: [
          ['Closeout checks', '4'],
          ['Oldest waiting', '2d'],
        ],
      }),
    );
    const rendered = normalizedText(markup);

    expect(rendered).toContain('Historical snapshot · refreshed 21:55');
    expect(rendered).toContain('Local data');
    expect(rendered).toContain('Closeout checks: 4');
    expect(rendered).toContain('Oldest waiting: 2d');
    expect(rendered).not.toContain('Realtime');
    expect(rendered).not.toContain('socket');
  });

  it('shows the historical audit data class without a duplicate summary', () => {
    const rendered = normalizedText(
      renderToStaticMarkup(
        BookingMonitorLiveStatusSection({
          auditFixtureVisible: true,
          dataPartialSourceCount: 0,
          dataScope: 'historical',
          dataSourceState: 'available',
          hasMounted: true,
          isPending: false,
          lastRefreshLabel: '21:55',
          realtimeState: 'connecting',
          summary: [],
        }),
      ),
    );

    expect(rendered).toContain('Audit fixtures visible');
    expect(rendered).not.toContain('Closeout checks');
    expect(rendered).not.toContain('Realtime');
  });
});
