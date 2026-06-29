import { buildPartnerControlPageLoadPlan } from './partner-control-page-load-plan';

describe('partner control page load plan', () => {
  it('keeps default operations lists explicitly bounded', () => {
    const loadPlan = buildPartnerControlPageLoadPlan();
    const policyUrl = new URL(loadPlan.operationalPolicyHref, 'http://admin.local');

    expect(policyUrl.pathname).toBe('/admin/operational-policy');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.provider_response_window_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.marketplace_partner_invitation_limit',
      'matching.marketplace_partner_location_max_age_minutes',
    ]);
    expect(loadPlan).toEqual({
      operationalPolicyHref:
        '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_invitation_limit%2Cmatching.marketplace_partner_location_max_age_minutes',
      providersHref: '/admin/partner-controls/providers?take=10',
      reportsHref: '/admin/provider-reports?take=10',
      sanctionsHref: '/admin/provider-sanctions?take=10',
      summaryHref: '/admin/partner-controls/summary',
    });
  });
});
