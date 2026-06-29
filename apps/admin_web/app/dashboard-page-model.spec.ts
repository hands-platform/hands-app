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
    const auditUrl = new URL(hrefs.bookingGateAuditHref, 'http://admin.local');
    const paymentUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const earningUrl = new URL(hrefs.earningsHref, 'http://admin.local');
    const refundUrl = new URL(hrefs.refundsHref, 'http://admin.local');
    const payoutBatchUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(hrefs.dashboardSummaryHref).toBe('/admin/dashboard/summary');
    expect(hrefs.usersHref).toBeNull();
    expect(hrefs.partnersHref).toBeNull();
    expect(hrefs.appSessionsHref).toBeNull();
    expect(hrefs.notificationsHref).toBeNull();
    expect(bookingUrl.pathname).toBe('/admin/bookings');
    expect(bookingUrl.searchParams.get('dateRange')).toBe('today');
    expect(bookingUrl.searchParams.get('take')).toBe('10');
    expect(auditUrl.pathname).toBe('/admin/audit-logs');
    expect(auditUrl.searchParams.get('action')).toBe('booking.create.rejected');
    expect(auditUrl.searchParams.get('take')).toBe('5');
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(paymentUrl.searchParams.get('range')).toBe('today');
    expect(paymentUrl.searchParams.get('take')).toBe('5');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=today');
    expect(earningUrl.searchParams.get('range')).toBe('today');
    expect(earningUrl.searchParams.get('take')).toBe('5');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=today');
    expect(hrefs.refundsSummaryHref).toBe('/admin/refunds/summary?range=today');
    expect(hrefs.payoutBatchSummaryHref).toBe('/admin/payout-batches/summary?range=today');
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=today');
    expect(refundUrl.searchParams.get('range')).toBe('today');
    expect(refundUrl.searchParams.get('take')).toBe('5');
    expect(payoutBatchUrl.searchParams.get('range')).toBe('today');
    expect(payoutBatchUrl.searchParams.get('take')).toBe('5');
  });

  it('keeps full dashboard diagnostics behind explicit details mode', () => {
    const hrefs = buildDashboardDataHrefs({ details: 'all' });
    const appSessionsUrl = new URL(hrefs.appSessionsHref ?? '', 'http://admin.local');
    const notificationsUrl = new URL(hrefs.notificationsHref ?? '', 'http://admin.local');
    const usersUrl = new URL(hrefs.usersHref ?? '', 'http://admin.local');
    const partnersUrl = new URL(hrefs.partnersHref ?? '', 'http://admin.local');

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
    const paymentUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const payoutBatchUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingUrl.searchParams.get('dateRange')).toBe('7d');
    expect(hrefs.notificationsHref).toBeNull();
    expect(paymentUrl.searchParams.get('range')).toBe('7d');
    expect(paymentUrl.searchParams.get('take')).toBe('5');
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=7d');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=7d');
    expect(hrefs.refundsSummaryHref).toBe('/admin/refunds/summary?range=7d');
    expect(hrefs.payoutBatchSummaryHref).toBe('/admin/payout-batches/summary?range=7d');
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
    expect(payoutBatchUrl.searchParams.get('range')).toBe('7d');
    expect(payoutBatchUrl.searchParams.get('take')).toBe('5');
  });
});
