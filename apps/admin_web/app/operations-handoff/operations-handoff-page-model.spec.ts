import { auditActivityArea, relatedHref } from './operations-handoff-activity-stream';
import type {
  AdminAuditLog,
  AdminEarning,
  AdminPayment,
  AdminPayoutBatch,
  AdminRefund,
} from '../../lib/admin-api';
import {
  buildActivityStreamCsvHref,
  buildOperationsHandoffFailedNotificationCount,
  buildOperationsHandoffDataHrefs,
  buildOperationsHandoffFilters,
  buildOperationsHandoffRangeData,
  emptyCashSettlementSummary,
  operationsHandoffActivityBacklogHref,
  operationsHandoffActivityAgeHref,
  operationsHandoffActivityOver24hHref,
  operationsHandoffActivityReasonOptions,
  operationsHandoffActivityReasonHref,
  operationsHandoffActivityReviewHref,
  operationsHandoffActivitySortHref,
  operationsHandoffActivitySourceHref,
  operationsHandoffDetailPageHref,
} from './operations-handoff-page-model';

describe('operations handoff page model', () => {
  it('normalizes filters and provides a complete empty cash settlement fallback', () => {
    expect(buildOperationsHandoffFilters({})).toEqual({
      activityAge: 'all',
      activityBacklog: 'current',
      activityReason: 'all',
      activityReview: 'needs-review',
      activitySort: 'oldest',
      activitySource: 'all',
      detailPages: {
        activity: 1,
        bookings: 1,
        customers: 1,
        decisions: 1,
        finance: 1,
        partners: 1,
      },
      detailsMode: 'summary',
      range: '7d',
    });
    expect(buildOperationsHandoffFilters({ range: ['7d'] })).toEqual({
      activityAge: 'all',
      activityBacklog: 'current',
      activityReason: 'all',
      activityReview: 'needs-review',
      activitySort: 'oldest',
      activitySource: 'all',
      detailPages: {
        activity: 1,
        bookings: 1,
        customers: 1,
        decisions: 1,
        finance: 1,
        partners: 1,
      },
      detailsMode: 'summary',
      range: '7d',
    });
    expect(buildOperationsHandoffFilters({ range: 'unsupported' })).toEqual({
      activityAge: 'all',
      activityBacklog: 'current',
      activityReason: 'all',
      activityReview: 'needs-review',
      activitySort: 'oldest',
      activitySource: 'all',
      detailPages: {
        activity: 1,
        bookings: 1,
        customers: 1,
        decisions: 1,
        finance: 1,
        partners: 1,
      },
      detailsMode: 'summary',
      range: 'today',
    });
    expect(buildOperationsHandoffFilters({ details: 'all' })).toEqual({
      activityAge: 'all',
      activityBacklog: 'current',
      activityReason: 'all',
      activityReview: 'needs-review',
      activitySort: 'oldest',
      activitySource: 'all',
      detailPages: {
        activity: 1,
        bookings: 1,
        customers: 1,
        decisions: 1,
        finance: 1,
        partners: 1,
      },
      detailsMode: 'all',
      range: '7d',
    });
    expect(emptyCashSettlementSummary()).toMatchObject({
      cashPaymentRowCount: 0,
      currency: 'VND',
      providerCount: 0,
      topProviderGroups: [],
      totalDebtAmount: 0,
    });
    expect(
      buildOperationsHandoffFilters({
        activityReason: 'payment',
        activityReview: 'all',
        activitySource: 'booking',
      }),
    ).toMatchObject({
      activityBacklog: 'all',
      activityReason: 'all',
      activityReview: 'all',
      activitySort: 'newest',
      activitySource: 'booking',
    });
    expect(
      buildOperationsHandoffFilters({
        activityReason: 'payment',
        activitySource: 'finance',
      }),
    ).toMatchObject({
      activityBacklog: 'current',
      activityReason: 'all',
      activityReview: 'needs-review',
      activitySource: 'finance',
    });
    expect(
      operationsHandoffActivityReasonOptions('booking').map((option) => option.value),
    ).toEqual(['all', 'booking-state', 'payment', 'missing-settlement']);
  });

  it('preserves compatible reason priority and clears it when the source changes domain', () => {
    const filters = buildOperationsHandoffFilters({
      activityAge: 'over-24h',
      activityReason: 'payment',
      activitySort: 'newest',
      activitySource: 'all',
      details: 'all',
      range: '30d',
    });

    expect(operationsHandoffActivitySourceHref(filters, 'booking')).toContain(
      'activityReason=payment',
    );
    expect(operationsHandoffActivitySourceHref(filters, 'finance')).not.toContain(
      'activityReason=payment',
    );
    expect(operationsHandoffDetailPageHref(filters, 'activity')(2)).toContain(
      'activityReason=payment',
    );
    expect(operationsHandoffActivityAgeHref(filters, '1-4h')).toContain(
      'activityReason=payment',
    );
    expect(operationsHandoffActivitySortHref(filters, 'oldest')).toContain(
      'activityReason=payment',
    );
    expect(operationsHandoffActivityBacklogHref(filters, 'legacy')).toContain(
      'activityBacklog=legacy',
    );
    expect(operationsHandoffActivityOver24hHref(filters, 'notification-failure')).toBe(
      '/operations-handoff?details=all&range=30d&activityReason=notification-failure&activityAge=over-24h',
    );
  });

  it('normalizes full history detail pagination links without changing the data window', () => {
    const filters = buildOperationsHandoffFilters({
      activityPage: '2',
      activitySource: 'finance',
      bookingPage: 'bad',
      customerPage: '4',
      decisionPage: '6',
      details: 'all',
      financePage: '30',
      partnerPage: '5',
      range: '30d',
    });

    expect(filters.detailPages).toEqual({
      activity: 2,
      bookings: 1,
      customers: 4,
      decisions: 6,
      finance: 30,
      partners: 5,
    });
    expect(operationsHandoffDetailPageHref(filters, 'bookings')(3)).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityPage=2&bookingPage=3&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffDetailPageHref(filters, 'customers')(6)).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityPage=2&customerPage=6&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffDetailPageHref(filters, 'partners')(7)).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityPage=2&customerPage=4&decisionPage=6&financePage=30&partnerPage=7',
    );
    expect(operationsHandoffDetailPageHref(filters, 'decisions')(2)).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityPage=2&customerPage=4&decisionPage=2&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivitySourceHref(filters, 'chat')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=chat&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivitySourceHref(filters, 'all')).toBe(
      '/operations-handoff?details=all&range=30d&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityReviewHref(filters, 'all')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityReview=all&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityReviewHref(filters, 'needs-review')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityAgeHref(filters, 'over-24h')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityAge=over-24h&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivitySortHref(filters, 'newest')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activitySort=newest&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityReasonHref(filters, 'finance-unpaid')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityReason=finance-unpaid&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityReasonHref(filters, 'payment')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityOver24hHref(filters, 'finance-unpaid')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityReason=finance-unpaid&activityAge=over-24h&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
    expect(operationsHandoffActivityOver24hHref(filters, 'payment')).toBe(
      '/operations-handoff?details=all&range=30d&activitySource=finance&activityAge=over-24h&customerPage=4&decisionPage=6&financePage=30&partnerPage=5',
    );
  });

  it('keeps default operations history requests bounded and scoped to the last 7 days', () => {
    const hrefs = buildOperationsHandoffDataHrefs({});
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const completedBookingSummaryUrl = new URL(
      hrefs.completedBookingSummaryHref,
      'http://admin.local',
    );
    const auditUrl = new URL(hrefs.auditLogsHref, 'http://admin.local');
    const operatorNoteSummaryUrl = new URL(
      hrefs.operatorNoteSummaryHref,
      'http://admin.local',
    );
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const earningsUrl = new URL(hrefs.earningsHref, 'http://admin.local');
    const financeCloseoutSummaryUrl = new URL(
      hrefs.financeCloseoutSummaryHref,
      'http://admin.local',
    );
    const financeDecisionAuditSummaryUrl = new URL(
      hrefs.financeDecisionAuditSummaryHref,
      'http://admin.local',
    );
    const refundsUrl = new URL(hrefs.refundsHref, 'http://admin.local');
    const payoutBatchesUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingsUrl.pathname).toBe('/admin/bookings');
    expect(bookingsUrl.searchParams.get('dateRange')).toBe('7d');
    expect(bookingsUrl.searchParams.get('take')).toBe('10');
    expect('appSessionsHref' in hrefs).toBe(false);
    expect('appSessionSummaryHref' in hrefs).toBe(false);
    expect(hrefs.activityStreamHref).toBeNull();
    expect(hrefs.bookingHistoryHref).toBeNull();
    expect(hrefs.customerSummaryHref).toBeNull();
    expect(hrefs.customersHref).toBeNull();
    const partnersUrl = new URL(hrefs.partnersHref!, 'http://admin.local');
    expect(partnersUrl.pathname).toBe('/admin/operations-handoff/providers');
    expect(partnersUrl.searchParams.get('review')).toBe('attention');
    expect(partnersUrl.searchParams.get('skip')).toBe('0');
    expect(partnersUrl.searchParams.get('take')).toBe('1');
    expect(partnersUrl.searchParams.get('withTotal')).toBe('true');
    expect(completedBookingSummaryUrl.pathname).toBe('/admin/bookings/completed-operations-summary');
    expect(completedBookingSummaryUrl.searchParams.get('dateRange')).toBe('7d');
    expect(paymentsUrl.searchParams.get('range')).toBe('7d');
    expect(paymentsUrl.searchParams.get('take')).toBe('5');
    expect(earningsUrl.searchParams.get('range')).toBe('7d');
    expect(earningsUrl.searchParams.get('take')).toBe('5');
    expect(hrefs.financeCloseoutEarningsHref).toBeNull();
    expect(financeCloseoutSummaryUrl.pathname).toBe('/admin/earnings/summary');
    expect(financeCloseoutSummaryUrl.searchParams.get('range')).toBe('7d');
    expect(financeCloseoutSummaryUrl.searchParams.get('review')).toBe('closeout-review');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
    expect(hrefs.notificationsHref).toBeNull();
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(refundsUrl.searchParams.get('range')).toBe('7d');
    expect(refundsUrl.searchParams.get('take')).toBe('5');
    expect(payoutBatchesUrl.searchParams.get('range')).toBe('7d');
    expect(payoutBatchesUrl.searchParams.get('take')).toBe('5');
    expect(payoutBatchesUrl.searchParams.get('review')).toBe('needs-review');
    expect(auditUrl.pathname).toBe('/admin/audit-logs');
    expect(auditUrl.searchParams.get('take')).toBe('5');
    expect(operatorNoteSummaryUrl.pathname).toBe('/admin/audit-logs/summary');
    expect(operatorNoteSummaryUrl.searchParams.getAll('action')).toEqual([
      'operations.handoff_note.add',
      'booking.ops_note.add',
      'customer.ops_note.add',
      'provider.ops_note.add',
    ]);
    expect(
      Date.parse(operatorNoteSummaryUrl.searchParams.get('to') ?? '') -
        Date.parse(operatorNoteSummaryUrl.searchParams.get('from') ?? ''),
    ).toBe(4 * 60 * 60 * 1000);
    expect(hrefs.financeDecisionAuditLogsHref).toBeNull();
    expect(financeDecisionAuditSummaryUrl.pathname).toBe('/admin/audit-logs/summary');
    expect(financeDecisionAuditSummaryUrl.searchParams.getAll('action')).toEqual([
      'company_bank_account.create',
      'company_bank_account.update',
      'company_bank_account.approval_rejected',
      'bank_reconciliation.match.create',
      'bank_reconciliation.match.reverse',
      'bank_reconciliation.transaction.ignore',
      'company_bank_transaction.review_escalation_resolved',
      'partner_bank_deposit.reconciliation_escalation_resolved',
      'wallet_adjustment_request.execute',
      'wallet_adjustment_request.reject',
      'wallet_adjustment_request.cancel_stale',
      'partner_bank_deposit_request.execute',
      'partner_bank_deposit_request.reject',
      'payout_batch.update',
      'payout_batch.reversal',
      'provider_wallet.withdrawal_request.update',
      'provider_wallet.withdrawal_request.reversal',
      'monthly_tax_closing.status_update',
      'payment.refund',
      'payment.refund.reject',
    ]);
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('to') ?? ''))).toBe(true);
  });

  it('keeps the exact unified activity stream behind full handoff details', () => {
    const hrefs = buildOperationsHandoffDataHrefs({ details: 'all', range: '7d' });
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const bookingHistoryUrl = new URL(hrefs.bookingHistoryHref!, 'http://admin.local');
    const activityStreamUrl = new URL(hrefs.activityStreamHref!, 'http://admin.local');
    const customersUrl = new URL(hrefs.customersHref!, 'http://admin.local');
    const customerSummaryUrl = new URL(hrefs.customerSummaryHref!, 'http://admin.local');
    const notificationsUrl = new URL(hrefs.notificationsHref!, 'http://admin.local');
    const financeDecisionAuditUrl = new URL(
      hrefs.financeDecisionAuditLogsHref!,
      'http://admin.local',
    );
    const financeDecisionAuditSummaryUrl = new URL(
      hrefs.financeDecisionAuditSummaryHref,
      'http://admin.local',
    );
    const financeCloseoutEarningsUrl = new URL(
      hrefs.financeCloseoutEarningsHref!,
      'http://admin.local',
    );
    const partnersUrl = new URL(hrefs.partnersHref!, 'http://admin.local');
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');

    expect(bookingsUrl.searchParams.get('take')).toBe('50');
    expect(bookingHistoryUrl.pathname).toBe('/admin/bookings/page');
    expect(bookingHistoryUrl.searchParams.get('dateRange')).toBe('7d');
    expect(bookingHistoryUrl.searchParams.get('page')).toBe('1');
    expect(bookingHistoryUrl.searchParams.get('pageSize')).toBe('3');
    expect('appSessionsHref' in hrefs).toBe(false);
    expect('appSessionSummaryHref' in hrefs).toBe(false);
    expect(activityStreamUrl.pathname).toBe('/admin/operations-handoff/activity');
    expect(activityStreamUrl.searchParams.get('range')).toBe('7d');
    expect(activityStreamUrl.searchParams.get('age')).toBe('all');
    expect(activityStreamUrl.searchParams.get('backlog')).toBe('current');
    expect(activityStreamUrl.searchParams.get('review')).toBe('needs-review');
    expect(activityStreamUrl.searchParams.get('page')).toBe('1');
    expect(activityStreamUrl.searchParams.get('pageSize')).toBe('3');
    expect(activityStreamUrl.searchParams.get('reason')).toBe('all');
    expect(activityStreamUrl.searchParams.get('sort')).toBe('oldest');
    expect(activityStreamUrl.searchParams.get('source')).toBe('all');
    expect(customersUrl.pathname).toBe('/admin/customers');
    expect(customersUrl.searchParams.get('skip')).toBe('0');
    expect(customersUrl.searchParams.get('take')).toBe('3');
    expect(customerSummaryUrl.pathname).toBe('/admin/customers/summary');
    expect(notificationsUrl.pathname).toBe('/admin/notifications');
    expect(notificationsUrl.searchParams.get('take')).toBe('50');
    expect(partnersUrl.pathname).toBe('/admin/operations-handoff/providers');
    expect(partnersUrl.searchParams.get('review')).toBe('attention');
    expect(partnersUrl.searchParams.get('skip')).toBe('0');
    expect(partnersUrl.searchParams.get('take')).toBe('3');
    expect(partnersUrl.searchParams.get('withTotal')).toBe('true');
    expect(paymentsUrl.searchParams.get('take')).toBe('50');
    expect(financeDecisionAuditUrl.searchParams.get('take')).toBe('3');
    expect(financeDecisionAuditUrl.searchParams.get('withTotal')).toBe('true');
    expect(financeDecisionAuditSummaryUrl.pathname).toBe('/admin/audit-logs/summary');
    expect(financeCloseoutEarningsUrl.pathname).toBe('/admin/earnings');
    expect(financeCloseoutEarningsUrl.searchParams.get('range')).toBe('7d');
    expect(financeCloseoutEarningsUrl.searchParams.get('review')).toBe('closeout-review');
    expect(financeCloseoutEarningsUrl.searchParams.get('skip')).toBe('0');
    expect(financeCloseoutEarningsUrl.searchParams.get('take')).toBe('3');
  });

  it('requests only the selected Activity, Booking, Customer, and Partner history pages', () => {
    const hrefs = buildOperationsHandoffDataHrefs({
      activityPage: '7',
      activityReview: 'all',
      activitySource: 'notification',
      bookingPage: '4',
      customerPage: '5',
      details: 'all',
      partnerPage: '6',
      range: '30d',
    });
    const activityStreamUrl = new URL(hrefs.activityStreamHref!, 'http://admin.local');
    const bookingHistoryUrl = new URL(hrefs.bookingHistoryHref!, 'http://admin.local');
    const customersUrl = new URL(hrefs.customersHref!, 'http://admin.local');
    const partnersUrl = new URL(hrefs.partnersHref!, 'http://admin.local');

    expect(activityStreamUrl.searchParams.get('range')).toBe('30d');
    expect(activityStreamUrl.searchParams.get('age')).toBe('all');
    expect(activityStreamUrl.searchParams.get('backlog')).toBe('all');
    expect(activityStreamUrl.searchParams.get('review')).toBe('all');
    expect(activityStreamUrl.searchParams.get('page')).toBe('7');
    expect(activityStreamUrl.searchParams.get('pageSize')).toBe('3');
    expect(activityStreamUrl.searchParams.get('reason')).toBe('all');
    expect(activityStreamUrl.searchParams.get('sort')).toBe('newest');
    expect(activityStreamUrl.searchParams.get('source')).toBe('notification');
    expect(bookingHistoryUrl.searchParams.get('dateRange')).toBe('30d');
    expect(bookingHistoryUrl.searchParams.get('page')).toBe('4');
    expect(bookingHistoryUrl.searchParams.get('pageSize')).toBe('3');
    expect(customersUrl.searchParams.get('skip')).toBe('12');
    expect(customersUrl.searchParams.get('take')).toBe('3');
    expect(partnersUrl.searchParams.get('skip')).toBe('15');
    expect(partnersUrl.searchParams.get('take')).toBe('3');
  });

  it('requests only the selected Finance closeout page from the API', () => {
    const hrefs = buildOperationsHandoffDataHrefs({
      details: 'all',
      financePage: '4',
      range: '30d',
    });
    const financeCloseoutEarningsUrl = new URL(
      hrefs.financeCloseoutEarningsHref!,
      'http://admin.local',
    );

    expect(financeCloseoutEarningsUrl.searchParams.get('range')).toBe('30d');
    expect(financeCloseoutEarningsUrl.searchParams.get('review')).toBe('closeout-review');
    expect(financeCloseoutEarningsUrl.searchParams.get('skip')).toBe('9');
    expect(financeCloseoutEarningsUrl.searchParams.get('take')).toBe('3');
  });

  it('keeps selected handoff range on bounded list requests', () => {
    const hrefs = buildOperationsHandoffDataHrefs({ range: '7d' });
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const payoutBatchesUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingsUrl.searchParams.get('dateRange')).toBe('7d');
    expect(hrefs.activityStreamHref).toBeNull();
    expect(paymentsUrl.searchParams.get('range')).toBe('7d');
    expect(paymentsUrl.searchParams.get('take')).toBe('5');
    expect(hrefs.cashSettlementSummaryHref).toBe('/admin/cash-settlement-summary?range=7d');
    expect(hrefs.notificationsHref).toBeNull();
    expect(hrefs.notificationSummaryHref).toContain('/admin/notifications/summary?');
    expect(payoutBatchesUrl.searchParams.get('range')).toBe('7d');
    expect(payoutBatchesUrl.searchParams.get('take')).toBe('5');
    expect(payoutBatchesUrl.searchParams.get('review')).toBe('needs-review');
  });

  it('prefers notification summary failed counts over bounded notification samples', () => {
    expect(
      buildOperationsHandoffFailedNotificationCount([failedNotification()], {
        failed: 2400,
      }),
    ).toBe(2400);

    expect(buildOperationsHandoffFailedNotificationCount([failedNotification()], null)).toBe(1);
  });

  it('filters range-owned finance and audit inputs consistently', () => {
    const currentCreatedAt = new Date().toISOString();
    const oldCreatedAt = '2026-01-01T00:00:00.000Z';
    const data = buildOperationsHandoffRangeData(
      {
        auditLogs: [
          auditLog({ createdAt: currentCreatedAt, id: 'audit-current' }),
          auditLog({ createdAt: oldCreatedAt, id: 'audit-old' }),
        ],
        earnings: [
          earning({ createdAt: currentCreatedAt, id: 'earning-current' }),
          earning({ createdAt: oldCreatedAt, id: 'earning-old' }),
        ],
        payments: [
          payment({ booking: { createdAt: currentCreatedAt }, id: 'payment-current' }),
          payment({ booking: { createdAt: oldCreatedAt }, id: 'payment-old' }),
        ],
        payouts: [
          payout({ createdAt: currentCreatedAt, id: 'payout-current' }),
          payout({ createdAt: oldCreatedAt, id: 'payout-old' }),
        ],
        refunds: [
          refund({ createdAt: currentCreatedAt, id: 'refund-current' }),
          refund({ createdAt: oldCreatedAt, id: 'refund-old' }),
        ],
      },
      '30d',
    );

    expect(data.rangeAuditLogs.map((row) => row.id)).toEqual(['audit-current']);
    expect(data.rangeEarnings.map((row) => row.id)).toEqual(['earning-current']);
    expect(data.rangePayments.map((row) => row.id)).toEqual(['payment-current']);
    expect(data.rangePayouts.map((row) => row.id)).toEqual(['payout-current']);
    expect(data.rangeRefunds.map((row) => row.id)).toEqual(['refund-current']);
  });

  it('builds activity CSV data hrefs for page sections', () => {
    const csvHref = buildActivityStreamCsvHref([
      {
        area: 'Booking',
        className: 'pill',
        createdAt: '2026-06-14T01:00:00.000Z',
        href: '/bookings/booking-1',
        id: 'activity-1',
        record: 'booking-1',
        reviewReason: 'Booking movement needs payment, Partner, and customer follow-up context.',
        source: 'MATCHED',
        summary: 'Customer / Partner / payment',
      },
    ]);

    expect(decodeURIComponent(csvHref)).toContain('Customer / Partner / payment');
    expect(decodeURIComponent(csvHref)).toContain('review_reason');
    expect(decodeURIComponent(csvHref)).toContain(
      'Booking movement needs payment, Partner, and customer follow-up context.',
    );
  });

  it('links notification audit activity rows to filtered notification audit evidence', () => {
    const href = relatedHref({
      action: 'notification.retry',
      actor: { fullName: 'Demo Admin' },
      createdAt: '2026-06-14T00:59:12.344Z',
      id: 'audit-1',
      metadata: { notificationId: 'notification-123' },
      target: 'notification:notification-123',
    });

    expect(href).toBe('/audit-log?bucket=Notification&q=notification-123&range=all');
  });

  it('labels notification audit activity separately from generic ops notes', () => {
    expect(
      auditActivityArea({
        action: 'notification.retry',
        createdAt: '2026-06-14T00:59:12.344Z',
        id: 'audit-1',
        target: 'notification:notification-123',
      }),
    ).toBe('Notification audit');

    expect(
      auditActivityArea({
        action: 'operations.handoff_note.add',
        createdAt: '2026-06-14T00:59:12.344Z',
        id: 'audit-2',
        target: 'operations:handoff',
      }),
    ).toBe('Ops note');
  });

  it('keeps booking audit rows linked to the booking detail first', () => {
    const href = relatedHref({
      action: 'notification.retry',
      createdAt: '2026-06-14T00:59:12.344Z',
      id: 'audit-1',
      metadata: { bookingId: 'booking-123', notificationId: 'notification-123' },
      target: 'notification:notification-123',
    });

    expect(href).toBe('/bookings/booking-123');
  });
});

