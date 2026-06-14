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
  buildLatestFcmSentSummary,
  buildOperationsHandoffFilters,
  buildOperationsHandoffRangeData,
  emptyCashSettlementSummary,
} from './operations-handoff-page-model';

describe('operations handoff page model', () => {
  it('normalizes filters and provides a complete empty cash settlement fallback', () => {
    expect(buildOperationsHandoffFilters({ range: ['7d'] })).toEqual({ range: '7d' });
    expect(buildOperationsHandoffFilters({ range: 'unsupported' })).toEqual({ range: 'all' });
    expect(emptyCashSettlementSummary()).toMatchObject({
      cashPaymentRowCount: 0,
      currency: 'VND',
      providerCount: 0,
      topProviderGroups: [],
      totalDebtAmount: 0,
    });
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

  it('builds FCM summary and activity CSV data hrefs for page sections', () => {
    const fcmSummary = buildLatestFcmSentSummary([
      {
        body: 'Body',
        createdAt: '2026-06-14T00:00:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-14T01:00:00.000Z',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'push-device-1',
              platform: 'ios',
              role: 'CUSTOMER',
            },
            status: 'SENT',
          },
        ],
        id: 'notification-1',
        title: 'Title',
        type: 'BOOKING',
        user: {
          phone: '+84900000001',
          providerProfile: null,
          roles: ['CUSTOMER'],
        },
      },
    ]);
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

    expect(fcmSummary?.helper).toContain('Customer +84900000001 / ios');
    expect(fcmSummary?.helper).toContain('device push-dev');
    expect(fcmSummary?.value).toContain('14 Jun 2026');
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
