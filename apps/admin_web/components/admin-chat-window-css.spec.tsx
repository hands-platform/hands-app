import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin chat window CSS', () => {
  it('keeps chat empty states on the shared Vuexy empty-state rhythm', () => {
    const emptyIndex = globalsCss.indexOf('.admin-chat-empty-state {');
    const emptyBlock = cssRuleBlockAt(emptyIndex);

    expect(emptyIndex).toBeGreaterThan(-1);
    expect(emptyBlock).toContain('border: 1px dashed var(--admin-border)');
    expect(emptyBlock).toContain('border-radius: var(--admin-radius)');
    expect(emptyBlock).toContain('padding: 18px');
    expect(emptyBlock).toContain('text-align: center');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
