import type { BookingListStageKey } from '../../lib/booking-list-stage';

export type BookingAlertEvidenceNeedsOpsInput = {
  readonly alertBatchCount?: number | null;
  readonly participantCount?: number | null;
  readonly stageKey: () => BookingListStageKey;
  readonly status?: string | null;
};

export function bookingAlertEvidenceNeedsOpsFromFacts(
  input: BookingAlertEvidenceNeedsOpsInput,
) {
  if ((input.alertBatchCount ?? 0) > 0) {
    return true;
  }
  if (input.status !== 'OPEN_MATCHING') {
    return false;
  }
  if ((input.participantCount ?? 0) === 0) {
    return true;
  }
  return input.stageKey() === 'marketplace';
}
