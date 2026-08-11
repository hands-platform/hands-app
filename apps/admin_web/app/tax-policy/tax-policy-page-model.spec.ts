import {
  buildTaxPolicyEditorHref,
  buildTaxPolicyLoadPlan,
} from './tax-policy-page-model';

describe('tax policy page model', () => {
  it('keeps every tax policy section visible with bounded evidence queries', () => {
    const plan = buildTaxPolicyLoadPlan({});

    expect(plan.taxPolicyVersionsHref).toBe('/admin/tax-policy-versions?take=20');
    expect(plan.auditLogsHref).toBe('/admin/audit-logs?q=tax_&take=8');
    expect(plan.recentEarningsHref).toBe('/admin/earnings?range=30d&take=8');
  });

  it('keeps legacy details URLs compatible without hiding page sections', () => {
    const editor = buildTaxPolicyLoadPlan({ details: 'editor' });
    const audit = buildTaxPolicyLoadPlan({ details: 'audit' });
    const records = buildTaxPolicyLoadPlan({ details: 'records' });

    expect(editor.taxPolicyVersionsHref).toBe('/admin/tax-policy-versions?take=20');
    expect(audit.auditLogsHref).toBe('/admin/audit-logs?q=tax_&take=8');
    expect(records.recentEarningsHref).toBe('/admin/earnings?range=30d&take=8');
  });

  it('keeps details=all as a compatibility URL for the unified page', () => {
    const plan = buildTaxPolicyLoadPlan({ details: 'all' });

    expect(plan).toEqual(buildTaxPolicyLoadPlan({}));
  });

  it('builds a stable selected-policy anchor link', () => {
    expect(buildTaxPolicyEditorHref('policy id/1')).toBe(
      '/tax-policy?policyId=policy%20id%2F1#tax-policy-editor',
    );
  });
});
