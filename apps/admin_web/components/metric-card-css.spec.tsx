import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Metric card CSS', () => {
  it('keeps KPI icon avatars on the Vuexy 42px statistic card rhythm', () => {
    const cardIndex = cssRuleIndex('.metric-card {');
    const cardBlock = cssRuleBlock('.metric-card {');
    const iconIndex = cssRuleIndex('.metric-card-icon {');
    const iconBlock = cssRuleBlock('.metric-card-icon {');

    expect(cardIndex).toBeGreaterThan(-1);
    expect(iconIndex).toBeGreaterThan(cardIndex);
    expect(cardBlock).toContain('grid-template-columns: 42px minmax(0, 1fr)');
    expect(cardBlock).not.toContain('grid-template-columns: 44px minmax(0, 1fr)');
    expect(iconBlock).toContain('height: 42px');
    expect(iconBlock).toContain('width: 42px');
    expect(iconBlock).not.toContain('height: 44px');
    expect(iconBlock).not.toContain('width: 44px');
  });

  it('scopes KPI copy typography to the metric content column', () => {
    const scopeBlock = cssRuleBlock('.metric-card-scope {');
    const labelBlock = cssRuleBlock('.metric-card-content > p {');
    const valueBlock = cssRuleBlock('.metric-card-content > h2 {');
    const helperBlock = cssRuleBlock('.metric-card-content > small {');

    expect(scopeBlock).toContain('border-radius: 999px;');
    expect(scopeBlock).toContain('width: max-content;');
    expect(labelBlock).toContain('color: var(--admin-muted);');
    expect(valueBlock).toContain('font-size: 1.5rem;');
    expect(helperBlock).toContain('display: block;');
    expect(cssRuleIndex('.metric-card p {')).toBe(-1);
    expect(cssRuleIndex('.metric-card h2 {')).toBe(-1);
    expect(cssRuleIndex('.metric-card small {')).toBe(-1);
  });
});

function cssRuleIndex(selector: string) {
  const selectorWithLineStart = `\n${selector}`;
  const index = globalsCss.indexOf(selectorWithLineStart);

  return index === -1 ? -1 : index + 1;
}

function cssRuleBlock(selector: string) {
  return cssRuleBlockAt(cssRuleIndex(selector));
}

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
