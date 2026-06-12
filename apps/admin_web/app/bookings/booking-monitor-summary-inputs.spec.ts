import { bookingMonitorSummaryFactFromInputs } from './booking-monitor-summary-inputs';

describe('bookingMonitorSummaryFactFromInputs', () => {
  const base = {
    addressNeedsOps: false,
    backupSelected: false,
    chatEvidenceNeedsOps: false,
    chatRepairNeedsOps: false,
    closeoutNeedsOps: false,
    decisionEvidenceMissing: false,
    firstPickPending: false,
    locationNeedsOps: false,
    marketplaceParticipantCount: 0,
    matchingChatReady: false,
    participantCount: 0,
    paymentNeedsOps: false,
    policySnapshotPresent: false,
    pricingPolicyNeedsOps: false,
    refundReviewNeedsOps: false,
    stageKey: 'first-pick' as const,
    status: 'OPEN_MATCHING',
  };

  it('marks high-priority summary facts from check severities', () => {
    expect(
      bookingMonitorSummaryFactFromInputs({
        ...base,
        checkSeverities: ['medium', 'high'],
      }),
    ).toMatchObject({
      highPriorityCheck: true,
      status: 'OPEN_MATCHING',
    });
  });

  it('leaves summary facts low priority when no high severity exists', () => {
    expect(
      bookingMonitorSummaryFactFromInputs({
        ...base,
        checkSeverities: ['low', 'medium'],
      }),
    ).toMatchObject({
      highPriorityCheck: false,
    });
  });
});
