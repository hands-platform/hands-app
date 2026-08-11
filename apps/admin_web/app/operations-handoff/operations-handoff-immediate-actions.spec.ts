import type { AdminBooking, AdminCashSettlementSummary, AdminNotification } from '../../lib/admin-api';
import { buildImmediateActionQueue } from './operations-handoff-immediate-actions';

describe('operations handoff immediate action model', () => {
  it('builds queue counts from booking, finance, alert, and Partner signals', () => {
    const nowMs = Date.parse('2026-06-14T10:00:00.000Z');
    const rows = buildImmediateActionQueue(
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
        operatorNotes: [
          { createdAt: '2026-06-14T09:45:00.000Z' },
          { createdAt: '2026-06-14T01:00:00.000Z' },
        ],
      },
      { nowMs },
    );

    expect(rowById(rows, 'chat-creation')).toMatchObject({
      count: 1,
      countLabel: '1 missing chat',
      statusClass: 'pill pill-danger',
    });
    expect(rowById(rows, 'cash-fee-debt')).toMatchObject({
      count: 2,
      countLabel: '2 Partners',
      detail:
        'Partners with negative wallet from cash bookings can stay visible, but final acceptance, service start, and payout release wait for settlement.',
      nextAction:
        'Open cash settlements and record deposit or offset before final acceptance, service start, or payout release.',
      statusClass: 'pill pill-danger',
    });
    expect(rowById(rows, 'partner-admin-facts')).toMatchObject({
      count: 3,
      countLabel: '3 Partner facts',
      statusClass: 'pill pill-warn',
    });
    expect(rowById(rows, 'recent-operator-notes')).toMatchObject({
      count: 1,
      owner: 'History',
      statusClass: 'pill pill-info',
    });
  });

  it('sorts urgent rows ahead of warning, info, and clear rows', () => {
    const rows = buildImmediateActionQueue({
      bookings: [booking({ status: 'MATCHED', chatRoom: null })],
      matchingBookings: [booking({ status: 'OPEN_MATCHING' })],
      inServiceBookings: [booking({ status: 'IN_SERVICE' })],
      failedNotifications: [],
      cashSummary: cashSummary({ providerCount: 0 }),
      partnerSignals: { attentionCount: 0 },
      operatorNotes: [],
    });

    expect(rows.slice(0, 3).map((row) => row.id)).toEqual([
      'chat-creation',
      'matching-live-window',
      'in-service-watch',
    ]);
  });

  it('uses exact server counts and oldest timestamps instead of bounded list samples', () => {
    const rows = buildImmediateActionQueue({
      bookings: [],
      bookingSummary: {
        chatMissingCount: 9,
        matchingNow: 23,
        oldestChatMissingAt: '2026-06-13T08:00:00.000Z',
        oldestMatchingAt: '2026-06-14T08:00:00.000Z',
        serviceInProgress: 41,
      },
      completedBookingSummary: {
        closeoutChecks: 31,
        oldestCloseoutAt: '2026-06-11T08:00:00.000Z',
      },
      matchingBookings: [],
      inServiceBookings: [],
      failedNotificationCount: 27,
      failedNotifications: [],
      notificationSummary: { oldestFailedAt: '2026-06-12T08:00:00.000Z' },
      cashSummary: cashSummary({ providerCount: 0 }),
      partnerSignals: { attentionCount: 0 },
      operatorNoteCount: 18,
      operatorNotes: [],
    });

    expect(rowById(rows, 'matching-live-window')).toMatchObject({
      count: 23,
      oldestOpenAt: '2026-06-14T08:00:00.000Z',
    });
    expect(rowById(rows, 'chat-creation')).toMatchObject({
      count: 9,
      oldestOpenAt: '2026-06-13T08:00:00.000Z',
    });
    expect(rowById(rows, 'notification-delivery')).toMatchObject({
      count: 27,
      countLabel: '27 failed',
      oldestOpenAt: '2026-06-12T08:00:00.000Z',
      statusClass: 'pill pill-warn',
    });
    expect(rowById(rows, 'completed-closeout')).toMatchObject({
      count: 31,
      oldestOpenAt: '2026-06-11T08:00:00.000Z',
    });
    expect(rowById(rows, 'in-service-watch')).toMatchObject({
      count: 41,
      countLabel: '41 active',
      title: 'Active service handoffs',
    });
    expect(rowById(rows, 'recent-operator-notes')).toMatchObject({
      count: 18,
      countLabel: '18 recent notes',
    });
  });
});

function rowById(rows: ReturnType<typeof buildImmediateActionQueue>, id: string) {
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
