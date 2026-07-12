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
} from './operations-handoff-page-model';

describe('operations handoff page model', () => {
  it('normalizes filters and provides a complete empty cash settlement fallback', () => {
    expect(buildOperationsHandoffFilters({})).toEqual({ detailsMode: 'summary', range: '7d' });
    expect(buildOperationsHandoffFilters({ range: ['7d'] })).toEqual({
      detailsMode: 'summary',
      range: '7d',
    });
    expect(buildOperationsHandoffFilters({ range: 'unsupported' })).toEqual({
      detailsMode: 'summary',
      range: 'today',
    });
    expect(buildOperationsHandoffFilters({ details: 'all' })).toEqual({
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
  });

  it('keeps default operations history requests bounded and scoped to the last 7 days', () => {
    const hrefs = buildOperationsHandoffDataHrefs({});
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const auditUrl = new URL(hrefs.auditLogsHref, 'http://admin.local');
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const earningsUrl = new URL(hrefs.earningsHref, 'http://admin.local');
    const refundsUrl = new URL(hrefs.refundsHref, 'http://admin.local');
    const payoutBatchesUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingsUrl.pathname).toBe('/admin/bookings');
    expect(bookingsUrl.searchParams.get('dateRange')).toBe('7d');
    expect(bookingsUrl.searchParams.get('take')).toBe('10');
    expect('appSessionsHref' in hrefs).toBe(false);
    expect('appSessionSummaryHref' in hrefs).toBe(false);
    expect(hrefs.chatArchiveHref).toBeNull();
    expect(hrefs.customersHref).toBeNull();
    expect(hrefs.partnersHref).toBeNull();
    expect(paymentsUrl.searchParams.get('range')).toBe('7d');
    expect(paymentsUrl.searchParams.get('take')).toBe('5');
    expect(earningsUrl.searchParams.get('range')).toBe('7d');
    expect(earningsUrl.searchParams.get('take')).toBe('5');
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
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(auditUrl.searchParams.get('to') ?? ''))).toBe(true);
  });

  it('keeps retained chat archive behind full handoff details', () => {
    const hrefs = buildOperationsHandoffDataHrefs({ details: 'all', range: '7d' });
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const chatArchiveUrl = new URL(hrefs.chatArchiveHref!, 'http://admin.local');
    const customersUrl = new URL(hrefs.customersHref!, 'http://admin.local');
    const notificationsUrl = new URL(hrefs.notificationsHref!, 'http://admin.local');
    const partnersUrl = new URL(hrefs.partnersHref!, 'http://admin.local');
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');

    expect(bookingsUrl.searchParams.get('take')).toBe('50');
    expect('appSessionsHref' in hrefs).toBe(false);
    expect('appSessionSummaryHref' in hrefs).toBe(false);
    expect(chatArchiveUrl.pathname).toBe('/admin/chat-archive');
    expect(chatArchiveUrl.searchParams.get('dateRange')).toBe('7d');
    expect(chatArchiveUrl.searchParams.get('take')).toBe('50');
    expect(customersUrl.pathname).toBe('/admin/customers');
    expect(customersUrl.searchParams.get('take')).toBe('50');
    expect(notificationsUrl.pathname).toBe('/admin/notifications');
    expect(notificationsUrl.searchParams.get('take')).toBe('50');
    expect(partnersUrl.pathname).toBe('/admin/operations-handoff/providers');
    expect(partnersUrl.searchParams.get('take')).toBe('50');
    expect(paymentsUrl.searchParams.get('take')).toBe('50');
  });

  it('keeps selected handoff range on bounded list requests', () => {
    const hrefs = buildOperationsHandoffDataHrefs({ range: '7d' });
    const bookingsUrl = new URL(hrefs.bookingsHref, 'http://admin.local');
    const paymentsUrl = new URL(hrefs.paymentsHref, 'http://admin.local');
    const payoutBatchesUrl = new URL(hrefs.payoutBatchesHref, 'http://admin.local');

    expect(bookingsUrl.searchParams.get('dateRange')).toBe('7d');
    expect(hrefs.chatArchiveHref).toBeNull();
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
        source: 'MATCHED',
        summary: 'Customer / Partner / payment',
      },
    ]);

    expect(decodeURIComponent(csvHref)).toContain('Customer / Partner / payment');
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
