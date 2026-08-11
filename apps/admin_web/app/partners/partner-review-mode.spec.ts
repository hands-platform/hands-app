import {
  nextPartnerApprovalHref,
  partnerApprovalQueueDetailHref,
  partnerPrimaryListMode,
  partnerDeepOpsAvailable,
  partnerReviewModeContent,
  readPartnerDecisionQueue,
  shouldLoadPartnerDeepOps,
  withPartnerDecisionQueue,
} from './partner-review-mode';

describe('partner review mode content', () => {
  it('explains the approval-pending decision queue', () => {
    const content = partnerReviewModeContent('approval-pending');

    expect(content?.title).toBe('Partner approvals');
    expect(content?.description).toContain('waiting for an admin decision');
    expect(content?.detailFocus).toContain('oldest submission');
    expect(content?.steps.join(' ')).toContain('correction reason');
  });

  it('explains the onboarding blocker follow-up workflow', () => {
    const content = partnerReviewModeContent('unapproved');

    expect(content?.title).toBe('Onboarding blockers');
    expect(content?.detailFocus).toContain('Partner detail page');
    expect(content?.detailFocus).toContain('current blocker');
    expect(content?.detailFocus).not.toContain('bank');
    expect(content?.detailFocus).not.toContain('tax');
    expect(content?.steps.join(' ')).toContain('operator or the Partner');
    expect(content?.steps.join(' ')).toContain('one correction');
    expect(content?.steps.join(' ')).not.toContain('withdrawal details');
    expect(content?.steps.join(' ')).not.toContain('tax');
  });

  it('explains wallet debt settlement restrictions', () => {
    const content = partnerReviewModeContent('unsettled');

    expect(content?.title).toBe('Wallet debt');
    expect(content?.detailFocus).toContain('wallet ledger');
    expect(content?.detailFocus).toContain('final acceptance');
    expect(content?.steps.join(' ')).toContain('warning state');
  });

  it.each([
    ['customer-visibility-location', 'location heartbeat'],
    ['customer-visibility-service', 'customer-facing service assignment'],
    ['customer-visibility-bank', 'payout account'],
    ['customer-visibility-documents', 'front ID, back ID, and selfie'],
  ])('explains the %s Customer App blocker queue', (review, expectedDetail) => {
    const content = partnerReviewModeContent(review);

    expect(content?.badge).toBe('Customer App blocker');
    expect(content?.description).toContain('hidden from the Customer App');
    expect(content?.detailFocus).toContain(expectedDetail);
    expect(partnerDeepOpsAvailable(review)).toBe(false);
  });

  it('explains the Customer App visible-now public supply queue', () => {
    const content = partnerReviewModeContent('customer-visible-now');

    expect(content?.badge).toBe('Public supply');
    expect(content?.description).toContain('Customer App discovery');
    expect(content?.steps.join(' ')).toContain('blocker queues');
    expect(partnerDeepOpsAvailable('customer-visible-now')).toBe(false);
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
    expect(partnerDeepOpsAvailable('approval-pending')).toBe(false);
    expect(partnerDeepOpsAvailable('kyc')).toBe(true);
    expect(shouldLoadPartnerDeepOps('kyc', '')).toBe(false);
    expect(shouldLoadPartnerDeepOps('kyc', 'all')).toBe(true);
  });

  it('keeps approval queue navigation bounded to the supported queue', () => {
    expect(readPartnerDecisionQueue('approval-pending')).toBe('approval-pending');
    expect(readPartnerDecisionQueue('unapproved')).toBeNull();
    expect(partnerApprovalQueueDetailHref('partner 1')).toBe(
      '/partners/partner%201?decisionQueue=approval-pending',
    );
    expect(withPartnerDecisionQueue('/partners/partner-1?section=control', 'approval-pending')).toBe(
      '/partners/partner-1?section=control&decisionQueue=approval-pending',
    );
    expect(withPartnerDecisionQueue('/partners/partner-1', null)).toBe('/partners/partner-1');
  });

  it('selects the next oldest queue result and excludes the decision just completed', () => {
    expect(
      nextPartnerApprovalHref(
        [{ id: 'current-partner' }, { id: 'next-partner' }],
        'current-partner',
      ),
    ).toBe('/partners/next-partner?decisionQueue=approval-pending');
    expect(nextPartnerApprovalHref([{ id: 'current-partner' }], 'current-partner')).toBe(
      '/partners?review=approval-pending&sort=oldest',
    );
  });
});
