import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

describe('Role badge CSS', () => {
  it('keeps role badges aligned with the Vuexy compact chip contract', () => {
    const roleIndex = globalsCss.indexOf('.role-badge,\n.role-customer,');
    const roleBlock = cssRuleBlockAt(roleIndex);

    expect(roleIndex).toBeGreaterThan(-1);
    expect(roleBlock).toContain('border-radius: var(--admin-radius)');
    expect(roleBlock).toContain('font-size: 0.8125rem');
    expect(roleBlock).toContain('font-weight: 500');
    expect(roleBlock).toContain('min-height: 24px');
    expect(roleBlock).toContain('padding: 2px 10px');
    expect(roleBlock).not.toContain('padding: 5px 9px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
