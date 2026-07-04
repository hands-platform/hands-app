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

  it('keeps the shared react-datepicker header spacing on the Vuexy template rhythm', () => {
    const headerTitleIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__current-month,',
    );
    const headerTitleBlock = cssRuleBlockAt(headerTitleIndex);

    expect(headerTitleIndex).toBeGreaterThan(-1);
    expect(headerTitleBlock).toContain('padding: 12px 16px 18px');
    expect(headerTitleBlock).not.toContain('padding: 12px 16px;');
  });

  it('keeps today dates on Vuexy normal font weight instead of local bold emphasis', () => {
    const todayIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__day--today:not(.react-datepicker__day--selected)',
    );
    const todayBlock = cssRuleBlockAt(todayIndex);

    expect(todayIndex).toBeGreaterThan(-1);
    expect(todayBlock).toContain('font-weight: 400');
    expect(todayBlock).not.toContain('font-weight: 500');
  });

  it('matches Vuexy text field focus weight on shared form controls', () => {
    const focusIndex = globalsCss.indexOf('.admin-form-search:focus-within,');
    const focusBlock = cssRuleBlockAt(focusIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('border-width: 2px');
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
  });

  it('keeps Vuexy focused input padding compensation so controls do not resize', () => {
    const compactFocusIndex = globalsCss.indexOf('.admin-form-search:focus-within,');
    const compactFocusBlock = cssRuleBlockAt(compactFocusIndex);
    const labeledFocusIndex = globalsCss.indexOf('.admin-form-input.admin-form-control-labeled:focus-within,');
    const labeledFocusBlock = cssRuleBlockAt(labeledFocusIndex);
    const dateFocusIndex = globalsCss.indexOf('.admin-form-date.admin-form-control-labeled:focus-within,');
    const dateFocusBlock = cssRuleBlockAt(dateFocusIndex);

    expect(compactFocusBlock).toContain('padding-inline: 13px');
    expect(labeledFocusBlock).toContain('padding: 7px 11px');
    expect(dateFocusBlock).toContain('padding: 7px 41px 7px 11px');
  });

  it('animates placeholders like Vuexy CustomTextField on shared inputs', () => {
    const placeholderIndex = globalsCss.indexOf('.admin-form-input input::placeholder,');
    const placeholderBlock = cssRuleBlockAt(placeholderIndex);
    const focusedPlaceholderIndex = globalsCss.indexOf('.admin-form-input:focus-within input::placeholder,');
    const focusedPlaceholderBlock = cssRuleBlockAt(focusedPlaceholderIndex);

    expect(placeholderBlock).toContain('transition:');
    expect(placeholderBlock).toContain('transform var(--admin-transition)');
    expect(focusedPlaceholderBlock).toContain('transform: translateX(4px)');
  });

  it('keeps visible shared form labels on the Vuexy text-primary color', () => {
    const labelIndex = globalsCss.indexOf('.admin-form-label {');
    const labelBlock = cssRuleBlockAt(labelIndex);
    const textareaLabelIndex = globalsCss.indexOf('.admin-form-textarea > span:first-child {');
    const textareaLabelBlock = cssRuleBlockAt(textareaLabelIndex);

    expect(labelIndex).toBeGreaterThan(-1);
    expect(textareaLabelIndex).toBeGreaterThan(-1);
    expect(labelBlock).toContain('color: var(--admin-text)');
    expect(textareaLabelBlock).toContain('color: var(--admin-text)');
    expect(labelBlock).not.toContain('color: var(--admin-muted)');
    expect(textareaLabelBlock).not.toContain('color: var(--admin-muted)');
  });

  it('keeps shared textareas on the same Vuexy focus and placeholder motion as inputs', () => {
    const focusIndex = globalsCss.indexOf('.admin-form-textarea textarea:focus,');
    const focusBlock = cssRuleBlockAt(focusIndex);
    const placeholderIndex = globalsCss.indexOf('.admin-form-textarea textarea::placeholder');
    const placeholderBlock = cssRuleBlockAt(placeholderIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('border-width: 2px');
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).toContain('padding: var(--admin-input-padding-focused-md)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
    expect(placeholderBlock).toContain('transform var(--admin-transition)');
  });

  it.each([
    ['calendar field', '.calendar-field input:focus,'],
    ['coupon forms', '.coupon-edit-form input:focus,'],
    ['operator notes', '.ops-note-form textarea:focus,'],
  ])('keeps %s focused inputs off the legacy double-ring treatment', (_label, selector) => {
    const focusIndex = globalsCss.indexOf(selector);
    const focusBlock = cssRuleBlockAt(focusIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('border-width: 2px');
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
    expect(focusBlock).not.toContain('var(--admin-focus-ring)');
  });

  it.each([
    [
      'native root fields',
      ":root\n  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not(\n    [type='hidden']\n  ):not([type='color']):focus,",
    ],
    [
      'files and referral compact fields',
      ".files-page\n  .filter-bar\n  .compact-form\n  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not(\n    [type='hidden']\n  ):not([type='color']):focus,",
    ],
  ])('keeps %s on the Vuexy focused field model', (_label, selector) => {
    const focusIndex = globalsCss.indexOf(selector);
    const focusBlock = cssRuleBlockAt(focusIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('border-width: 2px');
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
    expect(focusBlock).not.toContain('var(--admin-focus-ring)');
  });

  it('gives native placeholders the same transition contract as shared atoms', () => {
    const placeholderIndex = globalsCss.indexOf('input::placeholder,\ntextarea::placeholder');
    const placeholderBlock = cssRuleBlockAt(placeholderIndex);
    const rootPlaceholderIndex = globalsCss.indexOf(':root input::placeholder,');
    const rootPlaceholderBlock = cssRuleBlockAt(rootPlaceholderIndex);

    expect(placeholderBlock).toContain('transform var(--admin-transition)');
    expect(rootPlaceholderBlock).toContain('transform var(--admin-transition)');
  });

  it.each([
    ['calendar toggle', '.calendar-field-toggle input:focus-visible'],
    ['service duration toggle', ".service-menu-dialog .service-menu-enabled-toggle input[type='checkbox']:focus-visible"],
    ['shared checkbox mark', '.admin-form-checkbox-input:focus-visible + .admin-form-checkbox-mark'],
  ])('keeps %s focus visible states on Vuexy primary shadow only', (_label, selector) => {
    const focusIndex = globalsCss.indexOf(selector);
    const focusBlock = cssRuleBlockAt(focusIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
    expect(focusBlock).not.toContain('var(--admin-focus-ring)');
  });

  it('keeps global focus-visible treatment on the Vuexy primary shadow', () => {
    const focusIndex = globalsCss.indexOf('a:focus-visible,');
    const focusBlock = cssRuleBlockAt(focusIndex);

    expect(focusIndex).toBeGreaterThan(-1);
    expect(focusBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(focusBlock).not.toContain('0 0 0 1px var(--admin-accent)');
    expect(focusBlock).not.toContain('var(--admin-focus-ring)');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
