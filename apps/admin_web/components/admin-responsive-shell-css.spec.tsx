import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin desktop-only shell CSS', () => {
  it('blocks touch-first small screens without blocking desktop browser zoom', () => {
    const blockerIndex = globalsCss.lastIndexOf(
      '@media (max-width: 1023px) and (any-pointer: coarse) {',
    );
    const blockerBlock = cssNestedBlockAt(blockerIndex);

    expect(blockerIndex).toBeGreaterThan(-1);
    expect(blockerBlock).toContain('.admin-desktop-only-app {');
    expect(blockerBlock).toContain('display: none !important');
    expect(blockerBlock).toContain('.admin-desktop-only-blocker {');
    expect(blockerBlock).toContain('display: grid');
    expect(blockerBlock).toContain('min-height: 100dvh');
  });
});

function cssNestedBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  let depth = 0;
  for (let position = index; position < globalsCss.length; position += 1) {
    const character = globalsCss[position];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return globalsCss.slice(index, position + 1);
      }
    }
  }

  return globalsCss.slice(index);
}