function auditLog(input: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'operations.handoff_note.add',
    createdAt: '2026-06-14T00:00:00.000Z',
    id: 'audit-1',
    target: 'operations:handoff',
    ...input,
  };
}

function earning(input: Partial<AdminEarning>): AdminEarning {
  return {
    bookingId: 'booking-1',
    createdAt: '2026-06-14T00:00:00.000Z',
    currency: 'VND',
    grossAmount: 150000,
    id: 'earning-1',
    netAmount: 120000,
    platformFee: 20000,
    providerProfileId: 'partner-1',
    status: 'PAID',
    withholdingAmount: 10000,
    ...input,
  };
}

function payment(input: Partial<AdminPayment>): AdminPayment {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    currency: 'VND',
    id: 'payment-1',
    method: 'MOMO',
    status: 'CAPTURED',
    ...input,
  };
}

function payout(input: Partial<AdminPayoutBatch>): AdminPayoutBatch {
  return {
    createdAt: '2026-06-14T00:00:00.000Z',
    currency: 'VND',
    id: 'payout-1',
    providerProfileId: 'partner-1',
    status: 'PAID',
    totalNetAmount: 100000,
    ...input,
  };
}

function refund(input: Partial<AdminRefund>): AdminRefund {
  return {
    amount: 100000,
    bookingId: 'booking-1',
    createdAt: '2026-06-14T00:00:00.000Z',
    id: 'refund-1',
    paymentId: 'payment-1',
    status: 'COMPLETED',
    ...input,
  };
}

function failedNotification() {
  return {
    body: 'Failed body',
    createdAt: '2026-06-14T00:00:00.000Z',
    deliveries: [{ attemptedAt: '2026-06-14T00:00:00.000Z', provider: 'FCM', status: 'FAILED' }],
    id: 'notification-failed',
    title: 'Failed title',
    type: 'BOOKING',
  };
}
