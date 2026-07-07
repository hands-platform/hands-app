import { readFileSync } from 'node:fs';

describe('ServiceProviderPriceImpact source', () => {
  it('uses the shared Vuexy status badge atom for partner price impact counters', () => {
    const source = readFileSync('app/services/service-provider-price-impact.tsx', 'utf8');

    expect(source).toContain('AdminCard');
    expect(source).toContain('AdminSectionHeader');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminStageList');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminEmptyState');
    expect(source).not.toContain('<div className="setup-stage-list">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('<div className="ops-section-header">');
    expect(source).not.toContain('<div className="service-impact-card">');
    expect(source).not.toContain("<span className={`pill ${impact.hiddenCount ? 'pill-warn' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className="pill pill-info">{impact.rows.length} loaded row(s)</span>');
    expect(source).not.toContain("className={impact.unsupportedCount ? 'pill pill-warn' : 'pill pill-success'}");
    expect(source).not.toContain("className={impact.belowMinimumCount ? 'pill pill-danger' : 'pill pill-success'}");
    expect(source).not.toContain("className={impact.inactiveOrBlockedCount ? 'pill pill-neutral' : 'pill pill-success'}");
    expect(source).not.toContain('<p className="muted">No Partner has configured a price for this duration yet.</p>');
  });

  it('uses shared money atoms for partner price impact amounts', () => {
    const source = readFileSync('app/services/service-provider-price-impact.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });
});
