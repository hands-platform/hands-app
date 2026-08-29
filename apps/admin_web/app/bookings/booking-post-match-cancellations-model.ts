import type { AdminBooking, AdminBookingDetail } from '../../lib/admin-api';
import { readPlainRecord } from '../../lib/admin-format';
import { ADMIN_START_SHIFT_ACTION_SLA_DEFAULTS } from '../../lib/operations-policy';
import {
  postMatchCancellationReasonCode,
  postMatchCancellationRequiresAdminReview,
} from './booking-post-match-cancellation-reason';

export const POST_MATCH_CANCELLATION_REVIEW_MINUTES = 15;
export const POST_MATCH_CANCELLATION_DECISION_SLA_MINUTES =
  ADMIN_START_SHIFT_ACTION_SLA_DEFAULTS.cancellationReview;

const POST_MATCH_CANCELLATION_APPROVED_REASON = 'post_match_cancellation_approved';
const POST_MATCH_CANCELLATION_HELD_REASON = 'post_match_cancellation_fee_held';

export type BookingPostMatchCancellationResolution = 'approved' | 'held' | 'legacy' | 'pending';
export type BookingPostMatchCancellationDecisionSource =
  | 'admin-approved'
  | 'admin-held'
  | 'auto-resolved'
  | 'legacy'
  | 'open';

export type BookingPostMatchCancellationAdminDecision = {
  readonly action: 'approve' | 'hold';
  readonly actorName: string | null;
  readonly decidedAt: string;
  readonly decisionReason: string | null;
  readonly decisionReasonLabel: string | null;
  readonly operatorNote: string | null;
  readonly originalActorRole: string | null;
  readonly originalNote: string | null;
  readonly originalReason: string | null;
};

export type BookingPostMatchCancellationBoard = {
  readonly autoApprovedCount: number;
  readonly autoApprovalWindowCount: number;
  readonly feeHeldCount: number;
  readonly feeRestoredCount: number;
  readonly monthCount: number;
  readonly pendingManualReviewCount: number;
  readonly totalCount: number;
};

export type BookingPostMatchCancellationTimeDisplay = {
  readonly ageLabel: 'Resolved' | 'Waiting';
  readonly ageMinutes: number | null;
  readonly timestamp: string | null;
  readonly timestampLabel: 'Decided at' | 'Resolved at' | 'Review started';
};

export function buildBookingPostMatchCancellationBoard(
  bookings: readonly AdminBooking[],
  nowMs: number,
): BookingPostMatchCancellationBoard {
  const cancellations = bookings.filter(isPostMatchCancellationReviewBooking);

  return {
    autoApprovedCount: cancellations.filter(isPostMatchCancellationAutoApproved).length,
    autoApprovalWindowCount: cancellations.filter(isPostMatchCancellationAutoApprovalEligible).length,
    feeHeldCount: cancellations.filter((booking) => postMatchCancellationFeeState(booking) === 'held').length,
    feeRestoredCount: cancellations.filter(
      (booking) => postMatchCancellationResolution(booking) === 'approved',
    ).length,
    monthCount: cancellations.filter((booking) =>
      isSameMonth(bookingPostMatchCancellationTime(booking), nowMs),
    ).length,
    pendingManualReviewCount: cancellations.filter(isPostMatchCancellationManualReviewRequired).length,
    totalCount: cancellations.length,
  };
}

export function isPostMatchCancellationBooking(booking: AdminBooking) {
  return booking.status === 'CANCELLED' && bookingHasPostMatchEvidence(booking);
}

