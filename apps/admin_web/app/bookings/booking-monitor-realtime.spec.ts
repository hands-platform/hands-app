import { bookingMonitorUsesRealtime } from './booking-monitor-realtime';

describe('booking monitor realtime context', () => {
  it('keeps historical records and non-live workspaces off the realtime token path', () => {
    expect(bookingMonitorUsesRealtime('/bookings', 'active')).toBe(true);
    expect(bookingMonitorUsesRealtime('/bookings', 'all')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'pre-match-cancelled')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'preferred-rejected')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'preferred-no-response')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings', 'usage-unresolved')).toBe(false);
    expect(bookingMonitorUsesRealtime('/bookings/completed', 'closeout')).toBe(false);
  });
});
