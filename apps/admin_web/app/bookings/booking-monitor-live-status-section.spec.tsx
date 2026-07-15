import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { headingTextsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';

describe('BookingMonitorLiveStatusSection', () => {
  it('renders summary rows and ready refresh metadata', () => {
    const section = BookingMonitorLiveStatusSection({
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:45',
      realtimeState: 'live',
      summary: [
        ['Active bookings', '3'],
        ['Payment checks', '1'],
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Payment checks');
    expect(rendered).toContain('Realtime live');
    expect(rendered).toContain('Socket push updates active');
    expect(rendered).toContain('Last refresh 09:45');
    expect(headingTextsIn(section)).toEqual(['3', '1']);
    const markup = renderToStaticMarkup(section);
    const source = readFileSync(join(process.cwd(), 'app/bookings/booking-monitor-live-status-section.tsx'), 'utf8');

    expect(markup.match(/class="metric-card"/g) ?? []).toHaveLength(2);
    expect(markup).toContain('class="metric-card-scope is-live"');
    expect(markup).toContain('class="metric-card-scope is-risk"');
    expect(markup).toContain('Live');
    expect(markup).toContain('Needs action');
    expect(markup).not.toContain('Booking monitor summary');
    expect(markup).toContain('admin-metric-grid');
    expect(source).toContain('AdminMetricGrid');
    expect(source).not.toContain('<section className="grid">');
  });

  it('renders pending refresh metadata before mount', () => {
    const section = BookingMonitorLiveStatusSection({
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: '09:45',
      realtimeState: 'paused',
      summary: [],
    });

    expect(normalizedText(section)).toContain('Syncing... Socket push updates paused Last refresh pending');
  });
});
