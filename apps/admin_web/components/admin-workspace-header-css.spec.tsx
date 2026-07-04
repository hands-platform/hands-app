import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin workspace header CSS', () => {
  it('keeps topbar icon buttons on the Vuexy medium IconButton rhythm', () => {
    const iconIndex = globalsCss.indexOf('.topbar-icon-chip {');
    const iconBlock = cssRuleBlockAt(iconIndex);
    const hoverIndex = globalsCss.indexOf('.topbar-search:hover,');
    const hoverBlock = cssRuleBlockAt(hoverIndex);

    expect(iconIndex).toBeGreaterThan(-1);
    expect(iconBlock).toContain('height: 38px');
    expect(iconBlock).toContain('width: 38px');
    expect(iconBlock).toContain('font-size: 1.375rem');
    expect(iconBlock).not.toContain('height: 36px');
    expect(iconBlock).not.toContain('width: 36px');
    expect(hoverBlock).toContain('background: var(--admin-action-hover)');
    expect(hoverBlock).not.toContain('background: var(--admin-sidebar-hover)');
  });

  it('keeps theme mode buttons aligned with Vuexy medium IconButton sizing', () => {
    const toggleButtonIndex = globalsCss.indexOf('.theme-toggle-button {');
    const toggleButtonBlock = cssRuleBlockAt(toggleButtonIndex);

    expect(toggleButtonIndex).toBeGreaterThan(-1);
    expect(toggleButtonBlock).toContain('height: 38px');
    expect(toggleButtonBlock).toContain('min-height: 38px');
    expect(toggleButtonBlock).toContain('width: 38px');
    expect(toggleButtonBlock).toContain('font-size: 1.375rem');
    expect(toggleButtonBlock).not.toContain('height: 30px');
    expect(toggleButtonBlock).not.toContain('width: 30px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
