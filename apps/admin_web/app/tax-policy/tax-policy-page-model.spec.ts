import { buildTaxPolicyDetailsHref, buildTaxPolicyLoadPlan } from './tax-policy-page-model';

describe('tax policy page model', () => {
  it('keeps the default operator summary bounded and skips evidence queries', () => {
    const plan = buildTaxPolicyLoadPlan({});

    expect(plan.detailsMode).toBe('summary');
    expect(plan.taxPolicyVersionsHref).toBe('/admin/tax-policy-versions?take=20');
    expect(plan.auditLogsHref).toBeNull();
    expect(plan.recentEarningsHref).toBeNull();
    expect(plan.shouldRenderSummary).toBe(true);
    expect(plan.shouldRenderWorkspaceIndex).toBe(true);
  });

  it('loads only the data required by each detailed workspace', () => {
    const editor = buildTaxPolicyLoadPlan({ details: 'editor' });
    const audit = buildTaxPolicyLoadPlan({ details: 'audit' });
    const records = buildTaxPolicyLoadPlan({ details: 'records' });

    expect(editor.shouldRenderEditor).toBe(true);
    expect(editor.auditLogsHref).toBeNull();
    expect(editor.recentEarningsHref).toBeNull();

    expect(audit.shouldRenderAudit).toBe(true);
    expect(audit.auditLogsHref).toBe('/admin/audit-logs?q=tax_&take=8');
    expect(audit.recentEarningsHref).toBeNull();

    expect(records.shouldRenderRecords).toBe(true);
    expect(records.auditLogsHref).toBeNull();
    expect(records.recentEarningsHref).toBe('/admin/earnings?range=30d&take=8');
  });

  it('keeps details=all as a lightweight workspace index', () => {
    const plan = buildTaxPolicyLoadPlan({ details: 'all' });

    expect(plan.shouldRenderWorkspaceIndex).toBe(true);
    expect(plan.shouldRenderSummary).toBe(false);
    expect(plan.shouldRenderEditor).toBe(false);
    expect(plan.shouldRenderAudit).toBe(false);
    expect(plan.shouldRenderRecords).toBe(false);
    expect(plan.auditLogsHref).toBeNull();
    expect(plan.recentEarningsHref).toBeNull();
  });

  it('builds stable workspace links', () => {
    expect(buildTaxPolicyDetailsHref('summary')).toBe('/tax-policy');
    expect(buildTaxPolicyDetailsHref('all')).toBe('/tax-policy?details=all');
    expect(buildTaxPolicyDetailsHref('editor')).toBe('/tax-policy?details=editor');
    expect(buildTaxPolicyDetailsHref('audit')).toBe('/tax-policy?details=audit');
    expect(buildTaxPolicyDetailsHref('records')).toBe('/tax-policy?details=records');
  });
});
