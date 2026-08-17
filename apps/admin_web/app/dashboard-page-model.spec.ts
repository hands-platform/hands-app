import {
  buildDashboardDataHrefs,
  buildDashboardDetailsHref,
  buildDashboardOperationsHref,
  buildDashboardRange,
  buildDashboardViewMode,
} from './dashboard-page-model';

describe('dashboard page model', () => {
  it('keeps the default dashboard in summary mode', () => {
    expect(buildDashboardViewMode({})).toEqual({
      detailsMode: 'summary',
      operationsMode: 'live',
      shouldRenderFullDashboard: false,
    });
  });

  it('normalizes retired dashboard diagnostic query modes to the operator summary', () => {
    expect(buildDashboardViewMode({ details: 'all' })).toEqual({
      detailsMode: 'summary',
      operationsMode: 'live',
      shouldRenderFullDashboard: false,
    });
    expect(buildDashboardViewMode({ details: 'booking' }).shouldRenderFullDashboard).toBe(false);
    expect(buildDashboardViewMode({ details: 'operations' }).shouldRenderFullDashboard).toBe(false);
    expect(buildDashboardViewMode({ details: 'operations', operations: 'partner' }).operationsMode).toBe('live');
    expect(buildDashboardViewMode({ details: 'unexpected' }).shouldRenderFullDashboard).toBe(false);
  });

  it('preserves range filters while dropping retired diagnostic query parameters', () => {
    expect(buildDashboardDetailsHref('all', { range: '7d' })).toBe('/?range=7d');
    expect(buildDashboardDetailsHref('booking', { range: '7d' })).toBe('/?range=7d');
    expect(buildDashboardDetailsHref('operations', {})).toBe('/');
    expect(buildDashboardDetailsHref('summary', { range: '7d', details: 'all' })).toBe('/?range=7d');
    expect(buildDashboardDetailsHref('summary', {})).toBe('/');
    expect(buildDashboardOperationsHref('live', {})).toBe('/');
    expect(buildDashboardOperationsHref('analysis', { range: '7d' })).toBe('/?range=7d');
    expect(buildDashboardOperationsHref('partner', {})).toBe('/');
    expect(buildDashboardOperationsHref('closeout', {})).toBe('/');
  });

  it('defaults dashboard range to today for the initial operations view', () => {
    expect(buildDashboardRange({})).toBe('today');
    expect(buildDashboardRange({ range: '7d' })).toBe('7d');
    expect(buildDashboardRange({ range: '30d' })).toBe('30d');
    expect(buildDashboardRange({ range: '90d' })).toBe('30d');
    expect(buildDashboardRange({ range: 'all' })).toBe('30d');
  });

  it('does not load policy diagnostics from retired Start Shift modes', () => {
    expect(buildDashboardDataHrefs({})).toMatchObject({ operationalPolicyHref: null });
    expect(buildDashboardDataHrefs({ details: 'all' }).operationalPolicyHref).toBeNull();
    expect(buildDashboardDataHrefs({ details: 'operations' }).operationalPolicyHref).toBeNull();
  });

  it('keeps default dashboard data requests bounded and scoped to today', () => {
    const hrefs = buildDashboardDataHrefs({});

    expect(hrefs.dashboardSummaryHref).toBe('/admin/dashboard/summary?dateRange=today');
    expect(hrefs.startShiftSummaryHref).toBe(
      '/admin/dashboard/start-shift-summary?dateRange=today',
    );
    expect(hrefs.startShiftAnalyticsHref).toBe(
      '/admin/dashboard/start-shift-analytics?dateRange=today',
    );
    expect(hrefs.bookingsHref).toBeNull();
    expect(hrefs.partnersHref).toBeNull();
    expect(hrefs.appSessionsHref).toBeNull();
    expect(hrefs.notificationsHref).toBeNull();
    expect(hrefs.bookingGateAuditHref).toBeNull();
    expect(hrefs.paymentsHref).toBeNull();
    expect(hrefs.earningsHref).toBeNull();
    expect(hrefs.refundsHref).toBeNull();
    expect(hrefs.payoutBatchesHref).toBeNull();
    expect(hrefs.paymentSummaryHref).toBe('/admin/payments/summary?range=today');
    expect(hrefs.earningsSummaryHref).toBe('/admin/earnings/summary?range=today');
    expect(hrefs.refundsSummaryHref).toBe('/admin/refunds/summary?range=today');
    expect(hrefs.payoutBatchSummaryHref).toBe('/admin/payout-batches/summary?range=today');
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=today');
  });

  it('keeps all bounded diagnostic list requests disabled for retired query modes', () => {
    const hrefs = buildDashboardDataHrefs({ details: 'operations' });
    expect(hrefs).toMatchObject({
      appSessionsHref: null,
      bookingGateAuditHref: null,
      bookingsHref: null,
      earningsHref: null,
      notificationsHref: null,
      operationalPolicyHref: null,
      partnersHref: null,
      paymentsHref: null,
      payoutBatchesHref: null,
      refundsHref: null,
    });
  });

  it('normalizes every retired diagnostic workspace to the same lightweight request plan', () => {
    const summary = buildDashboardDataHrefs({});
    for (const params of [
      { details: 'booking' },
      { details: 'operations', operations: 'analysis' },
      { details: 'operations', operations: 'partner' },
      { details: 'operations', operations: 'closeout' },
    ]) {
      expect(buildDashboardDataHrefs(params)).toEqual(summary);
    }
  });

  it('preserves selected dashboard range for bounded list requests', () => {
    const hrefs = buildDashboardDataHrefs({ range: '7d' });

    expect(hrefs.bookingsHref).toBeNull();
    expect(hrefs.startShiftSummaryHref).toBe(
      '/admin/dashboard/start-shift-summary?dateRange=7d',
    );
    expect(hrefs.startShiftAnalyticsHref).toBe(
      '/admin/dashboard/start-shift-analytics?dateRange=7d',
    );
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
