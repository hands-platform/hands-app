type BoardTone = 'pill-success' | 'pill-warn' | 'pill-danger' | 'pill-info' | 'pill-neutral';

export type BookingChatEvidenceDecisionBoardInput = {
  bookingId: string;
  bookingStatus: string;
  hasChatRoom: boolean;
  chatRoomShortId?: string | null;
  messageCount: number;
  latestMessageAtLabel?: string | null;
  latestMessageAtValue?: string | null;
  latestMessagePreview?: string | null;
  hasLatestLocation: boolean;
  latestLocationAtLabel?: string | null;
  latestLocationAtValue?: string | null;
  latestLocationCoordinateLabel?: string | null;
  alertCount: number;
  auditLogCount: number;
  operatorNoteLines: string[];
};

export type BookingChatEvidenceDecisionBoard = {
  status: string;
  tone: BoardTone;
  summary: string;
  metrics: Array<{ label: string; value: string; helper: string; dateTimeValue?: string | null }>;
  rows: Array<{
    lane: string;
    scope: string;
    state: string;
    tone: BoardTone;
    record: string;
    operatorUse: string;
    href: string;
  }>;
};

const CHAT_REQUIRED_STATUSES = new Set([
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
  'COMPLETED',
]);

const TERMINAL_BOOKING_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

const COORDINATE_PAIR_TEXT_RE = /\b-?\d{1,3}\.\d{2,}\s*,\s*-?\d{1,3}\.\d{2,}\b/;

function partnerLocationMetricHelper(label?: string | null) {
  if (!label) {
    return 'No Partner location record is attached to this booking.';
  }

  if (COORDINATE_PAIR_TEXT_RE.test(label)) {
    return 'Latest Partner location is saved for dispatch checks.';
  }

  return `${label} latest Partner location.`;
}

function partnerMovementRecord(label: string, atLabel?: string | null) {
  const safeLabel = COORDINATE_PAIR_TEXT_RE.test(label)
    ? 'Latest Partner location saved'
    : label;

  return `${safeLabel} / ${atLabel ?? 'No timestamp'}`;
}

