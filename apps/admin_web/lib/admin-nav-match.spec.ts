import {
  adminBreadcrumbContext,
  bestMatchingNavHref,
  hrefMatchesPath,
  partnerWorkspaceModeLabel,
  postMatchCancellationWorkspaceFromHref,
  postMatchCancellationWorkspaceFromSearch,
} from './admin-nav-match';
import { adminNavSections } from './admin-navigation';

describe('hrefMatchesPath', () => {
  it('keeps the customer reviews nav item separate from partner customer evaluations', () => {
    expect(hrefMatchesPath('/reviews', '/reviews', '')).toBe(true);
    expect(hrefMatchesPath('/reviews', '/reviews/partner-customer-evaluations', '')).toBe(false);
    expect(
      hrefMatchesPath('/reviews/partner-customer-evaluations', '/reviews/partner-customer-evaluations', ''),
    ).toBe(true);
  });

  it('matches Partner navigation by primary queue while ignoring secondary filters', () => {
    expect(hrefMatchesPath('/partners', '/partners', 'review=kyc')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=approval-pending&sort=oldest')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=unapproved&q=linh')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners', 'review=unsettled')).toBe(true);
    expect(hrefMatchesPath('/partners?review=unapproved', '/partners', 'q=linh&review=unapproved')).toBe(
      true,
    );
    expect(hrefMatchesPath('/partners/overview', '/partners/overview', 'range=7d')).toBe(true);
    expect(hrefMatchesPath('/partners', '/partners/overview', 'range=7d')).toBe(false);
  });

  it('names each Partner workspace mode for breadcrumbs', () => {
    expect(partnerWorkspaceModeLabel('')).toBeNull();
    expect(partnerWorkspaceModeLabel('review=approval-pending')).toBe('Approvals');
    expect(partnerWorkspaceModeLabel('review=unapproved')).toBe('Onboarding blockers');
    expect(partnerWorkspaceModeLabel('review=unsettled')).toBe('Wallet debt');
  });

  it('keeps hub routes from swallowing deeper finance and notification pages', () => {
    expect(hrefMatchesPath('/finance-tax', '/finance-tax', '')).toBe(true);
    expect(hrefMatchesPath('/finance-tax', '/finance-tax/monthly-tax-closing', '')).toBe(false);
    expect(hrefMatchesPath('/finance-tax/monthly-tax-closing', '/finance-tax/monthly-tax-closing', '')).toBe(
      true,
    );
    expect(
      hrefMatchesPath('/finance-tax/bank-reconciliation', '/finance-tax/bank-reconciliation/bank-1', ''),
    ).toBe(true);

    expect(hrefMatchesPath('/notifications', '/notifications', '')).toBe(true);
    expect(hrefMatchesPath('/notifications', '/notifications/templates', '')).toBe(false);
    expect(hrefMatchesPath('/notifications/templates', '/notifications/templates', '')).toBe(true);
  });

  it('keeps the single Shift Handoff nav item active in Current and History', () => {
    expect(hrefMatchesPath('/operations-handoff', '/operations-handoff', '')).toBe(true);
    expect(hrefMatchesPath('/operations-handoff', '/operations-handoff', 'view=history')).toBe(true);
  });

  it('prefers a query-specific Finance queue over the generic record page', () => {
    const hrefs = [
      '/payouts',
      '/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests',
      '/finance-tax/bank-reconciliation?range=all&review=unmatched',
    ];

    expect(bestMatchingNavHref(hrefs, '/payouts', 'range=all&withdrawalStatus=REVIEW_REQUIRED')).toBe(
      '/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED#partner-wallet-withdrawal-requests',
    );
    expect(bestMatchingNavHref(hrefs, '/payouts', '')).toBe('/payouts');
  });

  it('keeps Payment Matching active across bank, payment, and detail routes', () => {
    const paymentMatchingHref =
      '/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched';

    expect(hrefMatchesPath(paymentMatchingHref, '/finance-tax/bank-reconciliation', 'workspace=imports')).toBe(
      true,
    );
    expect(hrefMatchesPath(paymentMatchingHref, '/finance-tax/bank-reconciliation/bank-1', '')).toBe(true);
    expect(
      hrefMatchesPath(paymentMatchingHref, '/finance-tax/payment-clearing', 'range=all&review=partial'),
    ).toBe(true);
    expect(hrefMatchesPath(paymentMatchingHref, '/finance-tax/payment-clearing/clearing-1', '')).toBe(true);
  });

  it.each([
    ['/finance-tax/bank-reconciliation', 'workspace=operations', 'Bank transactions'],
    ['/finance-tax/bank-reconciliation', 'workspace=imports', 'Statement imports'],
    ['/finance-tax/bank-reconciliation', 'workspace=manual', 'Manual bank entry'],
    ['/finance-tax/bank-reconciliation/bank-transaction-123456', '', 'Bank transaction bank-tra…3456'],
    ['/finance-tax/payment-clearing', 'review=unresolved', 'Unmatched payment evidence'],
    ['/finance-tax/payment-clearing', 'review=partial', 'Partial matches'],
    ['/finance-tax/payment-clearing', 'review=terminal', 'Cleared & reversed history'],
    ['/finance-tax/payment-clearing/clearing-entry-123456', '', 'Payment evidence clearing…3456'],
  ])('uses Payment Matching breadcrumb context for %s', (pathname, search, pageLabel) => {
    expect(adminBreadcrumbContext(adminNavSections, pathname, search)).toEqual({
      pageLabel,
      sectionLabel: 'Finance Operations',
      workspace: expect.objectContaining({ label: 'Payment Matching' }),
    });
  });

  it.each([
    ['/notifications/templates', '', 'Growth & Communications', 'Messaging', 'Notification Templates'],
    ['/notifications/push-send', '', 'Growth & Communications', 'Messaging', 'Push Send'],
    ['/referrals/customers', '', 'Growth & Communications', 'Referrals', 'Customer Referrals'],
    ['/referrals/partners', '', 'Growth & Communications', 'Referrals', 'Partner Referrals'],
    ['/bookings/post-match-cancellations', '', 'Booking Operations', 'Booking Closeout', 'Post-match Cancellations'],
    ['/setup', '', 'Administration & Settings', 'System Health', 'External Services'],
    ['/app-sessions', '', 'Administration & Settings', 'System Health', 'App Session Diagnostics'],
    ['/background-jobs', '', 'Administration & Settings', 'System Health', 'Background Jobs'],
    ['/payouts', 'range=all&withdrawalStatus=REVIEW_REQUIRED', 'Finance Records & Close', 'Partner Money', 'Payout / Withdrawal Risk'],
  ])(
    'resolves section, workspace, and local page for %s',
    (pathname, search, sectionLabel, workspaceLabel, pageLabel) => {
      expect(adminBreadcrumbContext(adminNavSections, pathname, search)).toEqual({
        pageLabel,
        sectionLabel,
        workspace: expect.objectContaining({ label: workspaceLabel }),
      });
    },
  );

  it('does not repeat Partner Operations as both section and workspace breadcrumb', () => {
    expect(
      adminBreadcrumbContext(
        adminNavSections,
        '/partners',
        'review=approval-pending&sort=oldest',
      ),
    ).toEqual({
      pageLabel: 'Partner Approvals',
      sectionLabel: 'Partner Operations',
      workspace: undefined,
    });
  });

  it('restores each post-match cancellation workspace from booking detail', () => {
    expect(
      postMatchCancellationWorkspaceFromHref(
        '/bookings/post-match-cancellations?view=manual-decision&range=7d#booking-1',
      ),
    ).toEqual({
      href: '/bookings/post-match-cancellations?view=manual-decision&range=7d#booking-1',
      label: 'Needs decision',
    });
    expect(postMatchCancellationWorkspaceFromHref('/bookings/post-match-cancellations?view=no-show')).toEqual(
      {
        href: '/bookings/post-match-cancellations?view=no-show',
        label: 'No-show review',
      },
    );
    expect(
      postMatchCancellationWorkspaceFromSearch(
        'returnTo=%2Fbookings%2Fpost-match-cancellations%3Fview%3Dpost-match-cancellations',
      ),
    ).toEqual({
      href: '/bookings/post-match-cancellations?view=post-match-cancellations',
      label: 'Resolved records',
    });
  });

  it('rejects non-workspace return targets and keeps the post-match navigation active', () => {
    expect(postMatchCancellationWorkspaceFromHref('https://example.com')).toBeNull();
    expect(postMatchCancellationWorkspaceFromHref('/bookings/post-match-cancellations-archive')).toBeNull();
    expect(postMatchCancellationWorkspaceFromHref('/bookings\\post-match-cancellations')).toBeNull();
    expect(
      hrefMatchesPath(
        '/bookings/post-match-cancellations',
        '/bookings/booking-1',
        'returnTo=%2Fbookings%2Fpost-match-cancellations%3Fview%3Dno-show',
      ),
    ).toBe(true);
    expect(
      hrefMatchesPath(
        '/bookings',
        '/bookings/booking-1',
        'returnTo=%2Fbookings%2Fpost-match-cancellations%3Fview%3Dno-show',
      ),
    ).toBe(false);
  });
});
