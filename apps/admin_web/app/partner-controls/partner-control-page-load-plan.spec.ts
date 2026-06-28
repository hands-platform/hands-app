import { buildPartnerControlPageLoadPlan } from './partner-control-page-load-plan';

describe('partner control page load plan', () => {
  it('keeps default operations lists explicitly bounded', () => {
    expect(buildPartnerControlPageLoadPlan()).toEqual({
      operationalPolicyHref: '/admin/operational-policy',
      providersHref: '/admin/partner-controls/providers?take=10',
      reportsHref: '/admin/provider-reports?take=10',
      sanctionsHref: '/admin/provider-sanctions?take=10',
    });
  });
});
