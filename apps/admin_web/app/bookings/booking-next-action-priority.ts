import type { BookingCheckLevelFlag } from '../../lib/booking-check-level';
import type { BookingActionPriority } from './booking-command-display';

export type BookingNextActionPriorityInput = {
  readonly completedCloseoutNeedsOps: () => boolean;
  readonly flagSeverity?: BookingCheckLevelFlag['severity'] | null;
  readonly locationNeedsOps: () => boolean;
  readonly paymentNeedsOps: () => boolean;
  readonly status?: string | null;
};

const p0ActionPriorityStatuses = new Set(['NO_SHOW', 'EXPIRED']);
const p1ActionPriorityStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY']);
const p2ActionPriorityStatuses = new Set(['OPEN_MATCHING', 'ARRIVED', 'IN_SERVICE']);

export function bookingNextActionPriorityFromFacts(
  input: BookingNextActionPriorityInput,
): BookingActionPriority {
  if (bookingNeedsP0Action(input)) {
    return 'P0';
  }
  if (bookingNeedsP1Action(input)) {
    return 'P1';
  }
  if (p2ActionPriorityStatuses.has(input.status ?? '')) {
    return 'P2';
  }
  return 'P3';
}

export function bookingCheckFlagSeverityWeight(
  severity?: BookingCheckLevelFlag['severity'] | null,
) {
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  if (severity === 'low') {
    return 1;
  }
  return 0;
}

function bookingNeedsP0Action(input: BookingNextActionPriorityInput) {
  return (
    input.flagSeverity === 'high' ||
    p0ActionPriorityStatuses.has(input.status ?? '') ||
    input.paymentNeedsOps() ||
    input.completedCloseoutNeedsOps()
  );
}

function bookingNeedsP1Action(input: BookingNextActionPriorityInput) {
  return (
    input.flagSeverity === 'medium' ||
    p1ActionPriorityStatuses.has(input.status ?? '') ||
    input.locationNeedsOps()
  );
}
