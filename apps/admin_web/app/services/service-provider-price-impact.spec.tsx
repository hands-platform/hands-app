import { readFileSync } from 'node:fs';

describe('ServiceProviderPriceImpact source', () => {
  it('uses the shared Vuexy status badge atom for partner price impact counters', () => {
    const source = readFileSync('app/services/service-provider-price-impact.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain("<span className={`pill ${impact.hiddenCount ? 'pill-warn' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className="pill pill-info">{impact.rows.length} loaded row(s)</span>');
    expect(source).not.toContain("className={impact.unsupportedCount ? 'pill pill-warn' : 'pill pill-success'}");
    expect(source).not.toContain("className={impact.belowMinimumCount ? 'pill pill-danger' : 'pill pill-success'}");
    expect(source).not.toContain("className={impact.inactiveOrBlockedCount ? 'pill pill-neutral' : 'pill pill-success'}");
  });
});
