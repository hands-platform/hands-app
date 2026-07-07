import type { AdminBookingDetail } from '../../../lib/admin-api';
import type { BookingClosureSummary } from '../../../lib/booking-closure-summary';
import {
  type BookingPostMatchCancellationPillTone as PillTone,
  postMatchCancellationFeeStateLabel,
  postMatchCancellationFeeStateTone,
  postMatchCancellationResolutionLabel,
  postMatchCancellationResolutionTone,
  postMatchCancellationTimingLabel,
  postMatchCancellationTimingTone,
} from '../booking-post-match-cancellation-display';
import {
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationAutoApprovalEligible,
  isPostMatchCancellationBooking,
  isPostMatchCancellationManualReviewRequired,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';

export type BookingOutcomeReviewRow = {
  label: string;
  value: string;
  dateTimeValue?: string | null;
  helper: string;
  tone: PillTone;
  href: string;
};

export type BookingOutcomeReviewPanel = {
  visible: boolean;
  title: string;
  status: string;
  helper: string;
  tone: PillTone;
  primaryHref: string | null;
  primaryLabel: string | null;
  postMatchDecision: BookingPostMatchDecisionPanel;
  rows: BookingOutcomeReviewRow[];
};

export type BookingPostMatchDecisionPanel = {
  visible: boolean;
  canResolve: boolean;
  approveNote: string;
  holdNote: string;
  feeLabel: string;
  feeTone: PillTone;
  resolutionLabel: string;
  resolutionTone: PillTone;
  timingLabel: string;
  timingTone: PillTone;
};

type BookingOutcomeReviewPanelInput = {
  booking: AdminBookingDetail;
  closeoutOpenItemCount: number;
  closureSummary: BookingClosureSummary;
  messageCount: number;
  operatorNoteCount: number;
};

type BookingOutcomeKind = 'completed' | 'no-show' | 'post-match-cancel';

export function bookingOutcomeReviewPanel({
  booking,
  closeoutOpenItemCount,
  closureSummary,
  messageCount,
  operatorNoteCount,
}: BookingOutcomeReviewPanelInput): BookingOutcomeReviewPanel {
  const outcomeKind = bookingOutcomeKind(booking);
  if (!outcomeKind) {
    return hiddenPanel();
  }

  const hasClosureStamp = Boolean(booking.closedAt);
  const closureMissing = closureSummary.status === 'Terminal without closure stamp';
  const outcomeTime = booking.statusChangedAt ?? booking.closedAt ?? booking.updatedAt ?? booking.createdAt;
  const closureRecordHelper = compactOutcomeClosureDetail(
    closureSummary.detail,
    outcomeClosureFallback({ closureMissing, hasClosureStamp, outcomeKind }),
  );

  return {
    visible: true,
    ...outcomeCopy(outcomeKind),
    ...outcomePrimaryAction(outcomeKind, booking.id),
    postMatchDecision: postMatchDecisionPanel(booking),
    rows: [
      {
        label: 'Closure record',
        value: closureSummary.status,
        helper: closureRecordHelper,
        tone: closureMissing ? 'pill-warn' : hasClosureStamp ? 'pill-success' : 'pill-neutral',
        href: '#booking-closeout-checklist',
      },
      {
        label: 'Chat evidence',
        value: countLabel(messageCount, 'message'),
        helper: chatEvidenceHelper({ messageCount, outcomeKind }),
        tone: messageCount > 0 ? 'pill-success' : outcomeKind === 'completed' ? 'pill-neutral' : 'pill-warn',
        href: '#chat',
      },
      {
        label: 'Operator notes',
        value: countLabel(operatorNoteCount, 'note'),
        helper:
          operatorNoteCount > 0 ? 'Operator note attached.' : 'Add a note if support context matters.',
        tone: operatorNoteCount > 0 ? 'pill-success' : 'pill-neutral',
        href: '#operator-notes',
      },
      {
        label: 'Closeout status',
        value: closeoutOpenItemCount > 0 ? countLabel(closeoutOpenItemCount, 'open item') : 'Ready',
        helper:
          closeoutOpenItemCount > 0
            ? 'Open closeout items need review.'
            : 'No closeout exceptions.',
        tone: closeoutOpenItemCount > 0 ? 'pill-warn' : 'pill-success',
        href: '#booking-closeout-readiness',
      },
      {
        label: 'Outcome time',
        value: 'Not set',
        dateTimeValue: outcomeTime,
        helper: booking.statusChangedLabel ?? `Current booking state: ${humanizeStatus(booking.status)}.`,
        tone: 'pill-info',
        href: '#operating-timeline',
      },
    ],
  };
}

function postMatchDecisionPanel(booking: AdminBookingDetail): BookingPostMatchDecisionPanel {
  if (!isPostMatchCancellationBooking(booking)) {
    return hiddenPostMatchDecisionPanel();
  }

  const feeState = postMatchCancellationFeeState(booking);
  const resolution = postMatchCancellationResolution(booking);
  const autoApprovalEligible = isPostMatchCancellationAutoApprovalEligible(booking);
  const autoApproved = isPostMatchCancellationAutoApproved(booking);
  const manualReviewRequired = isPostMatchCancellationManualReviewRequired(booking);
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);

  return {
    visible: true,
    canResolve: resolution === 'pending',
    approveNote: autoApprovalEligible
      ? 'Approved within 15-minute post-match cancellation window.'
      : 'Approved after admin chat evidence review.',
    holdNote: 'Held after admin chat evidence review.',
    feeLabel: postMatchCancellationFeeStateLabel(feeState),
    feeTone: postMatchCancellationFeeStateTone(feeState),
    resolutionLabel: postMatchCancellationResolutionLabel(resolution, autoApproved),
    resolutionTone: postMatchCancellationResolutionTone(resolution),
    timingLabel: postMatchCancellationTimingLabel({
      autoApprovalEligible,
      autoApproved,
      manualReviewRequired,
      minutesAfterMatch,
    }),
    timingTone: postMatchCancellationTimingTone({
      autoApprovalEligible,
      autoApproved,
      manualReviewRequired,
      minutesAfterMatch,
    }),
  };
}

