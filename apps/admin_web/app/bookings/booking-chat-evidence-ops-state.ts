export type BookingChatEvidenceNeedsOpsReaders = {
  readonly chatQuietNeedsOps: () => boolean;
  readonly chatReady: boolean;
  readonly chatRepairNeedsOps: () => boolean;
  readonly decisionEvidenceMissing: () => boolean;
  readonly manualDecisionNeedsOps: () => boolean;
  readonly refundReviewNeedsOps: () => boolean;
};

export type BookingDecisionEvidenceMissingReaders = {
  readonly chatRepairNeedsOps: () => boolean;
  readonly hasAlertTrace: () => boolean;
  readonly hasChatMessage: () => boolean;
  readonly hasProviderLocation: () => boolean;
  readonly manualDecisionNeedsOps: () => boolean;
};

export function bookingChatEvidenceNeedsOpsFromReaders(
  readers: BookingChatEvidenceNeedsOpsReaders,
): boolean {
  if (readers.chatRepairNeedsOps()) {
    return true;
  }
  if (readers.chatQuietNeedsOps()) {
    return true;
  }
  if (readers.decisionEvidenceMissing()) {
    return true;
  }
  if (readers.manualDecisionNeedsOps() && readers.chatReady) {
    return true;
  }
  return readers.refundReviewNeedsOps() && readers.chatReady;
}

export function bookingDecisionEvidenceMissingFromReaders(
  readers: BookingDecisionEvidenceMissingReaders,
): boolean {
  if (!readers.manualDecisionNeedsOps() && !readers.chatRepairNeedsOps()) {
    return false;
  }

  return !(
    readers.hasChatMessage() ||
    readers.hasProviderLocation() ||
    readers.hasAlertTrace()
  );
}
