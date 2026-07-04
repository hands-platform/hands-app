import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Status badge CSS', () => {
  it('keeps shared status chips on the Vuexy compact chip contract', () => {
    const chipIndex = globalsCss.indexOf('.status-badge,\n.signal,\n.pill {');
    const chipBlock = cssRuleBlockAt(chipIndex);

    expect(chipIndex).toBeGreaterThan(-1);
    expect(chipBlock).toContain('border: 1px solid transparent');
    expect(chipBlock).toContain('box-sizing: border-box');
    expect(chipBlock).toContain('min-height: 24px');
    expect(chipBlock).toContain('padding: 2px 10px');
    expect(chipBlock).toContain('text-decoration: none');
    expect(chipBlock).toContain('vertical-align: middle');
    expect(chipBlock).toContain('white-space: nowrap');
    expect(chipBlock).not.toContain('padding: 5px 9px');
  });

  it('defines the primary pill tone used by admin page controls', () => {
    const primaryIndex = globalsCss.indexOf('.pill-primary {');
    const primaryBlock = cssRuleBlockAt(primaryIndex);

    expect(primaryIndex).toBeGreaterThan(-1);
    expect(primaryBlock).toContain('background: var(--admin-primary-soft)');
    expect(primaryBlock).toContain('color: var(--admin-accent-strong)');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
