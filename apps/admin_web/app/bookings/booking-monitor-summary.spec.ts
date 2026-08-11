import {
  bookingMonitorSummaryRows,
  compactBookingMonitorSummaryRows,
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
    expect(rows['Preferred pending']).toBe('1');
    expect(rows['Marketplace open']).toBe('1');
    expect(rows['Handoff repair']).toBe('1');
    expect(rows['No Partners yet']).toBe('1');
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

  it('keeps core summary rows and hides zero-value supplemental rows', () => {
    const rows = compactBookingMonitorSummaryRows([
      ['Active bookings', '0'],
      ['Open matching', '0'],
      ['Matched', '0'],
      ['Follow-up queue', '0'],
      ['Blocked create attempts', '0'],
      ['Marketplace open', '0'],
      ['Policy snapshots', '7'],
      ['Payment checks', '2'],
      ['Chat repair', '0'],
    ]);
    const labels = rows.map(([label]) => label);

    expect(labels).toEqual([
      'Active bookings',
      'Open matching',
      'Matched',
      'Follow-up queue',
      'Blocked create attempts',
      'Payment checks',
    ]);
  });
});
