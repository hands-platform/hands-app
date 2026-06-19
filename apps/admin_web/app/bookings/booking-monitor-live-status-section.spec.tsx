import { headingTextsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorLiveStatusSection } from './booking-monitor-live-status-section';

describe('BookingMonitorLiveStatusSection', () => {
  it('renders summary rows and ready refresh metadata', () => {
    const section = BookingMonitorLiveStatusSection({
      autoRefresh: true,
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:45',
      refreshIntervalSeconds: 5,
      summary: [
        ['Active bookings', '3'],
        ['Payment checks', '1'],
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Active bookings');
    expect(rendered).toContain('Payment checks');
    expect(rendered).toContain('Ready');
    expect(rendered).toContain('Live updates every 5s');
    expect(rendered).toContain('Last refresh 09:45');
    expect(headingTextsIn(section)).toEqual([]);
  });

  it('renders pending refresh metadata before mount', () => {
    const section = BookingMonitorLiveStatusSection({
      autoRefresh: false,
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: '09:45',
      refreshIntervalSeconds: 5,
      summary: [],
    });

    expect(normalizedText(section)).toContain('Refreshing... Live updates paused Last refresh pending');
  });
});
