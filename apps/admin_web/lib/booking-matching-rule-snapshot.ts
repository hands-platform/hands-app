export type BookingMatchingPolicySnapshot = {
  readonly providerResponseWindowMinutes: number | null;
  readonly backupProviderRadiusMeters: number | null;
  readonly backupProviderLocationMaxAgeMinutes: number | null;
  readonly backupProviderInvitationLimit: number | null;
  readonly preferredAcceptMode: string | null;
  readonly backupOpenMode: string | null;
  readonly travelBufferMinutes: number | null;
};

export type BookingMatchingRuleSnapshot = {
  readonly sourceLabel: string;
  readonly sourceTone: string;
  readonly windowLabel: string;
  readonly radiusLabel: string;
  readonly supplyLabel: string;
  readonly customerChoiceLabel: string;
  readonly operatorAction: string;
};

export type BookingMatchingRuleSnapshotInput = {
  readonly hasChatRoom: boolean;
  readonly isTerminalStatus: boolean;
  readonly marketplaceCount: number;
  readonly openMatchingWindowLabel: string;
  readonly policy: BookingMatchingPolicySnapshot | null;
  readonly selectableCount: number;
  readonly selectedPartnerLabel: string | null;
  readonly status: string;
  readonly totalNotified: number;
};

export function matchingPolicySummaryLabel(snapshot: BookingMatchingPolicySnapshot | null) {
  if (!snapshot) {
    return 'Matching policy: live policy default';
  }
  const timer = snapshot.providerResponseWindowMinutes
    ? `${snapshot.providerResponseWindowMinutes}m`
    : 'timer ?';
  const radius = snapshot.backupProviderRadiusMeters
    ? `${(snapshot.backupProviderRadiusMeters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })}km`
    : 'radius ?';
  const freshness = snapshot.backupProviderLocationMaxAgeMinutes
    ? `${snapshot.backupProviderLocationMaxAgeMinutes}m fresh`
    : 'freshness ?';
  const inviteLimit = snapshot.backupProviderInvitationLimit
    ? `${snapshot.backupProviderInvitationLimit} invite cap`
    : 'invite cap ?';
  const backupMode =
    snapshot.backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
      ? 'marketplace immediate'
      : snapshot.backupOpenMode === 'AFTER_FIRST_PICK_DELAY' ||
          snapshot.backupOpenMode === 'DELAYED_UNTIL_FIRST_PICK_EXPIRES' ||
          snapshot.backupOpenMode === 'DELAYED_UNTIL_FIRST_WINDOW_END'
        ? 'marketplace immediate (legacy normalized)'
        : 'marketplace ?';
  const acceptMode =
    adminPreferredAcceptModeUsesFirstPickPriority(snapshot.preferredAcceptMode)
      ? 'first-pick accept matches / customer fallback'
      : snapshot.preferredAcceptMode === 'AUTO_MATCH_ON_ACCEPT'
        ? 'first-pick accept matches (legacy alias)'
        : 'accept ?';
  return `Saved policy: ${timer} / ${radius} / ${freshness} / ${inviteLimit} / ${backupMode} / ${acceptMode}`;
}

export function buildBookingMatchingRuleSnapshot(
  input: BookingMatchingRuleSnapshotInput,
): BookingMatchingRuleSnapshot {
  const responseWindow = input.policy?.providerResponseWindowMinutes ?? 10;
  const marketplaceRadius = input.policy?.backupProviderRadiusMeters ?? 10_000;
  const customerChoice = input.selectedPartnerLabel
    ? `Customer final choice: ${input.selectedPartnerLabel}`
    : input.selectableCount > 0
      ? `Customer final choice: waiting, ${input.selectableCount} selectable Partner(s)`
      : 'Customer final choice: not ready yet';

  return {
    sourceLabel: input.policy ? 'Saved matching snapshot' : 'Default MVP rule',
    sourceTone: input.policy ? 'pill-info' : 'pill-warn',
    windowLabel: `First-pick window: ${responseWindow}m / ${matchingWindowState(input)}`,
    radiusLabel: `Marketplace radius: ${formatMeters(marketplaceRadius)} from booking address`,
    supplyLabel: `Marketplace supply: ${input.marketplaceCount} participants / ${input.selectableCount} selectable / ${input.totalNotified} notified`,
    customerChoiceLabel: `${customerChoice}; no automatic assignment`,
    operatorAction: bookingMatchingRuleOperatorAction(input),
  };
}

function matchingWindowState(input: BookingMatchingRuleSnapshotInput) {
  if (input.status === 'OPEN_MATCHING') {
    return input.openMatchingWindowLabel;
  }
  if (input.isTerminalStatus) {
    return 'closed';
  }
  if (input.selectedPartnerLabel) {
    return 'final Partner selected';
  }
  return 'not in open matching';
}

function bookingMatchingRuleOperatorAction(input: BookingMatchingRuleSnapshotInput) {
  if (input.selectedPartnerLabel) {
    return input.hasChatRoom
      ? 'Chat is ready. Continue service handoff and closeout from booking detail.'
      : 'Final Partner exists. Repair or create chat before service movement continues.';
  }
  if (input.status !== 'OPEN_MATCHING') {
    return 'Open booking detail and continue from the latest factual status.';
  }
  if (input.selectableCount > 0) {
    return 'Customer fallback selection is needed because first-pick did not validly win; do not auto-assign.';
  }
  if (input.marketplaceCount > 0) {
    return 'Marketplace Partners are visible. Monitor customer choice list and Partner response evidence.';
  }
  if (input.totalNotified > 0) {
    return 'Push invitations were sent. Watch for Partner participation before the first-pick window closes.';
  }
  return 'No marketplace supply is visible yet. Check Partner radius, location freshness, and notification trace.';
}

function formatMeters(value: number | null) {
  if (value === null) {
    return 'unknown';
  }
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  return `${value.toLocaleString('en')} m`;
}
import { adminPreferredAcceptModeUsesFirstPickPriority } from './operations-policy';
