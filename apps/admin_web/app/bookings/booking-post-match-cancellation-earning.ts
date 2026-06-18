import type { AdminEarning } from '../../lib/admin-api';
import {
  type BookingPostMatchCancellationPillTone,
  postMatchCancellationFeeStateLabel,
  postMatchCancellationFeeStateTone,
  postMatchCancellationResolutionLabel,
  postMatchCancellationResolutionTone,
} from './booking-post-match-cancellation-display';

type EarningPostMatchCancellationFeeState = 'held' | 'none' | 'restored';
type EarningPostMatchCancellationResolution = 'approved' | 'held' | 'pending';

export type EarningPostMatchCancellationDisplay = {
  readonly decisionLabel: string;
  readonly decisionTone: BookingPostMatchCancellationPillTone;
  readonly feeLabel: string;
  readonly feeTone: BookingPostMatchCancellationPillTone;
};

export function isPostMatchCancellationEarning(earning: AdminEarning) {
  const booking = earning.booking;
  return Boolean(
    booking?.status === 'CANCELLED' && (booking.matchedAt || booking.selectedProviderId),
  );
}

export function postMatchCancellationEarningDisplay(
  earning: AdminEarning,
): EarningPostMatchCancellationDisplay | null {
  if (!isPostMatchCancellationEarning(earning)) {
    return null;
  }

  const resolution = postMatchCancellationEarningResolution(earning);
  const feeState = postMatchCancellationEarningFeeState(earning);
  const minutesAfterMatch = postMatchCancellationEarningMinutesAfterMatch(earning);
  const autoApproved = resolution === 'approved' && minutesAfterMatch !== null && minutesAfterMatch <= 15;

  return {
    decisionLabel: postMatchCancellationResolutionLabel(resolution, autoApproved),
    decisionTone: postMatchCancellationResolutionTone(resolution),
    feeLabel: postMatchCancellationFeeStateLabel(feeState),
    feeTone: postMatchCancellationFeeStateTone(feeState),
  };
}

export function postMatchCancellationEarningFeeState(
  earning: AdminEarning,
): EarningPostMatchCancellationFeeState {
  if (!isPostMatchCancellationEarning(earning)) {
    return 'none';
  }
  if (earning.status === 'CANCELLED' || earning.netAmount === 0) {
    return 'restored';
  }
  return 'held';
}

export function postMatchCancellationEarningResolution(
  earning: AdminEarning,
): EarningPostMatchCancellationResolution {
  const reason = earning.booking?.closedReason?.toLowerCase() ?? '';
  if (reason.includes('held') || reason.includes('hold')) {
    return 'held';
  }
  if (reason.includes('approved') || earning.status === 'CANCELLED' || earning.netAmount === 0) {
    return 'approved';
  }
  return 'pending';
}

function postMatchCancellationEarningMinutesAfterMatch(earning: AdminEarning) {
  const matchedAt = safeTime(earning.booking?.matchedAt ?? null);
  const closedAt = safeTime(
    earning.booking?.closedAt ?? earning.booking?.updatedAt ?? earning.createdAt ?? null,
  );
  if (matchedAt === null || closedAt === null || closedAt < matchedAt) {
    return null;
  }
  return Math.floor((closedAt - matchedAt) / 60_000);
}

function safeTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
