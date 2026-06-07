import {
  bookingAlertTraceSummaryFromMetadata,
  bookingAlertEvidenceNeedsOpsFromFacts,
  bookingPartnerChoiceEvidenceNeedsOpsFromFacts,
} from './booking-evidence-ops';

describe('booking evidence operations helpers', () => {
  it('requires partner choice evidence for open matching without a final selected partner', () => {
    expect(
      bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        hasSelectedProvider: false,
        hasPreferredProvider: false,
        acceptedOrSelectedParticipantCount: 0,
      }),
    ).toBe(true);

    expect(
      bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        hasSelectedProvider: false,
        hasPreferredProvider: true,
        acceptedOrSelectedParticipantCount: 0,
      }),
    ).toBe(false);

    expect(
      bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        hasSelectedProvider: false,
        hasPreferredProvider: true,
        acceptedOrSelectedParticipantCount: 1,
      }),
    ).toBe(true);
  });

  it('does not require partner choice evidence once final partner is selected or matching is closed', () => {
    expect(
      bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
        status: 'MATCHED',
        hasSelectedProvider: false,
        hasPreferredProvider: false,
        acceptedOrSelectedParticipantCount: 1,
      }),
    ).toBe(false);

    expect(
      bookingPartnerChoiceEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        hasSelectedProvider: true,
        hasPreferredProvider: true,
        acceptedOrSelectedParticipantCount: 1,
      }),
    ).toBe(false);
  });

  it('summarizes candidate alert notification traces from booking metadata', () => {
    expect(
      bookingAlertTraceSummaryFromMetadata({
        backupNotificationTraces: [
          { notifiedCount: 2, stage: 'first-pick', createdAt: '2026-06-07T01:00:00.000Z' },
          { notifiedCount: '3', stage: 'marketplace', createdAt: '2026-06-07T01:10:00.000Z' },
          { notifiedCount: 'not-a-number', stage: 'retry', createdAt: '2026-06-07T01:20:00.000Z' },
        ],
      }),
    ).toEqual({
      batchCount: 3,
      totalNotified: 5,
      lastStage: 'retry',
      lastCreatedAt: '2026-06-07T01:20:00.000Z',
    });
  });

  it('requires alert evidence when open matching has no participants and no retained notifications', () => {
    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        participantCount: 0,
        totalNotified: 0,
      }),
    ).toBe(true);

    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        participantCount: 0,
        totalNotified: 4,
      }),
    ).toBe(false);

    expect(
      bookingAlertEvidenceNeedsOpsFromFacts({
        status: 'OPEN_MATCHING',
        participantCount: 1,
        totalNotified: 0,
      }),
    ).toBe(false);
  });
});
