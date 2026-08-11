import type {
  AdminBooking,
  AdminBookingMonitorSummary,
  AdminCashSettlementSummary,
  AdminCompletedBookingOperationsSummary,
  AdminNotification,
  AdminNotificationBoardSummary,
} from '../../lib/admin-api';
import { adminCountLabel } from '../../lib/admin-copy';
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
  readonly bookingSummary?: Pick<
    AdminBookingMonitorSummary,
    | 'chatMissingCount'
    | 'matchingNow'
    | 'oldestChatMissingAt'
    | 'oldestMatchingAt'
    | 'serviceInProgress'
  > | null;
  readonly completedBookingSummary?: Pick<
    AdminCompletedBookingOperationsSummary,
    'closeoutChecks' | 'oldestCloseoutAt'
  > | null;
  readonly matchingBookings: readonly AdminBooking[];
  readonly inServiceBookings: readonly AdminBooking[];
  readonly failedNotificationCount?: number;
  readonly failedNotifications: readonly AdminNotification[];
  readonly notificationSummary?: Pick<AdminNotificationBoardSummary, 'oldestFailedAt'> | null;
  readonly cashSummary: AdminCashSettlementSummary;
  readonly partnerSignals: PartnerSignalSummary;
  readonly operatorNoteCount?: number;
  readonly operatorNotes: readonly OperatorNoteSummary[];
};

export type ImmediateActionQueueRow = {
  readonly className: string;
  readonly count: number;
  readonly countLabel: string;
  readonly detail: string;
  readonly href: string;
  readonly id: string;
  readonly nextAction: string;
  readonly oldestOpenAt?: string | null;
  readonly owner: string;
  readonly status: string;
  readonly statusClass: string;
  readonly title: string;
};

export function buildImmediateActionQueue(
  input: ImmediateActionQueueInput,
  options: ImmediateActionQueueOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const chatMissing = bookingsMissingChatHandoffEvidence(input.bookings);
  const closeoutRows = bookingsMissingCloseoutEvidence(input.bookings);
  const closeoutCount = input.completedBookingSummary?.closeoutChecks ?? closeoutRows.length;
  const matchingCount = input.bookingSummary?.matchingNow ?? input.matchingBookings.length;
  const chatMissingCount = input.bookingSummary?.chatMissingCount ?? chatMissing.length;
  const failedNotificationCount = input.failedNotificationCount ?? input.failedNotifications.length;
  const recentNotes = input.operatorNotes.filter((note) =>
    recentlyChangedWithin(note.createdAt, nowMs, 240),
  );
  const recentNoteCount = input.operatorNoteCount ?? recentNotes.length;
  const serviceHandoffCount =
    input.bookingSummary?.serviceInProgress ?? input.inServiceBookings.length;

  const rows: ImmediateActionQueueRow[] = [
    {
      id: 'matching-live-window',
      owner: 'Dispatch',
      title: 'Open matching windows',
      detail:
        'Customers are waiting while first-pick and nearby Partner participation windows are still open.',
      href: '/bookings?view=matching',
      count: matchingCount,
      countLabel: adminCountLabel(matchingCount, 'booking'),
      oldestOpenAt: input.bookingSummary?.oldestMatchingAt ?? null,
      status: matchingCount ? 'Monitor now' : 'Clear',
      nextAction:
        'Open the matching board and check Partner response, participant list, and customer choice.',
      className: matchingCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: matchingCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'chat-creation',
      owner: 'Support',
      title: 'Matched booking chat',
      detail: 'A matched or in-service booking should have an admin-retained chat room.',
      href: '/bookings?view=chat-repair',
      count: chatMissingCount,
      countLabel: `${chatMissingCount} missing chat`,
      oldestOpenAt: input.bookingSummary?.oldestChatMissingAt ?? null,
      status: chatMissingCount ? 'Repair' : 'Ready',
      nextAction: 'Open chat repair queue if any matched booking has no chat room.',
      className: chatMissingCount ? 'signal signal-danger' : 'signal signal-ok',
      statusClass: chatMissingCount ? 'pill pill-danger' : 'pill pill-success',
    },
    {
      id: 'in-service-watch',
      owner: 'Dispatch',
      title: 'Active service handoffs',
      detail:
        'Matched, travelling, arrived, and in-service bookings remain in the active handoff window.',
      href: '/bookings?view=closeout',
      count: serviceHandoffCount,
      countLabel: `${serviceHandoffCount} active`,
      status: serviceHandoffCount ? 'Monitor' : 'Clear',
      nextAction: 'Monitor customer and Partner handoff through completion and closeout.',
      className: serviceHandoffCount ? 'signal signal-info' : 'signal signal-ok',
      statusClass: serviceHandoffCount ? 'pill pill-info' : 'pill pill-success',
    },
    {
      id: 'cash-fee-debt',
      owner: 'Finance',
      title: 'Cash fee wallet gate',
      detail:
        'Partners with negative wallet from cash bookings can stay visible, but final acceptance, service start, and payout release wait for settlement.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: adminCountLabel(input.cashSummary.providerCount, 'Partner'),
      oldestOpenAt: input.cashSummary.oldestOpenAt,
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
      oldestOpenAt: input.notificationSummary?.oldestFailedAt ?? null,
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
      countLabel: adminCountLabel(input.partnerSignals.attentionCount, 'Partner fact'),
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
      count: closeoutCount,
      countLabel: adminCountLabel(closeoutCount, 'booking'),
      oldestOpenAt: input.completedBookingSummary?.oldestCloseoutAt ?? null,
      status: closeoutCount ? 'Check' : 'Ready',
      nextAction: 'Open closeout queue and compare payment, earning, tax, wallet, and chat rows.',
      className: closeoutCount ? 'signal signal-warn' : 'signal signal-ok',
      statusClass: closeoutCount ? 'pill pill-warn' : 'pill pill-success',
    },
    {
      id: 'recent-operator-notes',
      owner: 'History',
      title: 'Recent written notes',
      detail: 'New Customer, Partner, or booking notes should be read when reviewing this period.',
      href: '/audit-log',
      count: recentNoteCount,
      countLabel: adminCountLabel(recentNoteCount, 'recent note'),
      status: recentNoteCount ? 'Read' : 'None',
      nextAction: 'Open the latest operator notes and continue from the related detail page.',
      className: recentNoteCount ? 'signal signal-info' : 'signal signal-ok',
      statusClass: recentNoteCount ? 'pill pill-info' : 'pill pill-success',
    },
  ];

  return rows.sort((a, b) => queueRowWeight(b) - queueRowWeight(a) || b.count - a.count);
}

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
