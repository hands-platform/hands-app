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
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
