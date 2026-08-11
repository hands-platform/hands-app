import {
  postMatchCancellationFeeStateLabel,
  postMatchCancellationFeeStateTone,
  postMatchCancellationMinutesLabel,
  postMatchCancellationResolutionLabel,
  postMatchCancellationResolutionTone,
  postMatchCancellationTimingLabel,
  postMatchCancellationTimingTone,
} from './booking-post-match-cancellation-display';

describe('booking post-match cancellation display', () => {
  it('keeps fee and resolution labels consistent across admin surfaces', () => {
    expect(postMatchCancellationFeeStateLabel('held')).toBe('Fee held');
    expect(postMatchCancellationFeeStateTone('held')).toBe('pill-danger');
    expect(postMatchCancellationFeeStateLabel('restored')).toBe('Fee restored');
    expect(postMatchCancellationFeeStateTone('restored')).toBe('pill-success');
    expect(postMatchCancellationFeeStateLabel('none')).toBe('No earning');
    expect(postMatchCancellationFeeStateTone('none')).toBe('pill-neutral');

    expect(postMatchCancellationResolutionLabel('pending')).toBe('Pending admin decision');
    expect(postMatchCancellationResolutionTone('pending')).toBe('pill-warn');
    expect(postMatchCancellationResolutionLabel('approved')).toBe('Approved');
    expect(postMatchCancellationResolutionLabel('approved', true)).toBe('Auto-approved');
    expect(postMatchCancellationResolutionTone('approved')).toBe('pill-success');
    expect(postMatchCancellationResolutionLabel('held')).toBe('On hold');
    expect(postMatchCancellationResolutionTone('held')).toBe('pill-danger');
  });

  it('keeps timing labels and tones consistent with the 15-minute rule', () => {
    expect(postMatchCancellationMinutesLabel(null)).toBe('Match time missing');
    expect(postMatchCancellationMinutesLabel(30)).toBe('30m after match');
    expect(
      postMatchCancellationTimingLabel({
        autoApprovalEligible: false,
        autoApproved: true,
        manualReviewRequired: false,
        minutesAfterMatch: 10,
      }),
    ).toBe('Auto-approved');
    expect(
      postMatchCancellationTimingLabel({
        autoApprovalEligible: true,
        autoApproved: false,
        manualReviewRequired: false,
        minutesAfterMatch: 10,
      }),
    ).toBe('Within 15m');
    expect(
      postMatchCancellationTimingLabel({
        autoApprovalEligible: false,
        autoApproved: false,
        manualReviewRequired: true,
        minutesAfterMatch: 30,
      }),
    ).toBe('30m after match');
    expect(
      postMatchCancellationTimingTone({
        autoApprovalEligible: false,
        autoApproved: false,
        manualReviewRequired: true,
        minutesAfterMatch: 30,
      }),
    ).toBe('pill-warn');
  });
});
