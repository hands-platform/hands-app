import type { AdminBooking, AdminCashSettlementSummary, AdminNotification } from '../../lib/admin-api';
import { formatRelativeTime } from '../../lib/admin-format';
import {
  bookingsMissingChatHandoffEvidence,
  bookingsMissingCloseoutEvidence,
} from './operations-handoff-booking-evidence';

type ChecklistTone = 'danger' | 'warn' | 'info' | 'success';

type PartnerSignalSummary = {
  readonly attentionCount: number;
};

type OperatorNoteSummary = {
  readonly actor?: string | null;
  readonly createdAt?: string | null;
};

type ReadinessChecklistInput = {
  readonly bookings: readonly AdminBooking[];
  readonly matchingBookings: readonly AdminBooking[];
  readonly inServiceBookings: readonly AdminBooking[];
  readonly failedNotificationCount?: number;
  readonly failedNotifications: readonly AdminNotification[];
  readonly cashSummary: AdminCashSettlementSummary;
  readonly partnerSignals: PartnerSignalSummary;
  readonly customerSignals: readonly unknown[];
  readonly operatorNotes: readonly OperatorNoteSummary[];
};

type ReadinessChecklistOptions = {
  readonly nowMs?: number;
};

type ReadinessChecklistContext = {
  readonly chatMissingCount: number;
  readonly completedWithoutEvidenceCount: number;
  readonly hasFreshHandoffNote: boolean;
  readonly latestNote: OperatorNoteSummary | null;
};

type ReadinessChecklistBaseRow = {
  readonly id: string;
  readonly owner: string;
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  readonly count: number;
  readonly countLabel: string;
  readonly status: string;
  readonly operatorAction: string;
  readonly tone: ChecklistTone;
};

export function buildHandoffReadinessChecklist(
  input: ReadinessChecklistInput,
  options: ReadinessChecklistOptions = {},
) {
  const context = buildReadinessChecklistContext(input, options.nowMs ?? Date.now());

  return sortChecklistRows(
    buildReadinessChecklistBaseRows(input, context).map((row) => ({
      ...row,
      badgeClass: checklistToneClass(row.tone),
    })),
  );
}

export function countOpenHandoffChecklistItems(
  rows: ReturnType<typeof buildHandoffReadinessChecklist>,
) {
  return rows.filter((item) => item.tone !== 'success').length;
}

export type HandoffReadinessChecklistRow = ReturnType<typeof buildHandoffReadinessChecklist>[number];

function buildReadinessChecklistContext(
  input: ReadinessChecklistInput,
  nowMs: number,
): ReadinessChecklistContext {
  const chatMissing = bookingsMissingChatHandoffEvidence(input.bookings);
  const completedWithoutEvidence = bookingsMissingCloseoutEvidence(input.bookings);
  const latestNote = input.operatorNotes[0] ?? null;
  const hasFreshHandoffNote = Boolean(
    latestNote && recentlyChangedWithin(latestNote.createdAt, nowMs, 480),
  );

  return {
    chatMissingCount: chatMissing.length,
    completedWithoutEvidenceCount: completedWithoutEvidence.length,
    hasFreshHandoffNote,
    latestNote,
  };
}

