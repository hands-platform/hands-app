import type {
  AdminAuditLog,
  AdminBooking,
  AdminChatArchiveBooking,
  AdminNotification,
  AdminOperationsHandoffActivityEvent,
} from '../../lib/admin-api';
import {
  buildUnifiedActivityPageRows,
  buildUnifiedActivityStream,
  filterActivityStreamByRange,
} from './operations-handoff-activity-stream';

describe('operations handoff activity stream', () => {
  it('builds a chronological stream across booking, chat, audit, notification, and finance rows', () => {
    const rows = buildUnifiedActivityStream({
      bookings: [
        booking({
          createdAt: '2026-06-14T07:55:00.000Z',
          id: 'booking-1',
          updatedAt: '2026-06-14T08:00:00.000Z',
        }),
        booking({ createdAt: '', id: 'missing-date', updatedAt: undefined }),
      ],
      chatArchive: [
        chatBooking({
          chatRoom: {
            id: 'chat-room-1',
            messages: [
              {
                body: 'Customer confirmed lobby pickup',
                createdAt: '2026-06-14T08:10:00.000Z',
                id: 'message-1',
                sender: { fullName: 'Customer Linh', id: 'customer-1', roles: ['CUSTOMER'] },
              },
            ],
          },
          id: 'booking-chat',
        }),
      ],
      auditLogs: [
        auditLog({
          action: 'operations.handoff_note.add',
          createdAt: '2026-06-14T08:20:00.000Z',
          id: 'audit-1',
          metadata: { note: 'Shift note ready' },
          target: 'operations:handoff',
        }),
      ],
      notifications: [
        notification({
          createdAt: '2026-06-14T08:30:00.000Z',
          deliveries: [
            { attemptedAt: '2026-06-14T08:30:00.000Z', provider: 'FCM', status: 'FAILED' },
          ],
          id: 'notification-1',
        }),
        notification({
          createdAt: '2026-06-14T08:35:00.000Z',
          deliveries: [
            { attemptedAt: '2026-06-14T08:35:00.000Z', provider: 'FCM', status: 'SENT' },
          ],
          id: 'notification-sent',
        }),
      ],
      financeRows: [
        {
          bookingId: 'booking-finance',
          createdAt: '2026-06-14T08:40:00.000Z',
          currency: 'VND',
          id: 'earning-1',
          netAmount: -15000,
          partnerName: 'Partner Mai',
          platformFee: 30000,
          status: 'OPEN',
          statusClass: 'pill pill-danger',
        },
      ],
    });

    expect(rows.map((row) => row.id)).toEqual([
      'finance-earning-1',
      'notification-notification-1',
      'audit-audit-1',
      'chat-message-1',
      'booking-booking-1',
    ]);
    expect(rows.find((row) => row.id === 'finance-earning-1')).toMatchObject({
      area: 'Finance',
      href: '/cash-settlements?q=booking-finance&range=all&sort=oldest',
      reviewReason: 'Negative wallet effect needs cash settlement or Partner receivable review.',
    });
    expect(rows.find((row) => row.id === 'notification-notification-1')).toMatchObject({
      area: 'Notification',
      href: '/notifications?review=failed',
      reviewReason: 'Retry the unresolved delivery or replace the still-active device token.',
    });
    expect(rows.find((row) => row.id === 'audit-audit-1')).toMatchObject({
      reviewReason: 'Operator note or audit event for the next handoff review.',
    });
    expect(rows.find((row) => row.id === 'chat-message-1')).toMatchObject({
      reviewReason: 'Retained chat evidence may explain customer, Partner, or dispute context.',
    });
    expect(rows.find((row) => row.id === 'booking-booking-1')).toMatchObject({
      reviewReason: 'Booking movement needs payment, Partner, and customer follow-up context.',
    });
    expect(rows.find((row) => row.id === 'notification-notification-sent')).toBeUndefined();
    expect(rows.find((row) => row.id === 'booking-missing-date')).toBeUndefined();
  });

  it('filters out rows without a usable timestamp when applying the handoff range', () => {
    const rows = [
      activityRow({ createdAt: '2026-06-14T08:00:00.000Z', id: 'with-time' }),
      activityRow({ createdAt: null, id: 'without-time' }),
    ];

    expect(filterActivityStreamByRange(rows, 'all').map((row) => row.id)).toEqual(['with-time']);
  });

  it('preserves server-selected event order and row contracts for an activity page', () => {
    const events: AdminOperationsHandoffActivityEvent[] = [
      {
        id: 'message-1',
        kind: 'CHAT',
        occurredAt: '2026-06-14T08:30:00.000Z',
        reason: 'RECORD',
        message: {
          body: 'Customer confirmed lobby pickup',
          chatRoom: { bookingId: 'booking-chat', id: 'chat-room-1' },
          createdAt: '2026-06-14T08:30:00.000Z',
          id: 'message-1',
          sender: { fullName: 'Customer Linh', id: 'customer-1', roles: ['CUSTOMER'] },
        },
      },
      {
        auditLog: auditLog({
          createdAt: '2026-06-14T08:20:00.000Z',
          id: 'audit-1',
          metadata: { note: 'Shift note ready' },
        }),
        id: 'audit-1',
        kind: 'AUDIT',
        occurredAt: '2026-06-14T08:20:00.000Z',
        reason: 'RECORD',
      },
      {
        booking: booking({
          id: 'booking-1',
          updatedAt: '2026-06-14T08:10:00.000Z',
        }),
        id: 'booking-1',
        kind: 'BOOKING',
        occurredAt: '2026-06-14T08:10:00.000Z',
        reason: 'MISSING_SETTLEMENT',
      },
    ];

    const rows = buildUnifiedActivityPageRows(events);
    expect(rows.map((row) => row.id)).toEqual([
      'chat-message-1',
      'audit-audit-1',
      'booking-booking-1',
    ]);
    expect(rows.at(-1)?.reviewReason).toBe(
      'Reconstruct the missing Partner earning, settlement snapshot, and GL evidence.',
    );
    expect(rows.at(-1)?.href).toBe(
      '/finance-closeout?q=booking-1&settlementAge=7d-plus&settlementPage=1&settlementTrack=all&view=settlement',
    );
  });

  it('keeps priority-selected payment rows in server order and gives a concrete next action', () => {
    const events: AdminOperationsHandoffActivityEvent[] = [
      {
        booking: booking({
          id: 'oldest-authorization',
          payment: {
            amount: 300000,
            currency: 'VND',
            method: 'MOMO',
            status: 'AUTHORIZED',
          },
          status: 'EXPIRED',
          updatedAt: '2026-06-01T08:00:00.000Z',
        }),
        id: 'oldest-authorization',
        kind: 'BOOKING',
        occurredAt: '2026-06-01T08:00:00.000Z',
        reason: 'PAYMENT',
      },
      {
        booking: booking({
          id: 'captured-without-refund',
          payment: {
            amount: 400000,
            currency: 'VND',
            method: 'MOMO',
            status: 'CAPTURED',
          },
          refunds: [],
          status: 'EXPIRED',
          updatedAt: '2026-06-02T08:00:00.000Z',
        }),
        id: 'captured-without-refund',
        kind: 'BOOKING',
        occurredAt: '2026-06-02T08:00:00.000Z',
        reason: 'PAYMENT',
      },
    ];

    const rows = buildUnifiedActivityPageRows(events);

    expect(rows.map((row) => row.id)).toEqual([
      'booking-oldest-authorization',
      'booking-captured-without-refund',
    ]);
    expect(rows[0]?.reviewReason).toBe(
      'Release the stale authorization or confirm that the gateway hold has expired.',
    );
    expect(rows[1]?.reviewReason).toBe(
      'Create and complete a refund for this captured payment.',
    );
  });

  it('gives overdue active booking stages a concrete operational action', () => {
    const events: AdminOperationsHandoffActivityEvent[] = [
      {
        booking: booking({
          id: 'stale-open-booking',
          status: 'OPEN_MATCHING',
          updatedAt: '2026-06-01T08:00:00.000Z',
        }),
        id: 'stale-open-booking',
        kind: 'BOOKING',
        occurredAt: '2026-06-01T08:00:00.000Z',
        reason: 'BOOKING_STATE',
      },
      {
        booking: booking({
          id: 'stale-service-booking',
          status: 'IN_SERVICE',
          updatedAt: '2026-06-02T08:00:00.000Z',
        }),
        id: 'stale-service-booking',
        kind: 'BOOKING',
        occurredAt: '2026-06-02T08:00:00.000Z',
        reason: 'BOOKING_STATE',
      },
    ];

    const rows = buildUnifiedActivityPageRows(events);

    expect(rows[0]?.reviewReason).toBe('Rematch or expire this overdue open request.');
    expect(rows[1]?.reviewReason).toBe(
      'Confirm service completion, cancellation, or no-show outcome.',
    );
  });

  it('routes paid historical settlement gaps to the governed finance repair queue', () => {
    const events: AdminOperationsHandoffActivityEvent[] = [
      {
        booking: booking({
          earning: {
            availableAt: null,
            bookingId: 'historical-gap',
            createdAt: '2026-06-01T08:00:00.000Z',
            currency: 'VND',
            grossAmount: 400000,
            id: 'earning-historical-gap',
            netAmount: 320000,
            platformFee: 80000,
            providerProfileId: 'partner-1',
            status: 'PAID',
            withholdingAmount: 0,
          },
          id: 'historical-gap',
          status: 'COMPLETED',
          updatedAt: '2026-06-01T08:00:00.000Z',
        }),
        id: 'historical-gap',
        kind: 'BOOKING',
        occurredAt: '2026-06-01T08:00:00.000Z',
        reason: 'MISSING_SETTLEMENT',
      },
    ];

    const [row] = buildUnifiedActivityPageRows(events);

    expect(row).toMatchObject({
      href: '/finance-closeout?q=historical-gap&settlementAge=7d-plus&settlementPage=1&settlementTrack=all&view=settlement',
      reviewReason:
        'Reconstruct the historical settlement snapshot and GL from retained paid earning evidence.',
    });
  });

  it('routes open cash debt and overdue positive earnings to their action queues', () => {
    const events: AdminOperationsHandoffActivityEvent[] = [
      {
        earning: {
          bookingId: 'cash-debt-booking',
          createdAt: '2026-06-01T08:00:00.000Z',
          currency: 'VND',
          grossAmount: 300000,
          id: 'cash-debt-earning',
          netAmount: -60000,
          platformFee: 60000,
          providerProfileId: 'partner-1',
          status: 'PENDING',
          withholdingAmount: 0,
        },
        id: 'cash-debt-earning',
        kind: 'FINANCE',
        occurredAt: '2026-06-01T08:00:00.000Z',
        reason: 'FINANCE_UNPAID',
      },
      {
        earning: {
          bookingId: 'positive-earning-booking',
          createdAt: '2026-06-02T08:00:00.000Z',
          currency: 'VND',
          grossAmount: 400000,
          id: 'positive-earning',
          netAmount: 320000,
          platformFee: 80000,
          providerProfileId: 'partner-2',
          status: 'PENDING',
          withholdingAmount: 0,
        },
        id: 'positive-earning',
        kind: 'FINANCE',
        occurredAt: '2026-06-02T08:00:00.000Z',
        reason: 'FINANCE_UNPAID',
      },
    ];

    const rows = buildUnifiedActivityPageRows(events);

    expect(rows[0]).toMatchObject({
      href: '/cash-settlements?q=cash-debt-booking&range=all&sort=oldest',
      reviewReason: 'Recover the Partner cash debt or record approved deposit or offset evidence.',
    });
    expect(rows[1]).toMatchObject({
      href: '/payouts?range=all',
      reviewReason: 'Release the overdue positive earning or resolve its stuck payout batch.',
    });
  });
});

