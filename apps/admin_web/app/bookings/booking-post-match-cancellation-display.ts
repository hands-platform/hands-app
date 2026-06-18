import {
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

export function postMatchCancellationResolutionLabel(
  resolution: ReturnType<typeof postMatchCancellationResolution>,
  autoApproved = false,
) {
  switch (resolution) {
    case 'approved':
      return autoApproved ? 'Auto-approved' : 'Approved';
    case 'held':
      return 'Held';
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
