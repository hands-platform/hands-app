import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin form control CSS', () => {
  it('lets Vuexy button tone classes override the base form action shell', () => {
    const baseIndex = globalsCss.indexOf('.admin-form-control-button,');
    const primaryIndex = globalsCss.indexOf('.admin-form-control-button.button-primary');
    const secondaryIndex = globalsCss.indexOf('.admin-form-control-link.button-secondary');
    const outlineIndex = globalsCss.indexOf('.admin-form-control-button.button-outline');

    expect(baseIndex).toBeGreaterThan(-1);
    expect(primaryIndex).toBeGreaterThan(baseIndex);
    expect(secondaryIndex).toBeGreaterThan(baseIndex);
    expect(outlineIndex).toBeGreaterThan(baseIndex);
    expect(globalsCss.slice(primaryIndex, secondaryIndex)).toContain('border: 1px solid var(--admin-accent)');
  });

  it('styles shared checkboxes through the Vuexy mark layer instead of the browser default control', () => {
    const baseIndex = globalsCss.indexOf('.admin-form-checkbox {');
    const inputIndex = globalsCss.indexOf('.admin-form-checkbox-input');
    const markIndex = globalsCss.indexOf('.admin-form-checkbox-mark');
    const checkedIndex = globalsCss.indexOf('.admin-form-checkbox-input:checked + .admin-form-checkbox-mark');

    expect(baseIndex).toBeGreaterThan(-1);
    expect(inputIndex).toBeGreaterThan(baseIndex);
    expect(markIndex).toBeGreaterThan(inputIndex);
    expect(checkedIndex).toBeGreaterThan(markIndex);
    expect(globalsCss.slice(markIndex, checkedIndex)).toContain('border-radius: 4px');
    expect(globalsCss.slice(checkedIndex, checkedIndex + 240)).toContain('background: var(--admin-accent)');
  });

  it('keeps inline react-datepicker navigation aligned with the Vuexy 30px control position', () => {
    const inlineNavigationIndex = globalsCss.indexOf(
      '.react-datepicker.calendar-vuexy-datepicker-inline > .react-datepicker__navigation',
    );
    const inlineNavigationBlock = cssRuleBlockAt(inlineNavigationIndex);

    expect(inlineNavigationIndex).toBeGreaterThan(-1);
    expect(inlineNavigationBlock).toContain('top: 12px');
    expect(inlineNavigationBlock).not.toContain('top: 8px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
