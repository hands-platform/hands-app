import {
  buildTaxPolicyEditorHref,
  buildTaxPolicyLoadPlan,
  buildTaxPolicyPageHref,
} from './tax-policy-page-model';

describe('tax policy page load plan', () => {
  it('loads current and bounded draft work without broad audit or earnings queries', () => {
    expect(buildTaxPolicyLoadPlan({})).toEqual({
      view: 'current',
      page: 1,
      issuePage: 1,
      currentPolicyHref: '/admin/tax-policy-versions?view=current&take=2',
      workspacePoliciesHref: '/admin/tax-policy-versions?view=drafts&take=25&skip=0',
      selectedPolicyHref: undefined,
      approvalRequestsHref: undefined,
      auditEventHref: undefined,
      auditLogsHref: undefined,
      capabilityHref: '/admin/tax-policy-capabilities',
      integrityRecordsHref: undefined,
      integritySummaryHref: undefined,
      recentEarningsHref: undefined,
      workspaceSummaryHref: '/admin/tax-policy-workspace-summary',
    });
  });

  it('loads approval requests only in the draft workspace', () => {
    const plan = buildTaxPolicyLoadPlan({ view: 'drafts', page: '2' });
    expect(plan.workspacePoliciesHref).toBe('/admin/tax-policy-versions?view=drafts&take=25&skip=25');
    expect(plan.approvalRequestsHref).toBeUndefined();
    expect(plan.auditLogsHref).toBeUndefined();
  });

  it('loads the approval receipt and capabilities for the exact selected policy', () => {
    const plan = buildTaxPolicyLoadPlan({ view: 'drafts', policyId: 'policy-1' });
    expect(plan.approvalRequestsHref).toBe(
      '/admin/tax-policy-approval-requests?policyVersionId=policy-1&take=25&skip=0',
    );
    expect(plan.capabilityHref).toBe('/admin/tax-policy-capabilities?policyVersionId=policy-1');
  });

  it('loads exact audit and bounded evidence only for integrity', () => {
    const plan = buildTaxPolicyLoadPlan({ view: 'integrity' });
    expect(plan.workspacePoliciesHref).toBeUndefined();
    expect(plan.auditLogsHref).toBe('/admin/tax-policy-audit-logs?source=production&take=25&skip=0');
    expect(plan.integritySummaryHref).toBe('/admin/tax-policy-integrity-summary');
    expect(plan.recentEarningsHref).toBe('/admin/earnings?range=30d&take=25');
  });

  it('paginates a filtered integrity queue independently from the lifecycle audit', () => {
    const plan = buildTaxPolicyLoadPlan({
      view: 'integrity', issue: 'missing-tax-log', issuePage: '3', page: '2',
    });
    expect(plan.page).toBe(2);
    expect(plan.issuePage).toBe(3);
    expect(plan.integrityRecordsHref).toBe(
      '/admin/tax-policy-integrity-records?issue=missing-tax-log&source=all&sort=oldest&take=25&skip=50',
    );
    expect(plan.auditLogsHref).toContain('skip=25');
  });

  it('loads exact audit event and integrity evidence filters without changing the audit page', () => {
    const plan = buildTaxPolicyLoadPlan({
      auditEventId: 'audit/1',
      auditSource: 'legacy',
      issue: 'amount-mismatch',
      issueFrom: '2026-08-01',
      issueSort: 'newest',
      issueSource: 'production',
      issueTo: '2026-08-14',
      page: '4',
      view: 'integrity',
    });
    expect(plan.auditEventHref).toBe(
      '/admin/tax-policy-audit-logs?eventId=audit%2F1&source=legacy&take=1&skip=0',
    );
    expect(plan.auditLogsHref).toContain('skip=75');
    expect(plan.integrityRecordsHref).toBe(
      '/admin/tax-policy-integrity-records?issue=amount-mismatch&source=production&sort=newest&take=25&skip=0&from=2026-08-01&to=2026-08-14',
    );
  });

  it('loads a requested policy exactly instead of allowing an active fallback', () => {
    const plan = buildTaxPolicyLoadPlan({ view: 'drafts', policyId: 'policy id/1' });
    expect(plan.selectedPolicyHref).toBe('/admin/tax-policy-versions?id=policy%20id%2F1&take=1');
    expect(buildTaxPolicyEditorHref('policy id/1')).toBe(
      '/tax-policy?view=drafts&policyId=policy%20id%2F1#tax-policy-policy%20id%2F1',
    );
  });

  it('keeps pagination in URL state', () => {
    expect(buildTaxPolicyPageHref('history', 3, { provenance: 'SMOKE_TEST' })).toBe(
      '/tax-policy?view=history&page=3&provenance=SMOKE_TEST',
    );
  });
});
