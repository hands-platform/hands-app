import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin rounded pagination CSS', () => {
  it.each([
    ['booking', '.vuexy-booking-page-link:not(:disabled):hover'],
    ['review', '.vuexy-review-page-link:not(.is-disabled):hover'],
  ])('keeps %s pagination hover color on the Vuexy primary token', (_label, selector) => {
    const hoverIndex = globalsCss.indexOf(selector);
    const hoverBlock = cssRuleBlockAt(hoverIndex);

    expect(hoverIndex).toBeGreaterThan(-1);
    expect(hoverBlock).toContain('color: var(--admin-accent-strong)');
    expect(hoverBlock).not.toContain('#8f85f3');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
