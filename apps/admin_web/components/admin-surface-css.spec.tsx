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

  it('keeps AdminState panels on the Vuexy Alert rhythm', () => {
    const stateIndex = globalsCss.indexOf('.admin-state {');
    const stateBlock = cssRuleBlockAt(stateIndex);
    const stateIconIndex = globalsCss.indexOf('.admin-state-icon {');
    const stateIconBlock = cssRuleBlockAt(stateIconIndex);

    expect(stateIndex).toBeGreaterThan(-1);
    expect(stateBlock).toContain('gap: 16px');
    expect(stateBlock).toContain('grid-template-columns: 30px minmax(0, 1fr)');
    expect(stateBlock).toContain('padding: 12px 16px');
    expect(stateBlock).not.toContain('grid-template-columns: 40px minmax(0, 1fr)');
    expect(stateBlock).not.toContain('padding: 18px');
    expect(stateIconIndex).toBeGreaterThan(-1);
    expect(stateIconBlock).toContain('height: 30px');
    expect(stateIconBlock).toContain('width: 30px');
    expect(stateIconBlock).not.toContain('height: 40px');
    expect(stateIconBlock).not.toContain('width: 40px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
