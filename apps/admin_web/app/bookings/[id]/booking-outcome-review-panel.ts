import type { AdminBookingDetail } from '../../../lib/admin-api';
import { postMatchCancellationWorkspaceFromHref } from '../../../lib/admin-nav-match';
import type { BookingClosureSummary } from '../../../lib/booking-closure-summary';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import {
  postMatchCancellationDetail,
  postMatchCancellationReasonDisplay,
} from '../booking-post-match-cancellation-reason';
import {
  type BookingPostMatchCancellationPillTone as PillTone,
  postMatchCancellationActorLabel,
  postMatchCancellationDecisionSourceLabel,
  postMatchCancellationDecisionSourceTone,
  postMatchCancellationFeeStateLabel,
  postMatchCancellationFeeStateTone,
  postMatchCancellationMinutesLabel,
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
  postMatchCancellationAdminDecision,
  postMatchCancellationDecisionAt,
  postMatchCancellationDecisionSource,
  postMatchCancellationDecisionSla,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';
import {
  approximateDistanceMeters,
  distanceLabel,
  formatDate,
  money,
} from './booking-formatters';
import { latestProviderLocation } from './booking-status-location';

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
  postMatchContext?: BookingPostMatchDecisionContext;
  rows: BookingOutcomeReviewRow[];
};

export type BookingPostMatchDecisionContext = {
  readonly summary?: readonly BookingOutcomeReviewRow[];
  readonly reason: BookingOutcomeReviewRow;
  readonly evidence: readonly BookingOutcomeReviewRow[];
  readonly money: readonly BookingOutcomeReviewRow[];
};

export type BookingPostMatchDecisionPanel = {
  visible: boolean;
  canResolve: boolean;
  actions: readonly BookingPostMatchDecisionAction[];
  blockedReason?: string;
  customerMoneyBefore: string;
  customerMoneyAfter: string;
  partnerFeeBefore: string;
  partnerFeeApproveAfter: string;
  partnerFeeHoldAfter?: string;
  reviewBefore: string;
  reviewAfter: string;
  feeLabel: string;
  feeTone: PillTone;
  feeAmountLabel?: string;
  decisionAt?: string | null;
  decidedBy?: string | null;
  decisionReasonLabel?: string | null;
  operatorNote?: string | null;
  sourceLabel?: string;
  sourceTone?: PillTone;
  slaLabel?: string;
  slaTone?: PillTone;
  resolutionLabel: string;
  resolutionTone: PillTone;
  timingLabel: string;
  timingTone: PillTone;
};

export type BookingPostMatchDecisionAction = {
  decision: 'approve' | 'hold';
  helper: string;
  label: string;
  tone: 'primary' | 'secondary';
};

type BookingOutcomeReviewPanelInput = {
  booking: AdminBookingDetail;
  closeoutOpenItemCount: number;
  closureSummary: BookingClosureSummary;
  messageCount: number;
  nowMs?: number;
  operatorNoteCount: number;
  returnHref?: string;
};

type BookingOutcomeKind = 'completed' | 'no-show' | 'post-match-cancel';

