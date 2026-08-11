import {
  buildPartnerControlPageLoadPlan,
  partnerControlHref,
  partnerControlWorkspaceHref,
} from './partner-control-page-load-plan';

function parsed(value: string | null) {
  expect(value).not.toBeNull();
  return new URL(value!, 'http://admin.local');
}

describe('partner control page load plan', () => {
  it('loads only the summary totals and server-ranked blocker page by default', () => {
    const loadPlan = buildPartnerControlPageLoadPlan();
    const providers = parsed(loadPlan.providersHref);

    expect(loadPlan).toMatchObject({
      blockersPage: 1,
      detailsMode: 'summary',
      listTake: 10,
      partnerSearchHref: null,
      reportHref: null,
      reportsHref: null,
      sanctionsHref: null,
      shouldRenderAccountControls: false,
      shouldRenderPartnerBlockers: false,
      shouldRenderReports: false,
      shouldRenderSummary: true,
      summaryHref: '/admin/partner-controls/summary',
    });
    expect(providers.pathname).toBe('/admin/partner-controls/providers');
    expect(Object.fromEntries(providers.searchParams)).toEqual({
      review: 'attention',
      take: '10',
      withTotal: 'true',
    });
  });

  it('loads only the selected server-paged workspace', () => {
    const reports = buildPartnerControlPageLoadPlan({
      details: 'reports',
      reportPage: '3',
      severity: 'HIGH_PLUS',
      status: 'OPEN',
    });
    const reportUrl = parsed(reports.reportsHref);

    expect(reports.providersHref).toBeNull();
    expect(reports.sanctionsHref).toBeNull();
    expect(reports.summaryHref).toBeNull();
    expect(Object.fromEntries(reportUrl.searchParams)).toEqual({
      severity: 'HIGH_PLUS',
      skip: '20',
      status: 'OPEN',
      take: '10',
      withTotal: 'true',
    });

    const sanctions = buildPartnerControlPageLoadPlan({
      controlType: 'PAYOUT_HOLD',
      details: 'sanctions',
      sanction: 'HISTORY',
      sanctionPage: '2',
    });
    const sanctionUrl = parsed(sanctions.sanctionsHref);

    expect(sanctions.providersHref).toBeNull();
    expect(sanctions.reportsHref).toBeNull();
    expect(sanctions.summaryHref).toBeNull();
    expect(Object.fromEntries(sanctionUrl.searchParams)).toEqual({
      skip: '10',
      status: 'HISTORY',
      take: '10',
      type: 'PAYOUT_HOLD',
      withTotal: 'true',
    });
  });

  it('uses full server search only while the new report disclosure is open', () => {
    const search = buildPartnerControlPageLoadPlan({
      details: 'reports',
      newReport: '1',
      partnerQ: 'thanh',
    });
    const searchUrl = parsed(search.partnerSearchHref);

    expect(Object.fromEntries(searchUrl.searchParams)).toEqual({
      q: 'thanh',
      review: 'all',
      take: '20',
      withTotal: 'true',
    });
    expect(buildPartnerControlPageLoadPlan({ details: 'reports' }).partnerSearchHref).toBeNull();
  });

  it('loads the active report queue by default and a requested report directly', () => {
    const defaultReports = buildPartnerControlPageLoadPlan({ details: 'reports' });
    expect(Object.fromEntries(parsed(defaultReports.reportsHref).searchParams)).toEqual({
      review: 'active',
      take: '10',
      withTotal: 'true',
    });

    const direct = buildPartnerControlPageLoadPlan({
      details: 'reports',
      newReport: '1',
      partnerQ: 'ignored',
      reviewReportId: 'report/outside-page',
    });
    expect(direct.reportHref).toBe('/admin/provider-reports/report%2Foutside-page');
    expect(direct.partnerSearchHref).toBeNull();
  });

  it('canonicalizes mode-specific filters, defaults, pages, and mutually exclusive report actions', () => {
    expect(
      partnerControlHref(
        {
          details: 'reports',
          newReport: '1',
          partnerQ: 'linh',
          reviewReportId: 'report-1',
          sanction: 'ACTIVE',
          blockerPage: '4',
          reportPage: '1',
          sort: 'priority',
        },
        {},
      ),
    ).toBe('/partner-controls?details=reports&reviewReportId=report-1');

    expect(
      partnerControlHref(
        { details: 'sanctions', sanction: 'ACTIVE', sort: 'newest', sanctionPage: '2' },
        {},
      ),
    ).toBe('/partner-controls?details=sanctions&sanctionPage=2');

    expect(
      partnerControlHref(
        { details: 'controls', review: 'kyc', sort: 'oldest', blockerPage: '3', status: 'OPEN' },
        {},
      ),
    ).toBe('/partner-controls?details=controls&review=kyc&sort=oldest&blockerPage=3');
  });

  it('drops inactive workspace state while preserving the shared Partner search', () => {
    const params = {
      details: 'controls',
      newReport: '1',
      q: 'Mai',
      reportPage: '5',
      review: 'cash-debt',
      sanctionPage: '4',
    };

    expect(partnerControlWorkspaceHref(params, 'summary')).toBe('/partner-controls?q=Mai');
    expect(partnerControlWorkspaceHref(params, 'controls')).toBe('/partner-controls?details=controls&q=Mai');
    expect(partnerControlWorkspaceHref(params, 'reports')).toBe('/partner-controls?details=reports&q=Mai');
    expect(partnerControlWorkspaceHref(params, 'sanctions')).toBe('/partner-controls?details=sanctions&q=Mai');
  });

  it('keeps old filtered links mapped to the fixed workspaces', () => {
    expect(buildPartnerControlPageLoadPlan({ details: 'all' }).detailsMode).toBe('summary');
    expect(buildPartnerControlPageLoadPlan({ status: 'OPEN' }).detailsMode).toBe('reports');
    expect(buildPartnerControlPageLoadPlan({ sanction: 'ACTIVE' }).detailsMode).toBe('sanctions');
    expect(buildPartnerControlPageLoadPlan({ review: 'cash-debt' }).detailsMode).toBe('controls');
  });
});
