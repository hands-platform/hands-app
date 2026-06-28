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
    expect(buildDashboardDataHrefs({ details: 'all' })).toMatchObject({
      operationalPolicyHref: '/admin/operational-policy',
    });
  });

  it('keeps default dashboard data requests bounded and scoped to today', () => {
    const hrefs = buildDashboardDataHrefs({});
    const bookingUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const notificationUrl = new URL(hrefs.notificationsHref, 'http://admin.local');
    const auditUrl = new URL(hrefs.bookingGateAuditHref, 'http://admin.local');
    const paymentUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const earningUrl = new URL(hrefs.earningsHref, 'http://admin.local');
    const refundUrl = new URL(hrefs.refundsHref, 'http://admin.local');
    const payoutBatchUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');
    const appSessionsUrl = new URL(hrefs.appSessionsHref, 'http://admin.local');

    expect(hrefs.dashboardSummaryHref).toBe('/admin/dashboard/summary');
    expect(hrefs.usersHref).toBeNull();
    expect(bookingUrl.pathname).toBe('/admin/bookings');
    expect(bookingUrl.searchParams.get('dateRange')).toBe('today');
    expect(bookingUrl.searchParams.get('take')).toBe('100');
    expect(notificationUrl.pathname).toBe('/admin/notifications');
    expect(notificationUrl.searchParams.get('take')).toBe('20');
    expect(Number.isFinite(Date.parse(notificationUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(notificationUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(auditUrl.pathname).toBe('/admin/audit-logs');
    expect(auditUrl.searchParams.get('action')).toBe('booking.create.rejected');
    expect(auditUrl.searchParams.get('take')).toBe('20');
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(paymentUrl.searchParams.get('range')).toBe('today');
    expect(paymentUrl.searchParams.get('take')).toBe('50');
    expect(earningUrl.searchParams.get('range')).toBe('today');
    expect(earningUrl.searchParams.get('take')).toBe('50');
    expect(refundUrl.searchParams.get('range')).toBe('today');
    expect(refundUrl.searchParams.get('take')).toBe('50');
    expect(payoutBatchUrl.searchParams.get('range')).toBe('today');
    expect(payoutBatchUrl.searchParams.get('take')).toBe('50');
    expect(appSessionsUrl.searchParams.get('take')).toBe('50');
    expect(appSessionsUrl.searchParams.get('role')).toBe('PROVIDER');
  });

  it('keeps full dashboard diagnostics behind explicit details mode', () => {
    const hrefs = buildDashboardDataHrefs({ details: 'all' });
    const appSessionsUrl = new URL(hrefs.appSessionsHref, 'http://admin.local');

    expect(hrefs.usersHref).toBe('/admin/users');
    expect(appSessionsUrl.searchParams.get('take')).toBe('50');
    expect(appSessionsUrl.searchParams.has('role')).toBe(false);
  });

  it('preserves selected dashboard range for bounded list requests', () => {
    const hrefs = buildDashboardDataHrefs({ range: '7d' });
    const bookingUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const notificationUrl = new URL(hrefs.notificationsHref, 'http://admin.local');
    const paymentUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const payoutBatchUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingUrl.searchParams.get('dateRange')).toBe('7d');
    expect(notificationUrl.searchParams.get('take')).toBe('20');
    expect(Number.isFinite(Date.parse(notificationUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(notificationUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(paymentUrl.searchParams.get('range')).toBe('7d');
    expect(paymentUrl.searchParams.get('take')).toBe('50');
    expect(payoutBatchUrl.searchParams.get('range')).toBe('7d');
    expect(payoutBatchUrl.searchParams.get('take')).toBe('50');
  });
});
