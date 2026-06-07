export type PreferredAwaitingDecisionInput = {
  hasPreferredPartner: boolean;
  preferredParticipantStatus?: string | null;
};

const decidedPreferredParticipantStatuses = new Set(['ACCEPTED', 'SELECTED', 'REJECTED']);

export function isPreferredAwaitingDecision(input: PreferredAwaitingDecisionInput): boolean {
  if (!input.hasPreferredPartner) {
    return false;
  }

  if (!input.preferredParticipantStatus) {
    return true;
  }

  return !decidedPreferredParticipantStatuses.has(input.preferredParticipantStatus);
}

export function bookingLocationTrail<T>(explicitSnapshots: T[] | undefined | null, latestLocation: T | null): T[] {
  if ((explicitSnapshots?.length ?? 0) > 0) {
    return explicitSnapshots ?? [];
  }

  return latestLocation ? [latestLocation] : [];
}
