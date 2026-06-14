import type { AdminBooking, AdminCashSettlementSummary, AdminNotification } from '../../lib/admin-api';
import { formatRelativeTime } from '../../lib/admin-format';

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
  readonly failedNotifications: readonly AdminNotification[];
  readonly cashSummary: AdminCashSettlementSummary;
  readonly partnerSignals: PartnerSignalSummary;
  readonly customerSignals: readonly unknown[];
  readonly operatorNotes: readonly OperatorNoteSummary[];
};

type ReadinessChecklistOptions = {
  readonly nowMs?: number;
};

export function buildHandoffReadinessChecklist(
  input: ReadinessChecklistInput,
  options: ReadinessChecklistOptions = {},
) {
  const nowMs = options.nowMs ?? Date.now();
  const chatMissing = input.bookings.filter(
    (booking) =>
      ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
      !booking.chatRoom?.id,
  );
  const completedWithoutEvidence = input.bookings.filter(
    (booking) =>
      booking.status === 'COMPLETED' && (!booking.payment || !booking.earning || !booking.chatRoom?.id),
  );
  const latestNote = input.operatorNotes[0] ?? null;
  const hasFreshHandoffNote = Boolean(
    latestNote && recentlyChangedWithin(latestNote.createdAt, nowMs, 480),
  );

  const rows = [
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
      count: chatMissing.length,
      countLabel: `${chatMissing.length} missing`,
      status: chatMissing.length ? 'Repair' : 'Ready',
      operatorAction: 'Repair or inspect rows where the booking is matched but no chat room exists.',
      tone: chatMissing.length ? 'danger' : 'success',
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
      count: completedWithoutEvidence.length,
      countLabel: `${completedWithoutEvidence.length} row(s)`,
      status: completedWithoutEvidence.length ? 'Check' : 'Ready',
      operatorAction: 'Open completed rows that do not yet show all closeout evidence.',
      tone: completedWithoutEvidence.length ? 'warn' : 'success',
    },
    {
      id: 'failed-alerts-reviewed',
      owner: 'Alerts',
      title: 'Failed alerts reviewed',
      detail: 'Failed delivery rows can hide customer status changes or Partner booking requests.',
      href: '/notifications?review=failed',
      count: input.failedNotifications.length,
      countLabel: `${input.failedNotifications.length} failed`,
      status: input.failedNotifications.length ? 'Retry/check' : 'Clear',
      operatorAction: 'Open notification failures and inspect retry/device state before handover.',
      tone: input.failedNotifications.length ? 'warn' : 'success',
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
      operatorAction: 'Use customer detail pages for support handoff when a customer contacts the team.',
      tone: input.customerSignals.length ? 'info' : 'success',
    },
    {
      id: 'handoff-note-written',
      owner: 'Handoff',
      title: 'Written note prepared',
      detail: latestNote
        ? `Latest note: ${relativeTime(latestNote.createdAt)} by ${latestNote.actor}.`
        : 'No handoff note has been written yet.',
      href: '/operations-handoff',
      count: hasFreshHandoffNote ? 1 : 0,
      countLabel: hasFreshHandoffNote ? 'fresh note' : 'needs note',
      status: hasFreshHandoffNote ? 'Ready' : 'Write note',
      operatorAction: 'Write a short factual note before ending the shift if open work remains.',
      tone: hasFreshHandoffNote ? 'success' : 'warn',
    },
  ] satisfies Array<{
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
  }>;

  return rows
    .map((row) => ({
      ...row,
      badgeClass: checklistToneClass(row.tone),
    }))
    .sort((a, b) => checklistToneWeight(b.tone) - checklistToneWeight(a.tone) || b.count - a.count);
}

export function countOpenHandoffChecklistItems(
  rows: ReturnType<typeof buildHandoffReadinessChecklist>,
) {
  return rows.filter((item) => item.tone !== 'success').length;
}

export type HandoffReadinessChecklistRow = ReturnType<typeof buildHandoffReadinessChecklist>[number];

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
