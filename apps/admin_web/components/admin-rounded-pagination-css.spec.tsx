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

  it.each([
    ['booking', '.vuexy-booking-page-link:disabled,'],
    ['review', '.vuexy-review-page-link.is-disabled {'],
  ])('keeps %s disabled pagination controls on the Vuexy disabled opacity', (_label, selector) => {
    const disabledIndex = globalsCss.indexOf(selector);
    const disabledBlock = cssRuleBlockAt(disabledIndex);

    expect(disabledIndex).toBeGreaterThan(-1);
    expect(disabledBlock).toContain('cursor: not-allowed');
    expect(disabledBlock).toContain('opacity: 0.45');
    expect(disabledBlock).toContain('pointer-events: none');
  });

  it.each([
    ['booking', '.vuexy-booking-page-link {'],
    ['review', '.vuexy-review-page-link {'],
  ])('keeps %s pagination numbers on the Vuexy medium button weight', (_label, selector) => {
    const pageLinkIndex = globalsCss.indexOf(selector);
    const pageLinkBlock = cssRuleBlockAt(pageLinkIndex);

    expect(pageLinkIndex).toBeGreaterThan(-1);
    expect(pageLinkBlock).toContain('font-weight: 500');
    expect(pageLinkBlock).not.toContain('font-weight: 700');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
