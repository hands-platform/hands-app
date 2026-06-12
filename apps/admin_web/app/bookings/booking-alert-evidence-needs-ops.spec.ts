import { bookingAlertEvidenceNeedsOpsFromFacts } from './booking-alert-evidence-needs-ops';

describe('bookingAlertEvidenceNeedsOpsFromFacts', () => {
  it('matches existing alert batches without reading the stage', () => {
    const stageKey = jest.fn(() => 'first-pick' as const);

    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        alertBatchCount: 1,
        participantCount: 3,
        stageKey,
        status: 'MATCHED',
      }),
    ).toBe(true);
    expect(stageKey).not.toHaveBeenCalled();
  });

  it('matches open matching bookings with no participants without reading the stage', () => {
    const stageKey = jest.fn(() => 'first-pick' as const);

    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        alertBatchCount: 0,
        participantCount: 0,
        stageKey,
        status: 'OPEN_MATCHING',
      }),
    ).toBe(true);
    expect(stageKey).not.toHaveBeenCalled();
  });

  it('matches marketplace-stage open matching bookings', () => {
    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        alertBatchCount: 0,
        participantCount: 2,
        stageKey: () => 'marketplace',
        status: 'OPEN_MATCHING',
      }),
    ).toBe(true);
  });

  it('ignores non-marketplace open matching and non-open bookings', () => {
    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        alertBatchCount: 0,
        participantCount: 2,
        stageKey: () => 'first-pick',
        status: 'OPEN_MATCHING',
      }),
    ).toBe(false);

    const stageKey = jest.fn(() => 'marketplace' as const);
    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        alertBatchCount: 0,
        participantCount: 2,
        stageKey,
        status: 'MATCHED',
      }),
    ).toBe(false);
    expect(stageKey).not.toHaveBeenCalled();
  });
});