export function bookingChatEvidenceDecisionBoard(
  input: BookingChatEvidenceDecisionBoardInput,
): BookingChatEvidenceDecisionBoard {
  const chatRequired = CHAT_REQUIRED_STATUSES.has(input.bookingStatus);
  const latestNote = input.operatorNoteLines[input.operatorNoteLines.length - 1];
  const noteCount = input.operatorNoteLines.length;
  const hasContextEvidence =
    input.messageCount > 0 || input.hasLatestLocation || input.alertCount > 0 || noteCount > 0;
  const hasDecisionEvidence = input.messageCount > 0 && noteCount > 0;
  const mobileHidden = TERMINAL_BOOKING_STATUSES.has(input.bookingStatus) && input.hasChatRoom;
  const chatArchiveHref = `/chat-archive?q=${encodeURIComponent(input.bookingId)}`;
  const status = input.hasChatRoom
    ? input.messageCount === 0
      ? 'Retained room · no messages'
      : hasDecisionEvidence
        ? 'Chat evidence ready'
        : 'Chat evidence partial'
    : chatRequired
      ? 'Chat repair needed'
      : 'Chat locked until match';
  const tone: BoardTone = input.hasChatRoom
    ? hasDecisionEvidence
      ? 'pill-success'
      : 'pill-warn'
    : chatRequired
      ? 'pill-danger'
      : 'pill-info';
  const summary = input.hasChatRoom
    ? mobileHidden
      ? 'This booking can hide chat in mobile after closeout, but admin keeps the retained transcript for operations review.'
      : 'This booking has an admin-retained chat room for service handoff and operations review.'
    : chatRequired
      ? 'A final Partner exists or service stage has started, but no retained chat room is attached yet.'
      : 'Customer and Partner chat opens only after the customer final Partner selection.';

  return {
    status,
    tone,
    summary,
    metrics: [
      {
        label: 'Chat room',
        value: input.hasChatRoom ? input.chatRoomShortId ?? 'missing' : 'No room',
        helper: input.hasChatRoom
          ? `${input.messageCount} retained message(s) in admin archive.`
          : chatRequired
            ? 'Matched or active booking should have a retained chat room.'
            : 'Chat is not expected before final Partner selection.',
      },
      {
        label: 'Latest message',
        value: input.latestMessageAtLabel ?? 'No message',
        dateTimeValue: input.latestMessageAtValue ?? null,
        helper: input.latestMessagePreview ?? 'No customer or Partner message has been retained yet.',
      },
      {
        label: 'Location handoff',
        value: input.latestLocationAtLabel ?? 'No location',
        dateTimeValue: input.latestLocationAtValue ?? null,
        helper: partnerLocationMetricHelper(input.latestLocationCoordinateLabel),
      },
      {
        label: 'Alerts and notes',
        value: `${input.alertCount} alert(s) / ${noteCount} note(s)`,
        helper:
          latestNote ??
          'Use alerts and operator notes to add context around chat silence or service issues.',
      },
    ],
    rows: [
      {
        lane: 'Chat room creation',
        scope: 'Final Partner selection should create a retained customer-Partner room.',
        state: input.hasChatRoom ? 'Archived' : chatRequired ? 'Repair needed' : 'Waiting for final choice',
        tone: input.hasChatRoom ? 'pill-success' : chatRequired ? 'pill-danger' : 'pill-info',
        record: input.hasChatRoom
          ? `Room ${input.chatRoomShortId ?? 'missing'} / ${input.messageCount} message(s).`
          : chatRequired
            ? 'No retained room attached to a matched or service-stage booking.'
            : 'No room expected before matching.',
        operatorUse: 'Repair a missing room before service coordination, refund review, or no-show decision.',
        href: input.hasChatRoom ? chatArchiveHref : '#chat',
      },
      {
        lane: 'Conversation evidence',
        scope: 'Messages explain what customer and Partner actually communicated.',
        state: input.messageCount > 0 ? 'Messages retained' : input.hasChatRoom ? 'No messages yet' : 'No room',
        tone: input.messageCount > 0 ? 'pill-success' : input.hasChatRoom ? 'pill-warn' : 'pill-neutral',
        record: input.latestMessagePreview
          ? `${input.latestMessagePreview} / ${input.latestMessageAtLabel ?? 'No timestamp'}`
          : 'No message body retained.',
        operatorUse:
          'Use the transcript before cancellation, no-show, payment, refund, or support messaging.',
        href: input.hasChatRoom ? chatArchiveHref : '#chat',
      },
      {
        lane: 'Movement evidence',
        scope: 'Partner location can support arrival, delay, or no-show context.',
        state: input.hasLatestLocation ? 'Location retained' : 'No location',
        tone: input.hasLatestLocation ? 'pill-info' : 'pill-warn',
        record: input.latestLocationCoordinateLabel
          ? partnerMovementRecord(
              input.latestLocationCoordinateLabel,
              input.latestLocationAtLabel,
            )
          : 'No Partner movement row is attached.',
        operatorUse:
          'Use movement context with chat and alerts; do not judge either side from one signal alone.',
        href: '#location',
      },
      {
        lane: 'Retained review context',
        scope: 'Alerts, audit rows, and operator notes preserve support context after mobile chat closes.',
        state: hasDecisionEvidence ? 'Evidence ready' : hasContextEvidence ? 'Partial context' : 'Needs operator note',
        tone: hasDecisionEvidence ? 'pill-success' : 'pill-warn',
        record: `${input.alertCount} notification row(s), ${input.auditLogCount} audit row(s), ${noteCount} note(s).`,
        operatorUse: 'Add a factual note when chat is quiet, missing, or insufficient for an outcome change.',
        href: '#operator-notes',
      },
    ],
  };
}
