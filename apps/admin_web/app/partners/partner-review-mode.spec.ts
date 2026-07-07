import {
  partnerPrimaryListMode,
  partnerReviewModeContent,
  shouldRenderPartnerOperationsList,
  shouldRenderPartnerDeepOpsSections,
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
    expect(content?.detailFocus).toContain('wallet ledger');
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

  it('keeps deep operations boards out of the three primary partner pages', () => {
    expect(shouldRenderPartnerDeepOpsSections('')).toBe(false);
    expect(shouldRenderPartnerDeepOpsSections('unapproved')).toBe(false);
    expect(shouldRenderPartnerDeepOpsSections('unsettled')).toBe(false);
    expect(shouldRenderPartnerDeepOpsSections('marketplace-ready')).toBe(false);
    expect(shouldRenderPartnerDeepOpsSections('kyc')).toBe(true);
  });

  it('keeps the secondary operations list out of the three primary partner pages', () => {
    expect(shouldRenderPartnerOperationsList('')).toBe(false);
    expect(shouldRenderPartnerOperationsList('unapproved')).toBe(false);
    expect(shouldRenderPartnerOperationsList('unsettled')).toBe(false);
    expect(shouldRenderPartnerOperationsList('marketplace-ready')).toBe(false);
    expect(shouldRenderPartnerOperationsList('kyc')).toBe(true);
  });
});
