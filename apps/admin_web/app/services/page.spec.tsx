import { readFileSync } from 'node:fs';

describe('ServicesPage source', () => {
  it('uses the shared Vuexy status badge atom for service section counters', () => {
    const source = readFileSync('app/services/page.tsx', 'utf8');
    const managerSource = readFileSync('app/services/service-catalog-manager-section.tsx', 'utf8');

    expect(managerSource).toContain('StatusBadge');
    expect(source).not.toContain('service-catalog-page-actions');
    expect(source).not.toContain('<span className="pill pill-info">{groupedServices.length} service type(s)</span>');
    expect(source).not.toContain('<span className="pill pill-success">{activeServices.length} active option(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{payoutRuleCount} payout rule(s)</span>');
    expect(managerSource).toContain('AdminCard');
    expect(managerSource).not.toContain('<article className="service-menu-card">');
  });

  it('scopes service catalog page section headers to direct cards', () => {
    const css = readFileSync('app/globals.css', 'utf8');

    expect(css).toContain('.service-catalog-page > .card > .ops-section-header {');
    expect(css).toContain('.service-catalog-page > .card > .ops-section-header h2 {');
    expect(css).not.toContain('.service-catalog-page .ops-section-header {');
    expect(css).not.toContain('.service-catalog-page .ops-section-header h2 {');
  });
});