export function bookingOutcomeReviewPanel({
  booking,
  closeoutOpenItemCount,
  closureSummary,
  messageCount,
  nowMs = new Date().getTime(),
  operatorNoteCount,
  returnHref,
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
    ...outcomePrimaryAction(outcomeKind, booking.id, returnHref),
    postMatchDecision: postMatchDecisionPanel(booking, nowMs),
    postMatchContext:
      outcomeKind === 'post-match-cancel'
        ? postMatchDecisionContext(booking, messageCount, nowMs)
        : undefined,
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

function postMatchDecisionContext(
  booking: AdminBookingDetail,
  messageCount: number,
  nowMs: number,
): BookingPostMatchDecisionContext {
  const reason = postMatchCancellationReasonDisplay(booking);
  const reasonDetail = postMatchCancellationDetail(booking);
  const source = postMatchCancellationDecisionSource(booking);
  const adminDecision = postMatchCancellationAdminDecision(booking);
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  const sla = postMatchCancellationDecisionSla(booking, nowMs);
  const originalActorRole = adminDecision?.originalActorRole ?? (source.startsWith('admin-') ? null : booking.closedByRole);
  const reasonValue = reason?.label === 'Legacy reason' && adminDecision?.originalReason
    ? humanizeStatus(adminDecision.originalReason)
    : reason?.label ?? 'Legacy reason';
  const reasonHelper = reasonDetail ?? adminDecision?.originalNote ?? reason?.title ??
    'No detailed Partner cancellation note is stored.';

  return {
    summary: [
      {
        helper: originalActorRole
          ? `Original cancellation role: ${originalActorRole}.`
          : 'The original cancellation actor is unavailable in this legacy record.',
        href: '#booking-post-match-cancellation-decision',
        label: 'Cancellation actor',
        tone: originalActorRole ? 'pill-info' : 'pill-neutral',
        value: postMatchCancellationActorLabel(originalActorRole),
      },
      {
        dateTimeValue: booking.closedAt ?? null,
        helper: minutesAfterMatch === null
          ? 'The interval from matching to cancellation is unavailable.'
          : `${postMatchCancellationMinutesLabel(minutesAfterMatch)}.`,
        href: '#booking-post-match-cancellation-decision',
        label: 'Cancellation time',
        tone: booking.closedAt ? 'pill-info' : 'pill-neutral',
        value: booking.closedAt ? formatDate(booking.closedAt) : 'Not recorded',
      },
      {
        helper:
          source === 'open'
            ? 'Open decisions use the same two-hour target as the review queue.'
            : adminDecision
              ? `${adminDecision.decisionReasonLabel ?? 'Reason not recorded'} · ${adminDecision.actorName ?? 'Admin'} · ${formatDate(adminDecision.decidedAt)}.`
              : 'This resolved legacy decision is read-only; no admin decision event is available.',
        href: '#booking-post-match-cancellation-decision',
        label: source === 'open' ? 'Decision SLA' : 'Admin decision',
        tone: source === 'open' ? (sla.overdue ? 'pill-danger' : 'pill-info') : 'pill-neutral',
        value: source === 'open' ? sla.label : postMatchCancellationDecisionSourceLabel(source),
      },
    ],
    reason: {
      helper: reasonHelper,
      href: '#booking-post-match-cancellation-decision',
      label: 'Cancellation reason',
      tone: reason?.tone ?? 'pill-neutral',
      value: reasonValue,
    },
    evidence: [
      {
        helper:
          messageCount > 0
            ? 'Open the retained transcript and confirm the Partner explanation.'
            : 'No retained chat is attached. Treat the evidence as incomplete.',
        href: '#chat',
        label: 'Chat evidence',
        tone: messageCount > 0 ? 'pill-success' : 'pill-danger',
        value: countLabel(messageCount, 'message'),
      },
      postMatchLocationEvidence(booking),
    ],
    money: [
      postMatchCustomerPaymentOutcome(booking),
      postMatchPartnerFeeOutcome(booking),
    ],
  };
}

function postMatchLocationEvidence(booking: AdminBookingDetail): BookingOutcomeReviewRow {
  const actionLocation = latestLocationSnapshot(
    (booking.snapshots ?? []).filter((snapshot) => snapshot.bookingId === booking.id),
  );
  const fallbackLocation = latestProviderLocation(booking);
  const location = actionLocation ?? fallbackLocation;

  if (!location) {
    return {
      helper: 'No Partner location is attached to the cancellation action.',
      href: '#location',
      label: 'Location evidence',
      tone: 'pill-danger',
      value: 'No location record',
    };
  }

  const address = readAddressText(location);
  const distance = approximateDistanceMeters(
    booking.addressSnapshot?.latitude ?? booking.lat,
    booking.addressSnapshot?.longitude ?? booking.lng,
    location.lat,
    location.lng,
  );
  const evidenceParts = [
    address ? serviceAddressAreaLabel(address) : 'Readable address not recorded',
    distance === null ? null : `Approx. ${distanceLabel(Math.round(distance))} from booking address`,
    `Recorded ${formatDate(location.recordedAt)}`,
  ].filter(Boolean);

  return {
    helper: evidenceParts.join(' / '),
    href: '#location',
    label: 'Location evidence',
    tone: actionLocation ? 'pill-success' : 'pill-warn',
    value: actionLocation ? 'Cancellation location saved' : 'Latest Partner location only',
  };
}

function postMatchCustomerPaymentOutcome(booking: AdminBookingDetail): BookingOutcomeReviewRow {
  const payment = booking.payment;
  const method = payment?.method?.toUpperCase() ?? 'NONE';
  const status = payment?.status?.toUpperCase() ?? 'NONE';
  const amount = payment ? money(payment.amount, payment.currency) : null;
  const refundStatus = payment?.refunds?.find((refund) =>
    ['REQUESTED', 'PROVIDER_PROCESSING', 'GATEWAY_CONFIRMED'].includes(refund.status.toUpperCase()),
  )?.status.toUpperCase();
  const base = {
    href: '#payment',
    label: 'Customer money',
  };

  if (!payment || method === 'CASH') {
    return {
      ...base,
      helper:
        method === 'CASH'
          ? 'Cash was not collected through HANDS before service completion.'
          : 'No payment record is attached to this booking.',
      tone: 'pill-success',
      value: 'No company funds moved',
    };
  }

  if (method === 'CUSTOMER_WALLET') {
    const walletState = postMatchWalletPaymentState(status);
    return {
      ...base,
      helper: `${amount} / ${method} / ${status}`,
      tone: walletState.tone,
      value: walletState.value,
    };
  }

  const cardState = postMatchGatewayPaymentState(status, refundStatus);
  return {
    ...base,
    helper: `${amount} / ${method} / ${status}${refundStatus ? ` / REFUND ${refundStatus}` : ''}`,
    tone: cardState.tone,
    value: cardState.value,
  };
}

function postMatchPartnerFeeOutcome(booking: AdminBookingDetail): BookingOutcomeReviewRow {
  const feeState = postMatchCancellationFeeState(booking);
  if (!booking.earning) {
    return {
      helper: 'No Partner earning or payout was created for this cancellation.',
      href: '#payment',
      label: 'Partner fee',
      tone: 'pill-success',
      value: 'No Partner payable',
    };
  }

  return {
    helper: `${money(booking.earning.netAmount, booking.earning.currency)} / ${booking.earning.status}`,
    href: '#payment',
    label: 'Partner fee',
    tone: feeState === 'held' ? 'pill-warn' : 'pill-success',
    value:
      feeState === 'held'
        ? 'Fee decision pending'
        : feeState === 'restored'
          ? 'Fee impact restored'
          : postMatchCancellationFeeStateLabel(feeState),
  };
}

function postMatchWalletPaymentState(status: string) {
  if (status === 'RELEASED' || status === 'REFUNDED') {
    return {
      tone: 'pill-success' as PillTone,
      value: status === 'RELEASED' ? 'Wallet amount restored' : 'Wallet refund completed',
    };
  }
  if (status === 'AUTHORIZED' || status === 'PENDING') {
    return {
      tone: 'pill-warn' as PillTone,
      value: 'Wallet amount still held',
    };
  }
  if (status === 'CAPTURED') {
    return {
      tone: 'pill-danger' as PillTone,
      value: 'Wallet charge needs review',
    };
  }
  return {
    tone: 'pill-info' as PillTone,
    value: `Wallet ${humanizeStatus(status)}`,
  };
}

function postMatchGatewayPaymentState(status: string, refundStatus?: string) {
  if (refundStatus === 'REQUESTED') {
    return { tone: 'pill-warn' as PillTone, value: 'Refund approval pending' };
  }
  if (refundStatus === 'PROVIDER_PROCESSING' || refundStatus === 'GATEWAY_CONFIRMED') {
    return { tone: 'pill-info' as PillTone, value: 'Refund processing' };
  }
  if (status === 'RELEASED') {
    return { tone: 'pill-success' as PillTone, value: 'Authorization cancelled' };
  }
  if (status === 'REFUNDED') {
    return { tone: 'pill-success' as PillTone, value: 'Refund completed' };
  }
  if (status === 'AUTHORIZED' || status === 'PENDING') {
    return { tone: 'pill-warn' as PillTone, value: 'Authorization still open' };
  }
  if (status === 'CAPTURED') {
    return { tone: 'pill-danger' as PillTone, value: 'Captured payment needs review' };
  }
  if (status === 'FAILED') {
    return { tone: 'pill-success' as PillTone, value: 'No successful charge' };
  }
  return { tone: 'pill-info' as PillTone, value: `Payment ${humanizeStatus(status)}` };
}

function latestLocationSnapshot<T extends { recordedAt: string }>(snapshots: readonly T[]) {
  return [...snapshots].sort(
    (left, right) =>
      new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime(),
  )[0] ?? null;
}

function postMatchDecisionPanel(booking: AdminBookingDetail, nowMs: number): BookingPostMatchDecisionPanel {
  if (!isPostMatchCancellationBooking(booking)) {
    return hiddenPostMatchDecisionPanel();
  }

  const feeState = postMatchCancellationFeeState(booking);
  const resolution = postMatchCancellationResolution(booking);
  const autoApprovalEligible = isPostMatchCancellationAutoApprovalEligible(booking);
  const autoApproved = isPostMatchCancellationAutoApproved(booking);
  const manualReviewRequired = isPostMatchCancellationManualReviewRequired(booking);
  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  const source = postMatchCancellationDecisionSource(booking);
  const adminDecision = postMatchCancellationAdminDecision(booking);
  const sla = postMatchCancellationDecisionSla(booking, nowMs);
  const paymentChange = postMatchDecisionCustomerMoneyChange(booking);
  const feeChange = postMatchDecisionPartnerFeeChange(booking);
  const canResolveSafely = resolution === 'pending' && paymentChange.safe && feeChange.safe;

  return {
    visible: true,
    canResolve: canResolveSafely,
    actions: canResolveSafely
      ? postMatchDecisionActions(paymentChange.action, feeChange.hasRetainableFee)
      : [],
    blockedReason:
      resolution === 'pending'
        ? paymentChange.blockedReason ?? feeChange.blockedReason
        : undefined,
    customerMoneyBefore: paymentChange.before,
    customerMoneyAfter: paymentChange.after,
    partnerFeeBefore: feeChange.before,
    partnerFeeApproveAfter: feeChange.approveAfter,
    partnerFeeHoldAfter: feeChange.holdAfter,
    reviewBefore: source === 'open' ? 'Open decision' : postMatchCancellationResolutionLabel(resolution, autoApproved),
    reviewAfter: 'Resolved by Admin',
    feeLabel: source === 'open' ? 'Fee outcome pending' : postMatchCancellationFeeStateLabel(feeState),
    feeTone: source === 'open' ? 'pill-warn' : postMatchCancellationFeeStateTone(feeState),
    feeAmountLabel: booking.earning
      ? money(booking.earning.netAmount, booking.earning.currency)
      : 'No Partner fee amount',
    decisionAt: postMatchCancellationDecisionAt(booking),
    decidedBy: adminDecision?.actorName ?? null,
    decisionReasonLabel: adminDecision?.decisionReasonLabel ?? null,
    operatorNote: adminDecision?.operatorNote ?? null,
    sourceLabel: postMatchCancellationDecisionSourceLabel(source),
    sourceTone: postMatchCancellationDecisionSourceTone(source),
    slaLabel: source === 'open' ? sla.label : 'Decision closed',
    slaTone: source === 'open' ? (sla.overdue ? 'pill-danger' : 'pill-info') : 'pill-neutral',
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

function outcomePrimaryAction(kind: BookingOutcomeKind, bookingId: string, returnHref?: string) {
  if (kind === 'post-match-cancel' || kind === 'no-show') {
    const workspace = postMatchCancellationWorkspaceFromHref(returnHref) ?? {
      href: '/bookings/post-match-cancellations?view=manual-decision',
      label: 'Needs decision' as const,
    };
    return {
      primaryHref: workspace.href.includes('#') ? workspace.href : `${workspace.href}#booking-${bookingId}`,
      primaryLabel: `Back to ${workspace.label}`,
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
    actions: [],
    customerMoneyBefore: '',
    customerMoneyAfter: '',
    partnerFeeBefore: '',
    partnerFeeApproveAfter: '',
    reviewBefore: '',
    reviewAfter: '',
    feeLabel: '',
    feeTone: 'pill-neutral',
    feeAmountLabel: '',
    decisionAt: null,
    sourceLabel: '',
    sourceTone: 'pill-neutral',
    slaLabel: '',
    slaTone: 'pill-neutral',
    resolutionLabel: '',
    resolutionTone: 'pill-neutral',
    timingLabel: '',
    timingTone: 'pill-neutral',
  };
}

function postMatchDecisionCustomerMoneyChange(booking: AdminBookingDetail) {
  const payment = booking.payment;
  if (!payment || payment.method.toUpperCase() === 'CASH') {
    return {
      action: 'Close review',
      after: 'No customer funds movement',
      before: 'No customer funds held by HANDS',
      safe: true,
    };
  }

  const amount = money(payment.amount, payment.currency);
  const method = payment.method.toUpperCase();
  const status = payment.status.toUpperCase();
  if (status === 'RELEASED' || status === 'REFUNDED') {
    return {
      action: 'Approve cancellation outcome',
      after: status === 'REFUNDED' ? 'Customer refund already completed' : 'Customer authorization already released',
      before: `${amount} · ${humanizeStatus(status)}`,
      safe: true,
    };
  }
  if (status === 'CAPTURED') {
    return {
      action: 'Approve & request customer refund',
      after: 'Refund request will be created · Finance approval still required',
      before: `${amount} captured`,
      safe: true,
    };
  }
  if (method === 'CUSTOMER_WALLET' && status === 'AUTHORIZED') {
    return {
      action: `Approve & release ${amount}`,
      after: `${amount} wallet hold released`,
      before: `${amount} wallet hold`,
      safe: true,
    };
  }
  if (method !== 'CUSTOMER_WALLET' && (status === 'AUTHORIZED' || status === 'PENDING')) {
    return {
      action: 'Approve & release customer authorization',
      after: `${amount} authorization released`,
      before: `${amount} authorization open`,
      safe: true,
    };
  }

  return {
    action: 'Cannot resolve safely',
    after: 'Payment state must be corrected before this review can close',
    before: `${amount} · ${method} · ${status}`,
    blockedReason: `Customer payment is ${humanizeStatus(status)} and cannot be closed safely from this review.`,
    safe: false,
  };
}

function postMatchDecisionPartnerFeeChange(booking: AdminBookingDetail) {
  const earning = booking.earning;
  if (!earning || earning.netAmount === 0) {
    return {
      approveAfter: 'No Partner fee movement',
      before: 'No Partner fee record · no fee amount to decide',
      hasRetainableFee: false,
      safe: true,
    };
  }

  const amount = money(Math.abs(earning.netAmount), earning.currency);
  const hasRetainableFee = earning.status === 'PENDING' && earning.netAmount < 0;
  if (!hasRetainableFee) {
    return {
      approveAfter: 'Partner fee state must be reconciled first',
      before: `${money(earning.netAmount, earning.currency)} · ${earning.status}`,
      blockedReason: 'Partner earning state cannot be resolved safely from this review.',
      hasRetainableFee: false,
      safe: false,
    };
  }

  return {
    approveAfter: `${amount} deduction waived · Partner wallet restored`,
    before: `${amount} Partner fee deduction pending`,
    hasRetainableFee: true,
    holdAfter: `${amount} Partner fee deduction kept`,
    safe: true,
  };
}

function postMatchDecisionActions(customerAction: string, hasRetainableFee: boolean) {
  if (!hasRetainableFee) {
    return [
      {
        decision: 'approve' as const,
        helper: 'Close the review using the customer money result shown above.',
        label: customerAction === 'Close review' ? 'Close review — no money movement' : customerAction,
        tone: 'primary' as const,
      },
    ];
  }

  const customerClause = customerAction.replace(/^Approve(?: cancellation outcome)?(?: & )?/, '');
  return [
    {
      decision: 'approve' as const,
      helper: 'Apply the customer closeout and restore the Partner fee impact.',
      label: `Approve${customerClause ? `, ${customerClause.toLowerCase()}` : ''} & waive Partner fee`,
      tone: 'primary' as const,
    },
    {
      decision: 'hold' as const,
      helper: 'Apply the same customer closeout and keep the existing Partner fee deduction.',
      label: `${customerClause || 'Close customer payment'} & keep Partner fee`,
      tone: 'secondary' as const,
    },
  ];
}

function compactOutcomeClosureDetail(detail: string, fallback: string) {
  if (/terminal but has no explicit closure actor\/reason saved/i.test(detail)) {
    return fallback;
  }
  if (/^no closure has been recorded yet\.?$/i.test(detail)) {
    return fallback;
  }

  const normalized = detail
    .replace(/^\s*[^·/]*?\bclosure\s*[·/]\s*/i, '')
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