function outcomePrimaryAction(kind: BookingOutcomeKind, bookingId: string) {
  if (kind === 'post-match-cancel' || kind === 'no-show') {
    return {
      primaryHref: `/bookings/post-match-cancellations?view=post-match-cancellations#booking-${bookingId}`,
      primaryLabel: 'Open review queue',
    };
  }

  return {
    primaryHref: null,
    primaryLabel: null,
  };
}

function bookingOutcomeKind(booking: AdminBookingDetail): BookingOutcomeKind | null {
  if (booking.status === 'COMPLETED') {
    return 'completed';
  }
  if (booking.status === 'NO_SHOW') {
    return 'no-show';
  }
  if (booking.status === 'CANCELLED' && hasPostMatchSignal(booking)) {
    return 'post-match-cancel';
  }
  return null;
}

function hasPostMatchSignal(booking: AdminBookingDetail) {
  return Boolean(
    booking.matchedAt ||
      booking.selectedProviderId ||
      booking.selectedProvider?.id ||
      booking.chatRoom?.id ||
      booking.matchingEvidence?.stage === 'MATCHED' ||
      booking.matchingEvidence?.stage === 'SERVICE_ACTIVE',
  );
}

function outcomeCopy(kind: BookingOutcomeKind) {
  if (kind === 'completed') {
    return {
      title: 'Completed booking review',
      status: 'Completed',
      helper: 'Confirm service, retained chat, closeout, and audit records stay aligned.',
      tone: 'pill-success' as PillTone,
    };
  }
  if (kind === 'no-show') {
    return {
      title: 'No-show confirmation review',
      status: 'No-show',
      helper: 'Use retained chat, Partner note, movement, and operator notes before final confirmation.',
      tone: 'pill-danger' as PillTone,
    };
  }
  return {
    title: 'Post-match cancellation review',
    status: 'Post-match cancellation',
    helper: 'Use retained chat and Partner cancellation context before keeping final closeout effects.',
    tone: 'pill-warn' as PillTone,
  };
}

function hiddenPanel(): BookingOutcomeReviewPanel {
  return {
    visible: false,
    title: '',
    status: '',
    helper: '',
    tone: 'pill-neutral',
    primaryHref: null,
    primaryLabel: null,
    postMatchDecision: hiddenPostMatchDecisionPanel(),
    rows: [],
  };
}

function hiddenPostMatchDecisionPanel(): BookingPostMatchDecisionPanel {
  return {
    visible: false,
    canResolve: false,
    approveNote: '',
    holdNote: '',
    feeLabel: '',
    feeTone: 'pill-neutral',
    resolutionLabel: '',
    resolutionTone: 'pill-neutral',
    timingLabel: '',
    timingTone: 'pill-neutral',
  };
}

function compactOutcomeClosureDetail(detail: string, fallback: string) {
  if (/terminal but has no explicit closure actor\/reason saved/i.test(detail)) {
    return fallback;
  }
  if (/^no closure has been recorded yet\.?$/i.test(detail)) {
    return fallback;
  }

  const normalized = detail
    .replace(/^\s*[^/]*?\bclosure\s*\/\s*/i, '')
    .replace(/^\s*[^/]*?\bclosure\s*\/\s*/i, '')
    .replace(/^Service Completed\s*\/\s*/i, '')
    .replace(/^Smoke:\s*/i, '')
    .replace(/^service completed;\s*/i, 'Service completed; ')
    .replace(/closeout reconciliation still needs review/i, 'closeout reconciliation needs review')
    .trim();

  return normalized && !/^reason not saved\.?$/i.test(normalized) ? normalized : fallback;
}

function outcomeClosureFallback({
  closureMissing,
  hasClosureStamp,
  outcomeKind,
}: {
  closureMissing: boolean;
  hasClosureStamp: boolean;
  outcomeKind: BookingOutcomeKind;
}) {
  if (closureMissing) {
    return 'Closure actor or reason is missing.';
  }
  if (!hasClosureStamp) {
    return 'Closure is not recorded yet.';
  }
  return outcomeKind === 'completed' ? 'Service completion recorded.' : 'Closure record saved.';
}

function chatEvidenceHelper({
  messageCount,
  outcomeKind,
}: {
  messageCount: number;
  outcomeKind: BookingOutcomeKind;
}) {
  if (messageCount > 0) {
    return outcomeKind === 'completed' ? 'Retained chat attached.' : 'Review retained chat before final decision.';
  }
  return outcomeKind === 'completed' ? 'No retained chat yet.' : 'Retained chat is missing.';
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function humanizeStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
