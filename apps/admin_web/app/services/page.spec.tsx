import { readFileSync } from 'node:fs';

describe('ServicesPage source', () => {
  it('loads the operational group contract and renders the compact catalog control', () => {
    const source = readFileSync('app/services/page.tsx', 'utf8');
    const managerSource = readFileSync('app/services/service-catalog-manager-section.tsx', 'utf8');

    expect(managerSource).toContain('StatusBadge');
    expect(source).not.toContain('service-catalog-page-actions');
    expect(source).not.toContain('<span className="pill pill-info">{groupedServices.length} service type(s)</span>');
    expect(source).not.toContain('<span className="pill pill-success">{activeServices.length} active option(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{payoutRuleCount} payout rule(s)</span>');
    expect(managerSource).toContain('service-catalog-health-strip');
    expect(managerSource).toContain('service-catalog-table');
    expect(managerSource).toContain('ServiceCatalogRefreshButton');
    expect(managerSource).not.toContain('<RefreshCw');
    expect(managerSource).not.toContain('service-menu-card-grid');
    expect(source).toContain("'/admin/services/groups?scope=operational'");
    expect(source).toContain("'/admin/services/health'");
    expect(source).toContain('/audit-evidence`');
    expect(source).toContain("hasAdminOperatorCategory(operatorAccess, 'SYSTEM_AUDIT')");
    expect(source).toContain('groupsResult.ok');
    expect(source).toContain('revalidateSeconds: 300');
  });

  it('scopes service catalog page section headers to direct cards', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.service-catalog-page > .card > .ops-section-header {');
    expect(css).toContain('.service-catalog-page > .card > .ops-section-header h2 {');
    expect(css).not.toContain('.service-catalog-page .ops-section-header {');
    expect(css).not.toContain('.service-catalog-page .ops-section-header h2 {');
  });
});
