import type {
  AdminAuditLog,
  AdminBooking,
  AdminChatArchiveBooking,
  AdminNotification,
} from '../../lib/admin-api';
import { buildUnifiedActivityStream, filterActivityStreamByRange } from './operations-handoff-activity-stream';

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
      href: '/cash-settlements',
      reviewReason: 'Negative wallet effect needs cash settlement or Partner receivable review.',
    });
    expect(rows.find((row) => row.id === 'notification-notification-1')).toMatchObject({
      area: 'Notification',
      href: '/notifications?review=failed',
      reviewReason: 'Failed delivery can hide booking, payment, or status updates from users.',
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
