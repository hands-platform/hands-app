import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Confirm dialog CSS', () => {
  it('keeps confirm dialog actions on the Vuexy DialogActions rhythm', () => {
    const actionsIndex = globalsCss.indexOf('.confirm-dialog-actions {');
    const actionsBlock = cssRuleBlockAt(actionsIndex);

    expect(actionsIndex).toBeGreaterThan(-1);
    expect(actionsBlock).toContain('align-items: flex-end');
    expect(actionsBlock).toContain('display: flex');
    expect(actionsBlock).toContain('flex-wrap: wrap');
    expect(actionsBlock).toContain('gap: 16px');
    expect(actionsBlock).toContain('margin-top: 24px');
    expect(actionsBlock).not.toContain('align-items: center');
    expect(actionsBlock).not.toContain('margin-top: 12px');
  });

  it('keeps shared drawer backdrops stable across pointer and focus states', () => {
    expect(globalsCss).toMatch(
      /button\.calendar-drawer-backdrop,\s*button\.calendar-drawer-backdrop:hover,\s*button\.calendar-drawer-backdrop:focus,\s*button\.calendar-drawer-backdrop:active:not\(:disabled\)\s*{[^}]*background:\s*rgb\(var\(--admin-main-channel\) \/ 0\.36\);[^}]*border-radius:\s*0;[^}]*box-shadow:\s*none;[^}]*padding:\s*0;[^}]*transform:\s*none;/s,
    );
    expect(globalsCss).toMatch(
      /button\.calendar-drawer-backdrop:focus-visible\s*{[^}]*box-shadow:\s*inset 0 0 0 2px var\(--admin-accent\);/s,
    );
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
