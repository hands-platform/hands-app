import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Metric card CSS', () => {
  it('keeps KPI icon avatars on the Vuexy 42px statistic card rhythm', () => {
    const cardIndex = globalsCss.indexOf('.metric-card {');
    const cardBlock = cssRuleBlockAt(cardIndex);
    const iconIndex = globalsCss.indexOf('.metric-card-icon {');
    const iconBlock = cssRuleBlockAt(iconIndex);

    expect(cardIndex).toBeGreaterThan(-1);
    expect(iconIndex).toBeGreaterThan(cardIndex);
    expect(cardBlock).toContain('grid-template-columns: 42px minmax(0, 1fr)');
    expect(cardBlock).not.toContain('grid-template-columns: 44px minmax(0, 1fr)');
    expect(iconBlock).toContain('height: 42px');
    expect(iconBlock).toContain('width: 42px');
    expect(iconBlock).not.toContain('height: 44px');
    expect(iconBlock).not.toContain('width: 44px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
