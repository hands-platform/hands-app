import { buildPartnerControlPageLoadPlan } from './partner-control-page-load-plan';

describe('partner control page load plan', () => {
  it('keeps default operations lists explicitly bounded', () => {
    const loadPlan = buildPartnerControlPageLoadPlan();
    const policyUrl = new URL(loadPlan.operationalPolicyHref!, 'http://admin.local');

    expect(policyUrl.pathname).toBe('/admin/operational-policy');
    expect(policyUrl.searchParams.get('keys')?.split(',')).toEqual([
      'matching.provider_response_window_minutes',
      'matching.marketplace_partner_radius_meters',
      'matching.marketplace_partner_invitation_limit',
      'matching.marketplace_partner_location_max_age_minutes',
    ]);
    expect(loadPlan).toEqual({
      detailsMode: 'summary',
      listTake: 10,
      operationalPolicyHref:
        '/admin/operational-policy?keys=matching.provider_response_window_minutes%2Cmatching.marketplace_partner_radius_meters%2Cmatching.marketplace_partner_invitation_limit%2Cmatching.marketplace_partner_location_max_age_minutes',
      providersHref: '/admin/partner-controls/providers?take=10',
      reportsPage: 1,
      reportsHref: '/admin/provider-reports?take=10',
      sanctionsPage: 1,
      sanctionsHref: '/admin/provider-sanctions?take=10',
      summaryHref: '/admin/partner-controls/summary',
      shouldRenderAccountControls: false,
      shouldRenderControlDiagnostics: false,
      shouldRenderReports: false,
      shouldRenderSummary: true,
      shouldRenderWorkspaceIndex: true,
    });
  });

  it('adds server skips only for the selected paged queue', () => {
    const buildLoadPlanWithParams = buildPartnerControlPageLoadPlan as unknown as (
      params: Record<string, string | undefined>,
    ) => ReturnType<typeof buildPartnerControlPageLoadPlan>;

    const loadPlan = buildLoadPlanWithParams({
      reportPage: '3',
    });

    expect(loadPlan.reportsHref).toBe('/admin/provider-reports?take=10&skip=20');
    expect(loadPlan.sanctionsHref).toBeNull();
    expect(loadPlan.detailsMode).toBe('reports');

    const sanctionPlan = buildLoadPlanWithParams({ sanctionPage: '2' });
    expect(sanctionPlan.reportsHref).toBeNull();
    expect(sanctionPlan.sanctionsHref).toBe('/admin/provider-sanctions?take=10&skip=10');
    expect(sanctionPlan.detailsMode).toBe('sanctions');
  });

  it('keeps detailed workspaces isolated and infers old filtered links', () => {
    const controls = buildPartnerControlPageLoadPlan({ details: 'controls' });
    const reports = buildPartnerControlPageLoadPlan({ status: 'OPEN' });
    const sanctions = buildPartnerControlPageLoadPlan({ sanction: 'ACTIVE' });
    const index = buildPartnerControlPageLoadPlan({ details: 'all' });

    expect(controls.shouldRenderControlDiagnostics).toBe(true);
    expect(controls.providersHref).not.toBeNull();
    expect(controls.reportsHref).not.toBeNull();
    expect(controls.sanctionsHref).not.toBeNull();
    expect(controls.operationalPolicyHref).not.toBeNull();

    expect(reports.detailsMode).toBe('reports');
    expect(reports.shouldRenderReports).toBe(true);
    expect(reports.sanctionsHref).toBeNull();
    expect(reports.operationalPolicyHref).toBeNull();

    expect(sanctions.detailsMode).toBe('sanctions');
    expect(sanctions.shouldRenderAccountControls).toBe(true);
    expect(sanctions.providersHref).toBeNull();
    expect(sanctions.reportsHref).toBeNull();

    expect(index.shouldRenderWorkspaceIndex).toBe(true);
    expect(index.providersHref).toBeNull();
    expect(index.reportsHref).toBeNull();
    expect(index.sanctionsHref).toBeNull();
  });
});
