import type { AdminBooking } from '../../lib/admin-api';

export const POST_MATCH_CANCELLATION_REVIEW_MINUTES = 15;

export type BookingPostMatchCancellationResolution = 'approved' | 'held' | 'pending';

export type BookingPostMatchCancellationBoard = {
  readonly autoApprovedCount: number;
  readonly autoApprovalWindowCount: number;
  readonly feeHeldCount: number;
  readonly feeRestoredCount: number;
  readonly monthCount: number;
  readonly pendingManualReviewCount: number;
  readonly totalCount: number;
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

  const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
  return minutesAfterMatch !== null && minutesAfterMatch <= POST_MATCH_CANCELLATION_REVIEW_MINUTES;
}

export function isPostMatchCancellationAutoApproved(booking: AdminBooking) {
  return (
    postMatchCancellationResolution(booking) === 'approved' &&
    isPostMatchCancellationAutoApprovalEligible(booking)
  );
}

export function isPostMatchCancellationManualReviewRequired(booking: AdminBooking) {
  return (
    postMatchCancellationResolution(booking) === 'pending' &&
    !isPostMatchCancellationAutoApprovalEligible(booking)
  );
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
  const reason = booking.closedReason?.toLowerCase() ?? '';
  if (reason.includes('held') || reason.includes('hold')) {
    return 'held';
  }
  if (
    reason.includes('approved') ||
    booking.earning?.status === 'CANCELLED' ||
    booking.earning?.netAmount === 0
  ) {
    return 'approved';
  }
  return 'pending';
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
  return booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt ?? booking.createdAt ?? null;
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
