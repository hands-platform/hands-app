import { buildBookingMonitorRouteLoadPlan } from './booking-monitor-route-load-plan';

describe('booking monitor route load plan', () => {
  it('keeps realtime bookings and gate audit requests bounded to today by default', () => {
    expect(buildBookingMonitorRouteLoadPlan(undefined, 'all')).toEqual({
      bookingGateAuditHref: '/admin/audit-logs?action=booking.create.rejected&take=25',
      bookingsHref: '/admin/bookings?dateRange=today&statusGroup=realtime&take=25',
      policySettingsHref: '/admin/operational-policy',
    });
  });

  it('keeps completed and cancellation route lists bounded with custom dates', () => {
    expect(
      buildBookingMonitorRouteLoadPlan(
        { dateRange: 'custom', dateFrom: '2026-06-01', dateTo: '2026-06-02' },
        'completed',
      ).bookingsHref,
    ).toBe(
      '/admin/bookings?dateRange=custom&statusGroup=completed&take=25&dateFrom=2026-06-01&dateTo=2026-06-02',
    );

    expect(buildBookingMonitorRouteLoadPlan({ dateRange: '7d' }, 'postMatchCancellations').bookingsHref).toBe(
      '/admin/bookings?dateRange=7d&statusGroup=post-match-cancellations&take=25',
    );
  });
});
