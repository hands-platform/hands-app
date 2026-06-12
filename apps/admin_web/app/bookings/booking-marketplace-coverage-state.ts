import type { MarketplaceBookingCoverageTone } from '../../lib/marketplace-booking-coverage';

export type MarketplaceCoveragePillState = {
  readonly label: string;
  readonly tone: MarketplaceBookingCoverageTone;
};

export type FirstPickCoverageFacts = {
  readonly backupSelected: boolean;
  readonly firstPickPending: boolean;
  readonly hasPreferredProvider: boolean;
  readonly matchingWindowExpired: boolean;
  readonly preferredProviderState: string | null;
  readonly status: string;
};

export type MarketplaceBookingNextActionFacts = {
  readonly cashDebtNeedsOps: boolean;
  readonly chatRepairNeedsOps: boolean;
  readonly customerSelectableCount: number;
  readonly firstPickPending: boolean;
  readonly hasFinalPartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly matchingWindowExpired: boolean;
  readonly status: string;
};

export function firstPickCoverageStateFromFacts(
  facts: FirstPickCoverageFacts,
): MarketplaceCoveragePillState {
  if (!facts.hasPreferredProvider) {
    return { label: 'Open marketplace', tone: 'pill-neutral' };
  }
  if (facts.backupSelected) {
    return { label: 'Marketplace selected', tone: 'pill-success' };
  }
  if (facts.status === 'MATCHED') {
    return { label: 'First-pick matched', tone: 'pill-success' };
  }
  if (facts.preferredProviderState === 'declined') {
    return { label: 'First-pick declined', tone: 'pill-info' };
  }
  if (facts.matchingWindowExpired) {
    return { label: 'First-pick overdue', tone: 'pill-danger' };
  }
  if (facts.firstPickPending) {
    return { label: 'First-pick pending', tone: 'pill-warn' };
  }
  return { label: 'First-pick recorded', tone: 'pill-info' };
}

export function marketplaceBookingNextActionFromFacts(
  facts: MarketplaceBookingNextActionFacts,
): MarketplaceCoveragePillState {
  if (facts.cashDebtNeedsOps) {
    return { label: 'Clear cash fee debt', tone: 'pill-danger' };
  }
  if (facts.chatRepairNeedsOps) {
    return { label: 'Repair chat handoff', tone: 'pill-danger' };
  }
  if (facts.status === 'OPEN_MATCHING' && facts.matchingWindowExpired) {
    return { label: 'Review expired timer', tone: 'pill-danger' };
  }
  if (facts.status === 'OPEN_MATCHING' && facts.customerSelectableCount > 0) {
    return { label: 'Customer final choice', tone: 'pill-warn' };
  }
  if (facts.status === 'OPEN_MATCHING' && facts.marketplaceParticipantCount === 0) {
    return { label: 'Nudge marketplace supply', tone: 'pill-warn' };
  }
  if (facts.status === 'OPEN_MATCHING' && facts.firstPickPending) {
    return { label: 'Wait for first-pick', tone: 'pill-warn' };
  }
  if (facts.hasFinalPartner) {
    return { label: 'Monitor handoff', tone: 'pill-success' };
  }
  return { label: 'Monitor', tone: 'pill-info' };
}