function buildReadinessChecklistBaseRows(
  input: ReadinessChecklistInput,
  context: ReadinessChecklistContext,
): ReadinessChecklistBaseRow[] {
  const failedNotificationCount = input.failedNotificationCount ?? input.failedNotifications.length;

  return [
    {
      id: 'live-matching-reviewed',
      owner: 'Dispatch',
      title: 'Live matching reviewed',
      detail:
        'Open matching rows need Partner response, marketplace participant, and customer final-choice continuity.',
      href: '/bookings?view=matching',
      count: input.matchingBookings.length,
      countLabel: `${input.matchingBookings.length} open`,
      status: input.matchingBookings.length ? 'Check live' : 'Clear',
      operatorAction: 'Open booking monitor and confirm no customer is waiting without a visible next step.',
      tone: input.matchingBookings.length ? 'warn' : 'success',
    },
    {
      id: 'active-service-reviewed',
      owner: 'Dispatch',
      title: 'Active service reviewed',
      detail: 'In-service bookings keep chat visible until the Partner completes the work.',
      href: '/bookings?view=closeout',
      count: input.inServiceBookings.length,
      countLabel: `${input.inServiceBookings.length} active`,
      status: input.inServiceBookings.length ? 'Watch' : 'Clear',
      operatorAction: 'Check active service rows, completion timing, payment evidence, and chat continuity.',
      tone: input.inServiceBookings.length ? 'info' : 'success',
    },
    {
      id: 'chat-continuity-reviewed',
      owner: 'Support',
      title: 'Chat continuity reviewed',
      detail: 'Matched and active bookings should have a retained chat room for admin archive and support.',
      href: '/bookings?view=chat-repair',
      count: context.chatMissingCount,
      countLabel: `${context.chatMissingCount} missing`,
      status: context.chatMissingCount ? 'Repair' : 'Ready',
      operatorAction: 'Repair or inspect rows where the booking is matched but no chat room exists.',
      tone: context.chatMissingCount ? 'danger' : 'success',
    },
    {
      id: 'cash-settlement-reviewed',
      owner: 'Finance',
      title: 'Cash settlement reviewed',
      detail: 'Cash bookings can leave Partner wallet fee debt until deposit or offset evidence is recorded.',
      href: '/cash-settlements',
      count: input.cashSummary.providerCount,
      countLabel: `${input.cashSummary.providerCount} Partner(s)`,
      status: input.cashSummary.providerCount ? 'Settle' : 'Clear',
      operatorAction: 'Check cash fee debt, missing payment evidence, and settlement notes.',
      tone: input.cashSummary.providerCount ? 'danger' : 'success',
    },
    {
      id: 'closeout-evidence-reviewed',
      owner: 'Finance',
      title: 'Completed closeout reviewed',
      detail: 'Completed bookings should retain payment, earning, tax/wallet, and chat evidence.',
      href: '/bookings?view=closeout',
      count: context.completedWithoutEvidenceCount,
      countLabel: `${context.completedWithoutEvidenceCount} row(s)`,
      status: context.completedWithoutEvidenceCount ? 'Check' : 'Ready',
      operatorAction: 'Open completed rows that do not yet show all closeout evidence.',
      tone: context.completedWithoutEvidenceCount ? 'warn' : 'success',
    },
    {
      id: 'failed-alerts-reviewed',
      owner: 'Alerts',
      title: 'Failed alerts reviewed',
      detail: 'Failed delivery rows can hide customer status changes or Partner booking requests.',
      href: '/notifications?review=failed',
      count: failedNotificationCount,
      countLabel: `${failedNotificationCount} failed`,
      status: failedNotificationCount ? 'Retry/check' : 'Clear',
      operatorAction: 'Open notification failures and inspect retry/device state before handover.',
      tone: failedNotificationCount ? 'warn' : 'success',
    },
    {
      id: 'partner-facts-reviewed',
      owner: 'Partner Ops',
      title: 'Partner facts reviewed',
      detail: 'Partner list groups KYC, bank, wallet, app session, service, and location facts.',
      href: '/partners',
      count: input.partnerSignals.attentionCount,
      countLabel: `${input.partnerSignals.attentionCount} fact(s)`,
      status: input.partnerSignals.attentionCount ? 'Review' : 'Clear',
      operatorAction: 'Open Partner filters only for factual follow-up, not personal evaluation.',
      tone: input.partnerSignals.attentionCount ? 'warn' : 'success',
    },
    {
      id: 'customer-context-reviewed',
      owner: 'Support',
      title: 'Customer context reviewed',
      detail:
        'Customer records show booking, payment/refund, chat archive, saved address, session, and notes.',
      href: '/customers',
      count: input.customerSignals.length,
      countLabel: `${input.customerSignals.length} record(s)`,
      status: input.customerSignals.length ? 'Available' : 'No rows',
      operatorAction: 'Use customer detail pages for support history when a customer contacts the team.',
      tone: input.customerSignals.length ? 'info' : 'success',
    },
    {
      id: 'handoff-note-written',
      owner: 'History',
      title: 'Written note prepared',
      detail: context.latestNote
        ? `Latest note: ${relativeTime(context.latestNote.createdAt)} by ${context.latestNote.actor}.`
        : 'No operations history note has been written yet.',
      href: '/operations-handoff',
      count: context.hasFreshHandoffNote ? 1 : 0,
      countLabel: context.hasFreshHandoffNote ? 'fresh note' : 'needs note',
      status: context.hasFreshHandoffNote ? 'Ready' : 'Write note',
      operatorAction: 'Write a short factual note when the selected period needs future review.',
      tone: context.hasFreshHandoffNote ? 'success' : 'warn',
    },
  ];
}

function sortChecklistRows<T extends { readonly count: number; readonly tone: ChecklistTone }>(
  rows: readonly T[],
) {
  return [...rows].sort(
    (a, b) => checklistToneWeight(b.tone) - checklistToneWeight(a.tone) || b.count - a.count,
  );
}

function checklistToneClass(tone: ChecklistTone) {
  if (tone === 'danger') return 'pill pill-danger';
  if (tone === 'warn') return 'pill pill-warn';
  if (tone === 'info') return 'pill pill-info';
  return 'pill pill-success';
}

function checklistToneWeight(tone: ChecklistTone) {
  if (tone === 'danger') return 4;
  if (tone === 'warn') return 3;
  if (tone === 'info') return 2;
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

function relativeTime(value?: string | null) {
  return formatRelativeTime(value, {
    emptyFallback: 'unknown time',
    invalidFallback: 'unknown time',
    hourLabelCutoff: 48,
  });
}
