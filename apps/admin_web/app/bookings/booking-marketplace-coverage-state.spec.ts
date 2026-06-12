import {
  firstPickCoverageStateFromFacts,
  marketplaceBookingNextActionFromFacts,
  type FirstPickCoverageFacts,
  type MarketplaceBookingNextActionFacts,
} from './booking-marketplace-coverage-state';

function firstPickFacts(overrides: Partial<FirstPickCoverageFacts> = {}): FirstPickCoverageFacts {
  return {
    backupSelected: false,
    firstPickPending: false,
    hasPreferredProvider: true,
    matchingWindowExpired: false,
    preferredProviderState: null,
    status: 'OPEN_MATCHING',
    ...overrides,
  };
}

function nextActionFacts(
  overrides: Partial<MarketplaceBookingNextActionFacts> = {},
): MarketplaceBookingNextActionFacts {
  return {
    cashDebtNeedsOps: false,
    chatRepairNeedsOps: false,
    customerSelectableCount: 0,
    firstPickPending: false,
    hasFinalPartner: false,
    marketplaceParticipantCount: 1,
    matchingWindowExpired: false,
    status: 'OPEN_MATCHING',
    ...overrides,
  };
}

describe('marketplace booking coverage state', () => {
  it('builds first-pick coverage copy by priority', () => {
    expect(firstPickCoverageStateFromFacts(firstPickFacts({ hasPreferredProvider: false }))).toEqual({
      label: 'Open marketplace',
      tone: 'pill-neutral',
    });
    expect(firstPickCoverageStateFromFacts(firstPickFacts({ backupSelected: true }))).toEqual({
      label: 'Marketplace selected',
      tone: 'pill-success',
    });
    expect(firstPickCoverageStateFromFacts(firstPickFacts({ status: 'MATCHED' }))).toEqual({
      label: 'First-pick matched',
      tone: 'pill-success',
    });
    expect(
      firstPickCoverageStateFromFacts(firstPickFacts({ preferredProviderState: 'declined' })),
    ).toEqual({ label: 'First-pick declined', tone: 'pill-info' });
    expect(firstPickCoverageStateFromFacts(firstPickFacts({ matchingWindowExpired: true }))).toEqual({
      label: 'First-pick overdue',
      tone: 'pill-danger',
    });
    expect(firstPickCoverageStateFromFacts(firstPickFacts({ firstPickPending: true }))).toEqual({
      label: 'First-pick pending',
      tone: 'pill-warn',
    });
  });

  it('builds marketplace next-action copy by operational priority', () => {
    expect(marketplaceBookingNextActionFromFacts(nextActionFacts({ cashDebtNeedsOps: true }))).toEqual({
      label: 'Clear cash fee debt',
      tone: 'pill-danger',
    });
    expect(marketplaceBookingNextActionFromFacts(nextActionFacts({ chatRepairNeedsOps: true }))).toEqual({
      label: 'Repair chat handoff',
      tone: 'pill-danger',
    });
    expect(marketplaceBookingNextActionFromFacts(nextActionFacts({ matchingWindowExpired: true }))).toEqual({
      label: 'Review expired timer',
      tone: 'pill-danger',
    });
    expect(
      marketplaceBookingNextActionFromFacts(nextActionFacts({ customerSelectableCount: 2 })),
    ).toEqual({ label: 'Customer final choice', tone: 'pill-warn' });
    expect(
      marketplaceBookingNextActionFromFacts(nextActionFacts({ marketplaceParticipantCount: 0 })),
    ).toEqual({ label: 'Nudge marketplace supply', tone: 'pill-warn' });
    expect(marketplaceBookingNextActionFromFacts(nextActionFacts({ firstPickPending: true }))).toEqual({
      label: 'Wait for first-pick',
      tone: 'pill-warn',
    });
    expect(
      marketplaceBookingNextActionFromFacts(
        nextActionFacts({ hasFinalPartner: true, status: 'MATCHED' }),
      ),
    ).toEqual({ label: 'Monitor handoff', tone: 'pill-success' });
  });
});
