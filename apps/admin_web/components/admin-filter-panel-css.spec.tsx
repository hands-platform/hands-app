import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin filter panel CSS', () => {
  it('keeps filter panel headers on the Vuexy CardHeader title/action layout', () => {
    const copyIndex = globalsCss.indexOf('.admin-filter-panel-copy {');
    const copyBlock = cssRuleBlockAt(copyIndex);
    const actionIndex = globalsCss.indexOf('.admin-filter-panel-header > .pill {');
    const actionBlock = cssRuleBlockAt(actionIndex);

    expect(copyIndex).toBeGreaterThan(-1);
    expect(copyBlock).toContain('display: grid');
    expect(copyBlock).toContain('gap: 4px');
    expect(copyBlock).toContain('min-width: 0');
    expect(actionIndex).toBeGreaterThan(copyIndex);
    expect(actionBlock).toContain('flex-shrink: 0');
  });

  it('keeps filter panel footers on the Vuexy card actions rhythm', () => {
    const footerIndex = globalsCss.indexOf('.admin-filter-panel-footer {');
    const footerBlock = cssRuleBlockAt(footerIndex);

    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerBlock).toContain('align-items: center');
    expect(footerBlock).toContain('display: flex');
    expect(footerBlock).toContain('flex-wrap: wrap');
    expect(footerBlock).toContain('gap: 12px');
    expect(footerBlock).toContain('justify-content: space-between');
    expect(footerBlock).not.toContain('display: grid');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
