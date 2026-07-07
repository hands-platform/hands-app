export type BookingOperatorCommandTone =
  | 'pill-danger'
  | 'pill-info'
  | 'pill-neutral'
  | 'pill-success'
  | 'pill-warn';

export type BookingOperatorCommand = {
  id: string;
  label: string;
  title: string;
  detail: string;
  owner: string;
  tone: BookingOperatorCommandTone;
  action:
    | { type: 'link'; href: string; label: string }
    | { type: 'note'; preset: string; label: string }
    | { type: 'task'; taskType: string; taskStatus: string; label: string };
};

export type BookingOperatorPendingTask = {
  label: string;
  helper: string;
  status: string;
  type: string;
} | null;

export type BookingOperatorCommandQueueInput = {
  bookingStatus: string;
  participantCount: number;
  customerChoiceCandidateCount: number;
  partnerLabel: string;
  hasFinalPartner: boolean;
  hasChatRoom: boolean;
  messageCount: number;
  hasLatestLocation: boolean;
  latestLocationFreshness: string;
  providerLocationHelper: string;
  paymentStatus: string;
  cashDebtNeedsSettlement: boolean;
  closeoutAvailable: boolean;
  canExpire: boolean;
  canMarkNoShow: boolean;
  attentionFlagCount: number;
  pendingTask: BookingOperatorPendingTask;
};

export type BookingOperatorCommandQueue = {
  status: string;
  tone: 'pill-success' | 'pill-warn';
  labels: Array<{ label: string; value: string; helper: string }>;
  commands: BookingOperatorCommand[];
};

const activeStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function bookingOperatorCommandQueue(
  input: BookingOperatorCommandQueueInput,
): BookingOperatorCommandQueue {
  const commands: BookingOperatorCommand[] = [];
  const add = (command: BookingOperatorCommand) => commands.push(command);
  const activeStatus = activeStatuses.has(input.bookingStatus);

  if (input.bookingStatus === 'OPEN_MATCHING') {
    const selectableDetail =
      input.customerChoiceCandidateCount > 0
        ? `${input.customerChoiceCandidateCount} customer-selectable Partner(s) / ${input.participantCount} participant row(s).`
        : `0 customer-selectable Partner(s) / ${input.participantCount} participant row(s).`;

    add({
      id: 'matching-watch',
      label: 'MATCH',
      title: 'Monitor customer choice',
      detail: `${selectableDetail} Customer still chooses the final Partner.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#participants', label: 'Open shortlist' },
    });
  }

  if (input.bookingStatus === 'OPEN_MATCHING' && input.participantCount === 0) {
    add({
      id: 'partner-supply',
      label: 'SUPPLY',
      title: 'Check nearby Partner supply',
      detail:
        'No Partner participation is recorded yet. Review marketplace-ready Partners and notification delivery before widening operations policy.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#marketplace-supply', label: 'Open supply' },
    });
  }

  if (
    input.bookingStatus === 'OPEN_MATCHING' &&
    input.participantCount > 0 &&
    input.customerChoiceCandidateCount === 0
  ) {
    add({
      id: 'customer-choice-empty',
      label: 'CHOICE',
      title: 'Check customer choice readiness',
      detail:
        'Participant evidence rows exist, but no Partner is customer-selectable yet. Review participant statuses before telling the customer to choose.',
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#participants', label: 'Open ledger' },
    });
  }

  if (activeStatus && !input.hasChatRoom) {
    add({
      id: 'chat-repair',
      label: 'CHAT',
      title: 'Repair chat handoff',
      detail:
        'A matched or active booking should have a retained chat room for customer support and admin review.',
      owner: 'Support operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '/bookings?view=chat-repair', label: 'Open queue' },
    });
  } else if (input.hasChatRoom && activeStatus && input.messageCount === 0) {
    add({
      id: 'chat-first-contact',
      label: 'CHAT',
      title: 'Monitor first chat contact',
      detail:
        'Chat is ready but no message has been sent yet. Add a note if either side reports uncertainty.',
      owner: 'Support operator',
      tone: 'pill-info',
      action: {
        type: 'note',
        label: 'Log watch',
        preset: 'Chat is ready but quiet; support is monitoring first customer/Partner contact.',
      },
    });
  }

  if (activeStatus && !input.hasLatestLocation) {
    add({
      id: 'location-request',
      label: 'LOC',
      title: 'Ask Partner to share location',
      detail: `${input.partnerLabel} has not shared a saved current service pin for this active booking.`,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'BLOCKED', label: 'Flag location' },
    });
  } else if (input.hasLatestLocation && input.latestLocationFreshness !== 'recent') {
    add({
      id: 'location-stale',
      label: 'LOC',
      title: 'Refresh stale Partner location',
      detail: input.providerLocationHelper,
      owner: 'Dispatch operator',
      tone: 'pill-warn',
      action: { type: 'task', taskType: 'LOCATION_CHECKED', taskStatus: 'PENDING', label: 'Reset check' },
    });
  }

  if (input.paymentStatus === 'AUTHORIZED' && input.bookingStatus === 'COMPLETED') {
    add({
      id: 'capture-payment',
      label: 'PAY',
      title: 'Capture completed service payment',
      detail: 'Service is completed but payment is still authorized. Review capture before payout closeout.',
      owner: 'Payments operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#payment', label: 'Open payment' },
    });
  }

  if (input.cashDebtNeedsSettlement) {
    add({
      id: 'cash-debt',
      label: 'CASH',
      title: 'Settle Partner cash fee debt',
      detail:
        'Cash service fee debt blocks final acceptance, service start, and payout release until the company fee is settled.',
      owner: 'Finance operator',
      tone: 'pill-danger',
      action: { type: 'link', href: '#finance', label: 'Open finance' },
    });
  }

  if (input.closeoutAvailable) {
    add({
      id: 'completed-closeout',
      label: 'CLOSE',
      title: 'Reconcile completed booking',
      detail:
        'Ensure capture, earning, tax, platform fee, and wallet impact records exist before leaving the booking.',
      owner: 'Finance operator',
      tone: 'pill-warn',
      action: { type: 'link', href: '#completed-closeout', label: 'Open closeout' },
    });
  }

  if (input.canExpire) {
    add({
      id: 'expire-matching',
      label: 'TTL',
      title: 'Expire if matching window is over',
      detail: 'Use this only when the customer should stop waiting and payment hold needs release.',
      owner: 'Dispatch operator',
      tone: 'pill-info',
      action: { type: 'link', href: '#matching-expiry', label: 'Open expiry' },
    });
  }

  if (input.canMarkNoShow) {
    add({
      id: 'no-show-option',
      label: 'NO-SHOW',
      title: 'No-show action available',
      detail:
        'Use only after confirming the customer or Partner did not proceed and communication is retained.',
      owner: 'Support operator',
      tone: 'pill-neutral',
      action: { type: 'link', href: '#no-show-handling', label: 'Open action' },
    });
  }

  if (input.pendingTask) {
    add({
      id: 'ops-task-next',
      label: 'TASK',
      title: `Finish ${input.pendingTask.label.toLowerCase()}`,
      detail: input.pendingTask.helper,
      owner: 'Operations',
      tone: input.pendingTask.status === 'BLOCKED' ? 'pill-danger' : 'pill-info',
      action: {
        type: 'task',
        taskType: input.pendingTask.type,
        taskStatus: input.pendingTask.status === 'BLOCKED' ? 'PENDING' : 'DONE',
        label: input.pendingTask.status === 'BLOCKED' ? 'Reopen' : 'Mark done',
      },
    });
  }

  if (commands.length === 0) {
    add({
      id: 'normal-monitoring',
      label: 'OK',
      title: 'Normal monitoring',
      detail:
        'No immediate operator action is active. Keep the record visible until the next booking transition.',
      owner: 'Operations',
      tone: 'pill-success',
      action: {
        type: 'note',
        label: 'Log check',
        preset: 'Booking reviewed; no immediate operator action needed at this time.',
      },
    });
  }

  const urgentCount = commands.filter(
    (command) => command.tone === 'pill-danger' || command.tone === 'pill-warn',
  ).length;

  return {
    status: urgentCount ? `${urgentCount} action(s)` : 'Monitor',
    tone: urgentCount ? 'pill-warn' : 'pill-success',
    labels: [
      {
        label: 'Active commands',
        value: String(commands.length),
        helper: urgentCount ? `${urgentCount} need same-shift attention.` : 'No urgent handling step.',
      },
      {
        label: 'Partner',
        value: input.partnerLabel,
        helper: input.hasFinalPartner ? 'Preferred/final Partner context.' : 'No Partner is selected yet.',
      },
      {
        label: 'Chat',
        value: input.hasChatRoom ? 'Retained' : 'Missing',
        helper: `${input.messageCount} message(s) in admin archive.`,
      },
      {
        label: 'Attention flags',
        value: String(input.attentionFlagCount),
        helper: 'Factual handling checks only.',
      },
    ],
    commands: commands.slice(0, 8),
  };
}
