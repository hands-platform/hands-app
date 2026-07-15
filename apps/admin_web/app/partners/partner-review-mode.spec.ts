import {
  partnerPrimaryListMode,
  partnerDeepOpsAvailable,
  partnerReviewModeContent,
  shouldLoadPartnerDeepOps,
} from './partner-review-mode';

describe('partner review mode content', () => {
  it('explains the unapproved partner approval and hold workflow', () => {
    const content = partnerReviewModeContent('unapproved');

    expect(content?.title).toBe('Unapproved Partners');
    expect(content?.detailFocus).toContain('Partner detail page');
    expect(content?.detailFocus).toContain('approve or hold');
    expect(content?.detailFocus).not.toContain('bank');
    expect(content?.detailFocus).not.toContain('tax');
    expect(content?.steps.join(' ')).toContain('Partner app');
    expect(content?.steps.join(' ')).toContain('service profile');
    expect(content?.steps.join(' ')).not.toContain('withdrawal details');
    expect(content?.steps.join(' ')).not.toContain('tax');
  });

  it('explains unsettled partner wallet settlement risk', () => {
    const content = partnerReviewModeContent('unsettled');

    expect(content?.title).toBe('Unsettled Partners');
    expect(content?.detailFocus).toContain('wallet impact');
    expect(content?.detailFocus).toContain('final acceptance');
    expect(content?.steps.join(' ')).toContain('warning state');
  });

  it('stays hidden for ordinary partner views', () => {
    expect(partnerReviewModeContent('')).toBeNull();
    expect(partnerReviewModeContent('kyc')).toBeNull();
  });

  it('maps the primary partner pages to the same list-first shell', () => {
    expect(partnerPrimaryListMode('')).toBe('partners');
    expect(partnerPrimaryListMode('unapproved')).toBe('unapproved');
    expect(partnerPrimaryListMode('unsettled')).toBe('unsettled');
    expect(partnerPrimaryListMode('kyc')).toBe('partners');
  });

  it('loads secondary operations analysis only when a review queue explicitly requests it', () => {
    expect(partnerDeepOpsAvailable('')).toBe(false);
    expect(partnerDeepOpsAvailable('unapproved')).toBe(false);
    expect(partnerDeepOpsAvailable('unsettled')).toBe(false);
    expect(partnerDeepOpsAvailable('marketplace-ready')).toBe(false);
    expect(partnerDeepOpsAvailable('kyc')).toBe(true);
    expect(shouldLoadPartnerDeepOps('kyc', '')).toBe(false);
    expect(shouldLoadPartnerDeepOps('kyc', 'all')).toBe(true);
  });
});