type ActivityRow = ReturnType<typeof buildUnifiedActivityStream>[number];

function activityRow(input: Partial<ActivityRow>): ActivityRow {
  return {
    area: 'Booking',
    className: 'pill',
    createdAt: '2026-06-14T08:00:00.000Z',
    href: '/bookings/booking-1',
    id: 'activity-1',
    record: 'booking-1',
    reviewReason: 'Booking movement needs payment, Partner, and customer follow-up context.',
    source: 'MATCHED',
    summary: 'Activity row',
    ...input,
  };
}

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    chatRoom: { id: 'chat-1' },
    createdAt: '2026-06-14T07:00:00.000Z',
    customerProfile: { user: { fullName: 'Customer Linh' } },
    id: 'booking-1',
    payment: {
      amount: 100000,
      currency: 'VND',
      method: 'CASH',
      status: 'AUTHORIZED',
    },
    preferredProvider: { displayName: 'Partner Mai' },
    status: 'MATCHED',
    updatedAt: '2026-06-14T07:30:00.000Z',
    ...input,
  } as AdminBooking;
}

function chatBooking(input: Partial<AdminChatArchiveBooking>): AdminChatArchiveBooking {
  return {
    chatRoom: null,
    id: 'booking-chat',
    ...input,
  } as AdminChatArchiveBooking;
}

function auditLog(input: Partial<AdminAuditLog>): AdminAuditLog {
  return {
    action: 'operations.handoff_note.add',
    createdAt: '2026-06-14T08:20:00.000Z',
    id: 'audit-1',
    target: 'operations:handoff',
    ...input,
  } as AdminAuditLog;
}

function notification(input: Partial<AdminNotification>): AdminNotification {
  return {
    body: 'Partner booking update',
    createdAt: '2026-06-14T08:30:00.000Z',
    deliveries: [],
    id: 'notification-1',
    title: 'Booking update',
    type: 'PUSH',
    ...input,
  } as AdminNotification;
}
