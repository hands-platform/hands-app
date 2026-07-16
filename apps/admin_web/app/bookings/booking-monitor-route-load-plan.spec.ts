import { buildBookingMonitorRouteLoadPlan } from './booking-monitor-route-load-plan';

describe('booking monitor route load plan', () => {
  it('keeps realtime bookings and gate audit requests bounded to today by default', () => {
    const loadPlan = buildBookingMonitorRouteLoadPlan(undefined, 'all');
    const policyUrl = new URL(loadPlan.policySettingsHref, 'http://admin.local');

    expect(policyUrl.pathname).toBe('/admin/operational-policy');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.provider_response_window_minutes',
      'matching.travel_buffer_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.marketplace_partner_location_max_age_minutes',
      'matching.marketplace_partner_invitation_limit',
      'wallet.negative_balance_gate',
    ]);
    expect(loadPlan).toEqual({
      bookingGateAuditHref: '/admin/audit-logs?action=booking.create.rejected&take=10',
      bookingsHref: '/admin/bookings?dateRange=today&statusGroup=realtime&take=10',
      policySettingsHref:
        '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.travel_buffer_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_location_max_age_minutes%2Cmatching.marketplace_partner_invitation_limit%2Cwallet.negative_balance_gate',
    });
  });

  it('keeps completed and cancellation route lists bounded with custom dates', () => {
    expect(
      buildBookingMonitorRouteLoadPlan(
        { dateRange: 'custom', dateFrom: '2026-06-01', dateTo: '2026-06-02' },
        'completed',
      ).bookingsHref,
    ).toBe(
      '/admin/bookings?dateRange=custom&statusGroup=completed&take=10&dateFrom=2026-06-01&dateTo=2026-06-02',
    );

    expect(buildBookingMonitorRouteLoadPlan({ dateRange: '7d' }, 'postMatchCancellations').bookingsHref).toBe(
      '/admin/bookings?dateRange=7d&statusGroup=post-match-cancellations&take=10',
    );
  });

  it('loads recent records across statuses only when the records workspace is explicit', () => {
    expect(
      buildBookingMonitorRouteLoadPlan({ dateRange: '7d', view: 'all' }, 'all').bookingsHref,
    ).toBe('/admin/bookings?dateRange=7d&take=10');
    expect(
      buildBookingMonitorRouteLoadPlan({ dateRange: '7d', view: 'matching' }, 'all').bookingsHref,
    ).toBe('/admin/bookings?dateRange=7d&statusGroup=realtime&take=10');
  });
});
