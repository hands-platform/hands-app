import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('Vietnam overview map tooltip CSS', () => {
  it('keeps map dot tooltips aligned with the Vuexy Tooltip typography and padding', () => {
    const tooltipIndex = globalsCss.indexOf('.vietnam-map-event-point::after {\n  background:');
    const tooltipBlock = cssRuleBlockAt(tooltipIndex);

    expect(tooltipIndex).toBeGreaterThan(-1);
    expect(tooltipBlock).toContain('border-radius: var(--admin-radius-sm)');
    expect(tooltipBlock).toContain('font-size: 0.8125rem');
    expect(tooltipBlock).toContain('font-weight: 500');
    expect(tooltipBlock).toContain('line-height: 1.539');
    expect(tooltipBlock).toContain('padding: 5px 12px');
    expect(tooltipBlock).not.toContain('font-size: 12px');
    expect(tooltipBlock).not.toContain('font-weight: 700');
    expect(tooltipBlock).not.toContain('padding: 10px 12px');
  });

  it('keeps shared map zoom button atoms on the compact Vuexy icon-button footprint', () => {
    const zoomButtonIndex = globalsCss.indexOf('.admin-form-control-button.vietnam-map-zoom-button {');
    const zoomButtonBlock = cssRuleBlockAt(zoomButtonIndex);

    expect(zoomButtonIndex).toBeGreaterThan(-1);
    expect(zoomButtonBlock).toContain('height: 30px');
    expect(zoomButtonBlock).toContain('min-height: 30px');
    expect(zoomButtonBlock).toContain('padding: 0');
    expect(zoomButtonBlock).toContain('width: 30px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
