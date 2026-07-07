import { readFileSync } from 'node:fs';

describe('ServicePriceLadderCoverageSection source', () => {
  it('uses the shared Vuexy status badge atom for ladder coverage rows', () => {
    const source = readFileSync('app/services/service-price-ladder-coverage-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).toContain('AdminFilterChipGroup');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain("className={`pill ${item.rule ? 'pill-success' : 'pill-warn'}`}");
  });

  it('uses shared money atoms for price ladder amounts', () => {
    const source = readFileSync('app/services/service-price-ladder-coverage-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });
});
