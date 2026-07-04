import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin surface CSS', () => {
  it('keeps AdminSection footers on the Vuexy CardActions row rhythm', () => {
    const footerIndex = globalsCss.indexOf('.admin-section-footer {');
    const footerBlock = cssRuleBlockAt(footerIndex);

    expect(footerIndex).toBeGreaterThan(-1);
    expect(footerBlock).toContain('border-top: 1px solid var(--admin-border)');
    expect(footerBlock).toContain('padding-top: 14px');
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
