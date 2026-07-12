import type { AdminBooking, AdminCashSettlementSummary, AdminNotification } from '../../lib/admin-api';
import {
  bookingsMissingChatHandoffEvidence,
  bookingsMissingCloseoutEvidence,
} from './operations-handoff-booking-evidence';

type PartnerSignalSummary = {
  readonly attentionCount: number;
};

type OperatorNoteSummary = {
  readonly createdAt?: string | null;
};

type ImmediateActionQueueOptions = {
  readonly nowMs?: number;
};

type ImmediateActionQueueInput = {
  readonly bookings: readonly AdminBooking[];
  readonly matchingBookings: readonly AdminBooking[];
  readonly inServiceBookings: readonly AdminBooking[];
  readonly failedNotificationCount?: number;
  readonly failedNotifications: readonly AdminNotification[];
  readonly cashSummary: AdminCashSettlementSummary;
  readonly partnerSignals: PartnerSignalSummary;
  readonly operatorNotes: readonly OperatorNoteSummary[];
};

export function buildImmediateActionQueue(
  input: ImmediateActionQueueInput,
  options: ImmediateActionQueueOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const chatMissing = bookingsMissingChatHandoffEvidence(input.bookings);
  const closeoutRows = bookingsMissingCloseoutEvidence(input.bookings);
  const failedNotificationCount = input.failedNotificationCount ?? input.failedNotifications.length;
  const recentNotes = input.operatorNotes.filter((note) =>
    recentlyChangedWithin(note.createdAt, nowMs, 240),
  );

  const rows = [
    {
      id: 'matching-live-window',
      owner: 'Dispatch',
      title: 'Open matching windows',
      detail:
        'Customers are waiting while first-pick and nearby Partner participation windows are still open.',
      href: '/bookings?view=matching',
      count: input.matchingBookings.length,
      countLabel: `${input.matchingBookings.length} booking(s)`,
      status: input.matchingBookings.length ? 'Monitor now' : 'Clear',
      nextAction:
        'Open the matching board and check Partner response, participant list, and customer choice.',
      className: input.matchingBookings.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: input.matchingBookings.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'chat-creation',
      owner: 'Support',
      title: 'Matched booking chat',
      detail: 'A matched or in-service booking should have an admin-retained chat room.',
      href: '/bookings?view=chat-repair',
      count: chatMissing.length,
      countLabel: `${chatMissing.length} missing chat`,
      status: chatMissing.length ? 'Repair' : 'Ready',
      nextAction: 'Open chat repair queue if any matched booking has no chat room.',
      className: chatMissing.length ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: chatMissing.length ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'in-service-watch',
      owner: 'Dispatch',
      title: 'Services in progress',
      detail: 'Partner and customer are inside the work window; chat remains active until completion.',
      href: '/bookings?view=closeout',
      count: input.inServiceBookings.length,
      countLabel: `${input.inServiceBookings.length} in service`,
      status: input.inServiceBookings.length ? 'Monitor' : 'Clear',
      nextAction: 'Track completion and prepare payment, wallet, and chat archive closeout.',
      className: input.inServiceBookings.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: input.inServiceBookings.length ? 'pill pill-info' : 'pill pill-success',
    },
    {
      id: 'cash-fee-debt',
      owner: 'Finance',
      title: 'Cash fee wallet gate',
      detail:
        'Partners with negative wallet from cash bookings can stay visible, but final acceptance, service start, and payout release wait for settlement.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Collect/offset' : 'Clear',
      nextAction:
        'Open cash settlements and record deposit or offset before final acceptance, service start, or payout release.',
      className: input.cashSummary.providerCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: input.cashSummary.providerCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'notification-delivery',
      owner: 'Alerts',
      title: 'Notification delivery failures',
      detail: 'Failed delivery rows can hide booking requests, Partner updates, or customer status changes.',
      href: '/notifications?review=failed',
      count: failedNotificationCount,
      countLabel: `${failedNotificationCount} failed`,
      status: failedNotificationCount ? 'Retry/check' : 'Clear',
      nextAction: 'Retry delivery or inspect disabled push devices before relying on app alerts.',
      className: failedNotificationCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: failedNotificationCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'partner-admin-facts',
      owner: 'Partner Ops',
      title: 'Partner factual follow-up',
      detail:
        'Partner list groups KYC, bank, wallet, location, app session, marketplace, and payout gate facts.',
      href: '/partners',
      count: input.partnerSignals.attentionCount,
      countLabel: `${input.partnerSignals.attentionCount} Partner fact(s)`,
      status: input.partnerSignals.attentionCount ? 'Review' : 'Clear',
      nextAction: 'Open Partner list and continue from the relevant factual filter.',
      className: input.partnerSignals.attentionCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: input.partnerSignals.attentionCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'completed-closeout',
      owner: 'Finance',
      title: 'Completed closeout evidence',
      detail: 'Completed bookings should have payment, earning, wallet/tax evidence, and retained chat.',
      href: '/bookings?view=closeout',
      count: closeoutRows.length,
      countLabel: `${closeoutRows.length} booking(s)`,
      status: closeoutRows.length ? 'Check' : 'Ready',
      nextAction: 'Open closeout queue and compare payment, earning, tax, wallet, and chat rows.',
      className: closeoutRows.length ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: closeoutRows.length ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'recent-operator-notes',
      owner: 'History',
      title: 'Recent written notes',
      detail: 'New Customer, Partner, or booking notes should be read when reviewing this period.',
      href: '/audit-log',
      count: recentNotes.length,
      countLabel: `${recentNotes.length} recent note(s)`,
      status: recentNotes.length ? 'Read' : 'None',
      nextAction: 'Open the latest operator notes and continue from the related detail page.',
      className: recentNotes.length ? 'signal signal-info' : 'signal signal-ok',
      statusClass: recentNotes.length ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => queueRowWeight(b) - queueRowWeight(a) || b.count - a.count);
}

export type ImmediateActionQueueRow = ReturnType<typeof buildImmediateActionQueue>[number];

function queueRowWeight(item: { readonly statusClass: string }) {
  if (item.statusClass.includes('danger')) return 4;
  if (item.statusClass.includes('warn')) return 3;
  if (item.statusClass.includes('info')) return 2;
  return 1;
}

function recentlyChangedWithin(value: string | null | undefined, nowMs: number, minutes: number) {
  const timestamp = dateValue(value);
  if (!timestamp) return false;
  return nowMs - timestamp <= minutes * 60_000;
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
