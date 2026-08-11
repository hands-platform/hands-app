export const BOOKING_MONITOR_REALTIME_EVENTS = [
  'booking.opened',
  'provider.joined',
  'provider.accepted',
  'provider.rejected',
  'booking.matched',
  'booking.expired',
  'service.started',
  'service.completed',
] as const;

export type BookingMonitorRealtimeState = 'connecting' | 'error' | 'live' | 'paused';

export const BOOKING_RECORD_VIEWS = new Set([
  'all',
  'pre-match-cancelled',
  'preferred-rejected',
  'preferred-no-response',
  'usage-unresolved',
]);

export function bookingMonitorIsRecordsView(path: string, view: string) {
  return path === '/bookings' && BOOKING_RECORD_VIEWS.has(view);
}

export function bookingMonitorUsesRealtime(path: string, view: string) {
  return path === '/bookings' && !bookingMonitorIsRecordsView(path, view);
}

export function bookingMonitorRealtimeLabel(state: BookingMonitorRealtimeState) {
  if (state === 'live') {
    return 'Realtime live';
  }

  if (state === 'paused') {
    return 'Realtime paused';
  }

  if (state === 'error') {
    return 'Realtime disconnected';
  }

  return 'Realtime connecting';
}
