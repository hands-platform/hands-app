import {
  bookingMonitorSummaryRows,
  type BookingMonitorSummaryFact,
} from './booking-monitor-summary';

function fact(overrides: Partial<BookingMonitorSummaryFact> = {}): BookingMonitorSummaryFact {
  return {
    addressNeedsOps: false,
    backupSelected: false,
    chatEvidenceNeedsOps: false,
    chatRepairNeedsOps: false,
    closeoutNeedsOps: false,
    decisionEvidenceMissing: false,
    firstPickPending: false,
    highPriorityCheck: false,
    locationNeedsOps: false,
    marketplaceParticipantCount: 0,
    matchingChatReady: false,
    participantCount: 1,
    paymentNeedsOps: false,
    policySnapshotPresent: false,
    pricingPolicyNeedsOps: false,
    refundReviewNeedsOps: false,
    stageKey: 'first-pick',
    status: 'OPEN_MATCHING',
    ...overrides,
  };
}

function summaryByLabel(rows: ReturnType<typeof bookingMonitorSummaryRows>) {
  return Object.fromEntries(rows);
}

describe('booking monitor summary helpers', () => {
  it('counts booking stages and operational review flags', () => {
    const rows = summaryByLabel(
      bookingMonitorSummaryRows({
        blockedCreateAttemptCount: 3,
        bookings: [
          fact({
            firstPickPending: true,
            highPriorityCheck: true,
            participantCount: 0,
            stageKey: 'first-pick',
          }),
          fact({
            addressNeedsOps: true,
            backupSelected: true,
            chatRepairNeedsOps: true,
            marketplaceParticipantCount: 2,
            matchingChatReady: true,
            policySnapshotPresent: true,
            stageKey: 'marketplace',
          }),
          fact({
            chatEvidenceNeedsOps: true,
            closeoutNeedsOps: true,
            decisionEvidenceMissing: true,
            locationNeedsOps: true,
            paymentNeedsOps: true,
            pricingPolicyNeedsOps: true,
            refundReviewNeedsOps: true,
            stageKey: 'handoff-repair',
            status: 'MATCHED',
          }),
          fact({ stageKey: 'closeout', status: 'NO_SHOW' }),
          fact({ stageKey: 'closeout', status: 'EXPIRED' }),
        ],
      }),
    );

    expect(rows['Active bookings']).toBe('3');
    expect(rows['Open matching']).toBe('2');
    expect(rows['Matched']).toBe('1');
    expect(rows['Follow-up queue']).toBe('1');
    expect(rows['Blocked create attempts']).toBe('3');
    expect(rows['Stage 1 first-pick']).toBe('1');
    expect(rows['Stage 2 marketplace']).toBe('1');
    expect(rows['Stage 4 handoff repair']).toBe('1');
    expect(rows['No partners yet']).toBe('1');
    expect(rows['First-pick pending']).toBe('1');
    expect(rows['Marketplace options']).toBe('1');
    expect(rows['Marketplace selected']).toBe('1');
    expect(rows['Chat live']).toBe('1');
    expect(rows['No-show']).toBe('1');
    expect(rows['Expired']).toBe('1');
    expect(rows['Policy snapshots']).toBe('1');
    expect(rows['Address checks']).toBe('1');
    expect(rows['Payment checks']).toBe('1');
    expect(rows['Closeout checks']).toBe('1');
    expect(rows['Pricing checks']).toBe('1');
    expect(rows['Location checks']).toBe('1');
    expect(rows['Chat repair']).toBe('1');
    expect(rows['Chat evidence review']).toBe('1');
    expect(rows['Evidence missing']).toBe('1');
    expect(rows['Refund review']).toBe('1');
  });
});
