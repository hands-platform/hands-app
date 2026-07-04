import { readFileSync } from 'node:fs';

describe('ServicesPage source', () => {
  it('uses the shared Vuexy status badge atom for page action counters', () => {
    const source = readFileSync('app/services/page.tsx', 'utf8');
    const managerSource = readFileSync('app/services/service-catalog-manager-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-info">{groupedServices.length} service type(s)</span>');
    expect(source).not.toContain('<span className="pill pill-success">{activeServices.length} active option(s)</span>');
    expect(source).not.toContain('<span className="pill pill-neutral">{payoutRuleCount} payout rule(s)</span>');
    expect(managerSource).toContain('AdminCard');
    expect(managerSource).not.toContain('<article className="service-menu-card">');
  });
});