export function isPostMatchCancellationReviewBooking(booking: AdminBooking) {
  return (
    (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') &&
    bookingHasPostMatchEvidence(booking)
  );
}

export function bookingHasPostMatchEvidence(booking: AdminBooking) {
  return Boolean(booking.matchedAt || booking.selectedProviderId || booking.selectedProvider);
}

export function isPostMatchCancellationAutoApprovalEligible(booking: AdminBooking) {
  if (booking.status !== 'CANCELLED') {
    return false;
  }

  const reasonCode = postMatchCancellationReasonCode(booking);
  if (
    postMatchCancellationRequiresAdminReview(booking) ||
    (reasonCode !== null && reasonCode !== 'CUSTOMER_REQUESTED')
  ) {
    return false;
  }

  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  return minutesAfterMatch !== null && minutesAfterMatch <= POST_MATCH_CANCELLATION_REVIEW_MINUTES;
}

export function isPostMatchCancellationAutoApproved(booking: AdminBooking) {
  return postMatchCancellationDecisionSource(booking) === 'auto-resolved';
}

export function isPostMatchCancellationManualReviewRequired(booking: AdminBooking) {
  return postMatchCancellationDecisionSource(booking) === 'open';
}

export function postMatchCancellationMinutesAfterMatch(booking: AdminBooking) {
  const matchedAt = safeTime(booking.matchedAt ?? null);
  const closedAt = safeTime(bookingPostMatchCancellationTime(booking));
  if (matchedAt === null || closedAt === null || closedAt < matchedAt) {
    return null;
  }
  return Math.floor((closedAt - matchedAt) / 60_000);
}

export function postMatchCancellationResolution(
  booking: AdminBooking,
): BookingPostMatchCancellationResolution {
  const source = postMatchCancellationDecisionSource(booking);
  if (source === 'admin-held') return 'held';
  if (source === 'admin-approved' || source === 'auto-resolved') return 'approved';
  return source === 'legacy' ? 'legacy' : 'pending';
}

export function postMatchCancellationDecisionSource(
  booking: Pick<AdminBooking, 'closedByRole' | 'closedReason' | 'earning' | 'metadata'>,
): BookingPostMatchCancellationDecisionSource {
  const metadata = readPlainRecord(booking.metadata);
  const cancellation = readPlainRecord(metadata?.postMatchCancellation);
  if (cancellation?.autoApproved === true) return 'auto-resolved';

  const reason = booking.closedReason?.trim().toLowerCase() ?? '';
  const adminDecision = booking.closedByRole?.trim().toUpperCase() === 'ADMIN';
  if (adminDecision && reason === POST_MATCH_CANCELLATION_APPROVED_REASON) return 'admin-approved';
  if (adminDecision && reason === POST_MATCH_CANCELLATION_HELD_REASON) return 'admin-held';

  const hasLegacyResolution =
    reason === POST_MATCH_CANCELLATION_APPROVED_REASON ||
    reason === POST_MATCH_CANCELLATION_HELD_REASON ||
    booking.earning?.status === 'CANCELLED' ||
    booking.earning?.netAmount === 0;
  return hasLegacyResolution ? 'legacy' : 'open';
}

export function postMatchCancellationFeeState(booking: AdminBooking) {
  if (!booking.earning) {
    return 'none';
  }
  if (booking.earning.status === 'CANCELLED' || booking.earning.netAmount === 0) {
    return 'restored';
  }
  return 'held';
}

function bookingPostMatchCancellationTime(booking: AdminBooking) {
  return postMatchCancellationReviewStartedAt(booking);
}

export function postMatchCancellationDecisionAt(
  booking: AdminBooking | Pick<AdminBookingDetail, 'auditLogs'>,
) {
  const listDecisionAt =
    'postMatchCancellationDecisionAt' in booking
      ? firstValidTimestamp(booking.postMatchCancellationDecisionAt)
      : null;
  return listDecisionAt ?? postMatchCancellationAdminDecision(booking)?.decidedAt ?? null;
}

export function postMatchCancellationReviewStartedAt(
  booking: Pick<AdminBooking, 'closedAt' | 'createdAt' | 'updatedAt'>,
) {
  return firstValidTimestamp(booking.closedAt, booking.updatedAt, booking.createdAt);
}

export function postMatchCancellationDecisionAgeMinutes(
  booking: Pick<AdminBooking, 'closedAt' | 'createdAt' | 'updatedAt'>,
  nowMs: number,
) {
  return elapsedMinutes(postMatchCancellationReviewStartedAt(booking), nowMs);
}

export function postMatchCancellationDecisionSla(
  booking: Pick<AdminBooking, 'closedAt' | 'createdAt' | 'updatedAt'>,
  nowMs: number,
) {
  const ageMinutes = postMatchCancellationDecisionAgeMinutes(booking, nowMs);
  if (ageMinutes === null) return { ageMinutes, label: 'SLA unavailable', overdue: false } as const;
  return {
    ageMinutes,
    label: ageMinutes >= POST_MATCH_CANCELLATION_DECISION_SLA_MINUTES ? 'Overdue' : 'Within 2h',
    overdue: ageMinutes >= POST_MATCH_CANCELLATION_DECISION_SLA_MINUTES,
  } as const;
}

export function postMatchCancellationTimeDisplay(
  booking: AdminBooking,
  nowMs: number,
): BookingPostMatchCancellationTimeDisplay {
  const source = postMatchCancellationDecisionSource(booking);
  if (source === 'open') {
    const timestamp = postMatchCancellationReviewStartedAt(booking);
    return {
      ageLabel: 'Waiting',
      ageMinutes: postMatchCancellationDecisionAgeMinutes(booking, nowMs),
      timestamp,
      timestampLabel: 'Review started',
    };
  }

  const auditedDecisionAt =
    source === 'admin-approved' || source === 'admin-held'
      ? firstValidTimestamp(postMatchCancellationDecisionAt(booking))
      : null;
  const persistedResolutionAt =
    source === 'admin-approved' || source === 'admin-held'
      ? firstValidTimestamp(booking.updatedAt, booking.closedAt, booking.createdAt)
      : postMatchCancellationReviewStartedAt(booking);
  const timestamp = auditedDecisionAt ?? persistedResolutionAt;
  return {
    ageLabel: 'Resolved',
    ageMinutes: elapsedMinutes(timestamp, nowMs),
    timestamp,
    timestampLabel: auditedDecisionAt ? 'Decided at' : 'Resolved at',
  };
}

export function postMatchCancellationAdminDecision(
  booking: AdminBooking | Pick<AdminBookingDetail, 'auditLogs'>,
): BookingPostMatchCancellationAdminDecision | null {
  const auditLogs = 'auditLogs' in booking ? booking.auditLogs : undefined;
  const log = auditLogs?.find((entry) =>
    entry.action === 'booking.post_match_cancellation.approve' ||
    entry.action === 'booking.post_match_cancellation.hold',
  );
  if (!log) return null;

  const metadata = readPlainRecord(log.metadata);
  return {
    action: log.action.endsWith('.approve') ? 'approve' : 'hold',
    actorName: log.actor?.fullName?.trim() || log.actor?.email?.trim() || null,
    decidedAt: log.createdAt,
    decisionReason: stringFact(metadata?.decisionReason),
    decisionReasonLabel: stringFact(metadata?.decisionReasonLabel),
    operatorNote: stringFact(metadata?.operatorNote),
    originalActorRole: stringFact(metadata?.previousClosedByRole),
    originalNote: stringFact(metadata?.previousClosedNote),
    originalReason: stringFact(metadata?.previousClosedReason),
  };
}

function stringFact(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isSameMonth(value: string | null | undefined, nowMs: number) {
  const time = safeTime(value ?? null);
  if (time === null || !Number.isFinite(nowMs) || nowMs <= 0) {
    return false;
  }
  const date = new Date(time);
  const now = new Date(nowMs);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function safeTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function firstValidTimestamp(...values: readonly (string | null | undefined)[]) {
  return values.find((value) => safeTime(value) !== null) ?? null;
}

function elapsedMinutes(value: string | null | undefined, nowMs: number) {
  const timestamp = safeTime(value);
  if (timestamp === null || !Number.isFinite(nowMs) || nowMs < timestamp) return null;
  return Math.floor((nowMs - timestamp) / 60_000);
}
