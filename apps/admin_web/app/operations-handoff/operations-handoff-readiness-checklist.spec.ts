import type { AdminBooking, AdminCashSettlementSummary, AdminNotification } from '../../lib/admin-api';
import {
  buildHandoffReadinessChecklist,
  countOpenHandoffChecklistItems,
} from './operations-handoff-readiness-checklist';

describe('operations handoff readiness checklist model', () => {
  it('builds checklist counts and Partner-facing labels from operational signals', () => {
    const nowMs = Date.parse('2026-06-14T10:00:00.000Z');
    const rows = buildHandoffReadinessChecklist(
      {
        bookings: [
          booking({ status: 'MATCHED', chatRoom: null }),
          booking({ status: 'COMPLETED', chatRoom: null, earning: null, payment: null }),
        ],
        matchingBookings: [booking({ status: 'OPEN_MATCHING' })],
        inServiceBookings: [booking({ status: 'IN_SERVICE' })],
        failedNotifications: [notification()],
        cashSummary: cashSummary({ providerCount: 2 }),
        partnerSignals: { attentionCount: 3 },
        customerSignals: [{ id: 'customer-1' }],
        operatorNotes: [{ actor: 'Ops Lead', createdAt: '2026-06-14T09:55:00.000Z' }],
      },
      { nowMs },
    );

    expect(rowById(rows, 'chat-continuity-reviewed')).toMatchObject({
      count: 1,
      countLabel: '1 missing',
      badgeClass: 'pill pill-danger',
    });
    expect(rowById(rows, 'cash-settlement-reviewed')).toMatchObject({
      count: 2,
      countLabel: '2 Partners',
      badgeClass: 'pill pill-danger',
    });
    expect(rowById(rows, 'partner-facts-reviewed')).toMatchObject({
      count: 3,
      countLabel: '3 facts',
      badgeClass: 'pill pill-warn',
    });
    expect(rowById(rows, 'handoff-note-written')).toMatchObject({
      count: 1,
      countLabel: 'fresh note',
      badgeClass: 'pill pill-success',
    });
    expect(countOpenHandoffChecklistItems(rows)).toBe(8);
  });

  it('sorts danger rows before warning, info, and ready rows', () => {
    const rows = buildHandoffReadinessChecklist({
      bookings: [booking({ status: 'MATCHED', chatRoom: null })],
      matchingBookings: [booking({ status: 'OPEN_MATCHING' })],
      inServiceBookings: [booking({ status: 'IN_SERVICE' })],
      failedNotifications: [],
      cashSummary: cashSummary({ providerCount: 0 }),
      partnerSignals: { attentionCount: 0 },
      customerSignals: [],
      operatorNotes: [],
    });

    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
      'chat-continuity-reviewed',
      'live-matching-reviewed',
      'handoff-note-written',
    ]);
  });

  it('uses server notification summary count instead of bounded failed notification samples', () => {
    const rows = buildHandoffReadinessChecklist({
      bookings: [],
      matchingBookings: [],
      inServiceBookings: [],
      failedNotificationCount: 42,
      failedNotifications: [],
      cashSummary: cashSummary({ providerCount: 0 }),
      partnerSignals: { attentionCount: 0 },
      customerSignals: [],
      operatorNotes: [],
    });

    expect(rowById(rows, 'failed-alerts-reviewed')).toMatchObject({
      count: 42,
      countLabel: '42 failed',
      badgeClass: 'pill pill-warn',
    });
  });
});

function rowById(rows: ReturnType<typeof buildHandoffReadinessChecklist>, id: string) {
  const row = rows.find((item) => item.id === id);
  expect(row).toBeDefined();
  return row;
}

function booking(input: Partial<AdminBooking>): AdminBooking {
  return {
    chatRoom: { id: 'chat-1' },
    earning: { id: 'earning-1' },
    payment: { id: 'payment-1' },
    status: 'MATCHED',
    ...input,
  } as AdminBooking;
}

function notification(): AdminNotification {
  return { id: 'notification-1' } as AdminNotification;
}

function cashSummary(input: Partial<AdminCashSettlementSummary>): AdminCashSettlementSummary {
  return {
    providerCount: 0,
    ...input,
  } as AdminCashSettlementSummary;
}
