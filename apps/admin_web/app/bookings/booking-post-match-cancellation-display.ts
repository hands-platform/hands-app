import {
  type BookingPostMatchCancellationDecisionSource,
  postMatchCancellationFeeState,
  postMatchCancellationResolution,
} from './booking-post-match-cancellations-model';

export type BookingPostMatchCancellationPillTone =
  | 'pill-danger'
  | 'pill-info'
  | 'pill-neutral'
  | 'pill-success'
  | 'pill-warn';

type TimingDisplayInput = {
  readonly autoApprovalEligible: boolean;
  readonly autoApproved: boolean;
  readonly manualReviewRequired: boolean;
  readonly minutesAfterMatch: number | null;
};

export function postMatchCancellationFeeStateLabel(
  feeState: ReturnType<typeof postMatchCancellationFeeState>,
) {
  switch (feeState) {
    case 'restored':
      return 'Fee restored';
    case 'held':
      return 'Fee held';
    default:
      return 'No earning';
  }
}

export function postMatchCancellationFeeStateTone(
  feeState: ReturnType<typeof postMatchCancellationFeeState>,
): BookingPostMatchCancellationPillTone {
  switch (feeState) {
    case 'restored':
      return 'pill-success';
    case 'held':
      return 'pill-danger';
    default:
      return 'pill-neutral';
  }
}

export function postMatchCancellationMinutesLabel(minutesAfterMatch: number | null) {
  if (minutesAfterMatch === null) {
    return 'Match time missing';
  }
  return `${minutesAfterMatch}m after match`;
}

export function postMatchCancellationDecisionSourceLabel(
  source: BookingPostMatchCancellationDecisionSource,
) {
  switch (source) {
    case 'auto-resolved':
      return 'Auto-resolved';
    case 'admin-approved':
      return 'Admin approved';
    case 'admin-held':
      return 'Admin kept fee';
    case 'legacy':
      return 'Unknown / legacy';
    default:
      return 'Needs decision';
  }
}

export function postMatchCancellationDecisionSourceTone(
  source: BookingPostMatchCancellationDecisionSource,
): BookingPostMatchCancellationPillTone {
  if (source === 'admin-approved' || source === 'auto-resolved') return 'pill-success';
  if (source === 'admin-held') return 'pill-danger';
  return source === 'open' ? 'pill-warn' : 'pill-neutral';
}

export function postMatchCancellationActorLabel(value?: string | null) {
  if (value?.toUpperCase() === 'PROVIDER') return 'Partner cancelled';
  if (value?.toUpperCase() === 'ADMIN') return 'Admin decision';
  if (value?.toUpperCase() === 'CUSTOMER') return 'Customer cancelled';
  return 'Cancellation actor unavailable';
}

export function postMatchCancellationResolutionLabel(
  resolution: ReturnType<typeof postMatchCancellationResolution>,
  autoApproved = false,
) {
  switch (resolution) {
    case 'approved':
      return autoApproved ? 'Auto-approved' : 'Approved';
    case 'held':
      return 'On hold';
    case 'legacy':
      return 'Unknown / legacy';
    default:
      return 'Pending admin decision';
  }
}

export function postMatchCancellationResolutionTone(
  resolution: ReturnType<typeof postMatchCancellationResolution>,
): BookingPostMatchCancellationPillTone {
  switch (resolution) {
    case 'approved':
      return 'pill-success';
    case 'held':
      return 'pill-danger';
    case 'legacy':
      return 'pill-neutral';
    default:
      return 'pill-warn';
  }
}

export function postMatchCancellationTimingLabel(input: TimingDisplayInput) {
  if (input.autoApproved) {
    return 'Auto-approved';
  }
  if (input.autoApprovalEligible) {
    return 'Within 15m';
  }
  if (input.manualReviewRequired) {
    return postMatchCancellationMinutesLabel(input.minutesAfterMatch);
  }
  return 'Review locked';
}

export function postMatchCancellationTimingTone(
  input: TimingDisplayInput,
): BookingPostMatchCancellationPillTone {
  if (input.autoApproved || input.autoApprovalEligible) {
    return 'pill-info';
  }
  if (input.manualReviewRequired) {
    return 'pill-warn';
  }
  return 'pill-neutral';
}
