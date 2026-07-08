import {
  buildDashboardDataHrefs,
  buildDashboardDetailsHref,
  buildDashboardRange,
  buildDashboardViewMode,
} from './dashboard-page-model';

describe('dashboard page model', () => {
  it('keeps the default dashboard in summary mode', () => {
    expect(buildDashboardViewMode({})).toEqual({
      detailsMode: 'summary',
      shouldRenderFullDashboard: false,
    });
  });

  it('enables the full dashboard only when details=all is explicit', () => {
    expect(buildDashboardViewMode({ details: 'all' })).toEqual({
      detailsMode: 'all',
      shouldRenderFullDashboard: true,
    });
    expect(buildDashboardViewMode({ details: 'unexpected' }).shouldRenderFullDashboard).toBe(false);
  });

  it('preserves range filters when building summary and full dashboard links', () => {
    expect(buildDashboardDetailsHref('all', { range: '7d' })).toBe('/?range=7d&details=all');
    expect(buildDashboardDetailsHref('summary', { range: '7d', details: 'all' })).toBe('/?range=7d');
    expect(buildDashboardDetailsHref('summary', {})).toBe('/');
  });

  it('defaults dashboard range to today for the initial operations view', () => {
    expect(buildDashboardRange({})).toBe('today');
    expect(buildDashboardRange({ range: '7d' })).toBe('7d');
  });

  it('loads policy diagnostics only for the full dashboard', () => {
    expect(buildDashboardDataHrefs({})).toMatchObject({ operationalPolicyHref: null });
    const policyHref = buildDashboardDataHrefs({ details: 'all' }).operationalPolicyHref;
    const policyUrl = new URL(policyHref ?? '', 'http://admin.local');

    expect(policyUrl.pathname).toBe('/admin/operational-policy');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.provider_response_window_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.marketplace_partner_location_max_age_minutes',
      'matching.marketplace_partner_invitation_limit',
      'matching.marketplace_open_mode',
      'matching.preferred_accept_mode',
      'matching.travel_buffer_minutes',
      'wallet.negative_balance_gate',
      'cancellation.after_match_policy',
      'no_show.partner_report_policy',
      'notification.partner_alert_channel',
    ]);
  });

  it('keeps default dashboard data requests bounded and scoped to today', () => {
    const hrefs = buildDashboardDataHrefs({});
    const bookingUrl = new URL(hrefs.bookingsHref, 'http://admin.local');

    expect(hrefs.dashboardSummaryHref).toBe('/admin/dashboard/summary');
    expect(hrefs.usersHref).toBeNull();
    expect(hrefs.partnersHref).toBeNull();
    expect(hrefs.appSessionsHref).toBeNull();
    expect(hrefs.notificationsHref).toBeNull();
    expect(hrefs.bookingGateAuditHref).toBeNull();
    expect(hrefs.paymentsHref).toBeNull();
    expect(hrefs.earningsHref).toBeNull();
    expect(hrefs.refundsHref).toBeNull();
    expect(hrefs.payoutBatchesHref).toBeNull();
    expect(bookingUrl.pathname).toBe('/admin/bookings');
    expect(bookingUrl.searchParams.get('dateRange')).toBe('today');
    expect(bookingUrl.searchParams.get('take')).toBe('10');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=today');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=today');
    expect(hrefs.refundsSummaryHref).toBe('/admin/refunds/summary?range=today');
    expect(hrefs.payoutBatchSummaryHref).toBe('/admin/payout-batches/summary?range=today');
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=today');
  });

  it('keeps full dashboard diagnostics behind explicit details mode', () => {
    const hrefs = buildDashboardDataHrefs({ details: 'all' });
    const auditUrl = new URL(hrefs.bookingGateAuditHref ?? '', 'http://admin.local');
    const appSessionsUrl = new URL(hrefs.appSessionsHref ?? '', 'http://admin.local');
    const earningUrl = new URL(hrefs.earningsHref ?? '', 'http://admin.local');
    const notificationsUrl = new URL(hrefs.notificationsHref ?? '', 'http://admin.local');
    const paymentUrl = new URL(hrefs.paymentsHref ?? '', 'http://admin.local');
    const payoutBatchUrl = new URL(hrefs.payoutBatchesHref ?? '', 'http://admin.local');
    const refundUrl = new URL(hrefs.refundsHref ?? '', 'http://admin.local');
    const usersUrl = new URL(hrefs.usersHref ?? '', 'http://admin.local');
    const partnersUrl = new URL(hrefs.partnersHref ?? '', 'http://admin.local');

    expect(auditUrl.pathname).toBe('/admin/audit-logs');
    expect(auditUrl.searchParams.get('action')).toBe('booking.create.rejected');
    expect(auditUrl.searchParams.get('take')).toBe('20');
    expect(paymentUrl.searchParams.get('take')).toBe('25');
    expect(earningUrl.searchParams.get('take')).toBe('25');
    expect(refundUrl.searchParams.get('take')).toBe('25');
    expect(payoutBatchUrl.searchParams.get('take')).toBe('25');
    expect(notificationsUrl.pathname).toBe('/admin/notifications');
    expect(notificationsUrl.searchParams.get('take')).toBe('20');
    expect(Number.isFinite(Date.parse(notificationsUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(notificationsUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(usersUrl.pathname).toBe('/admin/users');
    expect(usersUrl.searchParams.get('take')).toBe('25');
    expect(partnersUrl.pathname).toBe('/admin/partners/list-providers');
    expect(partnersUrl.searchParams.get('take')).toBe('25');
    expect(appSessionsUrl.searchParams.get('take')).toBe('10');
    expect(appSessionsUrl.searchParams.has('role')).toBe(false);
  });

  it('preserves selected dashboard range for bounded list requests', () => {
    const hrefs = buildDashboardDataHrefs({ range: '7d' });
    const bookingUrl = new URL(hrefs.bookingsHref, 'http://admin.local');

    expect(bookingUrl.searchParams.get('dateRange')).toBe('7d');
    expect(hrefs.notificationsHref).toBeNull();
    expect(hrefs.paymentsHref).toBeNull();
    expect(hrefs.earningsHref).toBeNull();
    expect(hrefs.refundsHref).toBeNull();
    expect(hrefs.payoutBatchesHref).toBeNull();
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=7d');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=7d');
    expect(hrefs.refundsSummaryHref).toBe('/admin/refunds/summary?range=7d');
    expect(hrefs.payoutBatchSummaryHref).toBe('/admin/payout-batches/summary?range=7d');
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
  });
});
