import { partnerReviewModeContent } from './partner-review-mode';

describe('partner review mode content', () => {
  it('explains the unapproved partner approval and hold workflow', () => {
    const content = partnerReviewModeContent('unapproved');

    expect(content?.title).toBe('Unapproved Partners');
    expect(content?.detailFocus).toContain('Partner detail page');
    expect(content?.detailFocus).toContain('approve or hold');
    expect(content?.steps.join(' ')).toContain('Partner app');
  });

  it('explains unsettled partner wallet settlement risk', () => {
    const content = partnerReviewModeContent('unsettled');

    expect(content?.title).toBe('Unsettled Partners');
    expect(content?.detailFocus).toContain('wallet ledger');
    expect(content?.steps.join(' ')).toContain('marketplace alerts');
  });

  it('stays hidden for ordinary partner views', () => {
    expect(partnerReviewModeContent('')).toBeNull();
    expect(partnerReviewModeContent('kyc')).toBeNull();
  });
});
