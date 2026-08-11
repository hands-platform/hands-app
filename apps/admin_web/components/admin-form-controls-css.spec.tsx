import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin form control CSS', () => {
  it('keeps every shared admin design token reference defined', () => {
    const usedTokens = new Set(globalsCss.match(/var\((--admin-[\w-]+)/g)?.map((token) => token.slice(4)) ?? []);
    const definedTokens = new Set(globalsCss.match(/--admin-[\w-]+(?=\s*:)/g) ?? []);
    const missingTokens = [...usedTokens].filter((token) => !definedTokens.has(token)).sort();

    expect(missingTokens).toEqual([]);
  });

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

  it('keeps shared admin form buttons on the Vuexy medium button rhythm', () => {
    const baseIndex = globalsCss.indexOf('.admin-form-control-button,');
    const baseBlock = cssRuleBlockAt(baseIndex);

    expect(baseIndex).toBeGreaterThan(-1);
    expect(baseBlock).toContain('font-weight: 500');
    expect(baseBlock).toContain('min-height: 38px');
    expect(baseBlock).not.toContain('font-weight: 700');
    expect(baseBlock).not.toContain('min-height: 40px');
  });

  it('keeps shared booking chat close buttons on compact icon-button dimensions', () => {
    const closeButtonIndex = globalsCss.indexOf('.admin-form-control-button.booking-chat-close {');
    const closeButtonBlock = cssRuleBlockAt(closeButtonIndex);

    expect(closeButtonIndex).toBeGreaterThan(-1);
    expect(closeButtonBlock).toContain('height: 34px');
    expect(closeButtonBlock).toContain('min-height: 34px');
    expect(closeButtonBlock).toContain('padding: 0');
    expect(closeButtonBlock).toContain('width: 34px');
  });

  it('styles shared checkboxes through the Vuexy mark layer instead of the browser default control', () => {
    const baseIndex = globalsCss.indexOf('\n.admin-form-checkbox {');
    const inputIndex = globalsCss.indexOf('\n.admin-form-checkbox-input {');
    const markIndex = globalsCss.indexOf('\n.admin-form-checkbox-mark {');
    const checkedIndex = globalsCss.indexOf('\n.admin-form-checkbox-input:checked + .admin-form-checkbox-mark {');

    expect(baseIndex).toBeGreaterThan(-1);
    expect(inputIndex).toBeGreaterThan(baseIndex);
    expect(markIndex).toBeGreaterThan(inputIndex);
    expect(checkedIndex).toBeGreaterThan(markIndex);
    expect(globalsCss.slice(markIndex, checkedIndex)).toContain('border-radius: 4px');
    expect(globalsCss.slice(checkedIndex, checkedIndex + 240)).toContain('background: var(--admin-accent)');
  });

  it('keeps calendar hashtag filters on the shared checkbox mark layer', () => {
    const rawInputIndex = globalsCss.indexOf('.calendar-filter-row input {');
    const markIndex = globalsCss.indexOf('.calendar-filter-row .admin-form-checkbox-mark {');
    const checkedIndex = globalsCss.indexOf(
      '.calendar-filter-row .admin-form-checkbox-input:checked + .admin-form-checkbox-mark {',
    );
    const labelIndex = globalsCss.indexOf('.calendar-filter-row .admin-form-checkbox-label {');
    const markBlock = cssRuleBlockAt(markIndex);
    const labelBlock = cssRuleBlockAt(labelIndex);

    expect(rawInputIndex).toBe(-1);
    expect(markIndex).toBeGreaterThan(-1);
    expect(checkedIndex).toBeGreaterThan(markIndex);
    expect(markBlock).toContain('border: 2px solid var(--admin-disabled)');
    expect(markBlock).toContain('margin: 0 9px');
    expect(labelBlock).toContain('display: flex');
    expect(labelBlock).toContain('flex: 1 1 auto');
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

  it('keeps calendar view tabs on the Vuexy pill TabList active treatment', () => {
    const segmentedIndex = globalsCss.indexOf('.calendar-segmented-control {');
    const segmentedBlock = cssRuleBlockAt(segmentedIndex);
    const tabIndex = globalsCss.indexOf('.calendar-segmented-control .booking-date-filter-button {');
    const tabBlock = cssRuleBlockAt(tabIndex);
    const activeIndex = globalsCss.indexOf('.calendar-segmented-control .booking-date-filter-button.is-active {');
    const activeBlock = cssRuleBlockAt(activeIndex);

    expect(segmentedBlock).toContain('gap: 8px');
    expect(segmentedBlock).not.toContain('overflow: hidden');
    expect(tabBlock).toContain('background: transparent');
    expect(tabBlock).not.toContain('background: var(--admin-primary-soft)');
    expect(activeBlock).toContain('background: var(--admin-accent)');
    expect(activeBlock).toContain('box-shadow: var(--admin-primary-shadow-sm)');
    expect(activeBlock).toContain('color: var(--admin-inverse-text)');
  });

  it('keeps shared date/filter toggle buttons on the Vuexy rounded control radius', () => {
    const filterButtonIndex = globalsCss.indexOf('.booking-date-filter-buttons :is(a, button) {');
    const filterButtonBlock = cssRuleBlockAt(filterButtonIndex);

    expect(filterButtonIndex).toBeGreaterThan(-1);
    expect(filterButtonBlock).toContain('border-radius: var(--admin-radius)');
    expect(filterButtonBlock).toContain('min-height: 38px');
    expect(filterButtonBlock).not.toContain('border-radius: 999px');
  });

  it('keeps shared segmented controls on the Vuexy pill TabList inactive treatment', () => {
    const filterButtonIndex = globalsCss.indexOf('.booking-date-filter-buttons :is(a, button) {');
    const filterButtonBlock = cssRuleBlockAt(filterButtonIndex);
    const inactiveHoverIndex = globalsCss.indexOf('.booking-date-filter-buttons :is(a, button):not(.is-active):hover,');
    const legacyHoverIndex = globalsCss.indexOf('.booking-date-filter-buttons :is(a, button):hover {');

    expect(filterButtonBlock).toContain('background: transparent');
    expect(filterButtonBlock).toContain('border: 1px solid transparent');
    expect(filterButtonBlock).toContain('font-weight: 500');
    expect(filterButtonBlock).not.toContain('background: var(--admin-surface)');
    expect(filterButtonBlock).not.toContain('border: 1px solid var(--admin-border-strong)');
    expect(inactiveHoverIndex).toBeGreaterThan(-1);
    expect(legacyHoverIndex).toBe(-1);
  });

  it('limits calendar view tab hover treatment to inactive tabs', () => {
    const inactiveHoverIndex = globalsCss.indexOf(
      '.calendar-segmented-control .booking-date-filter-button:not(.is-active):hover,',
    );
    const legacyHoverIndex = globalsCss.indexOf('.calendar-segmented-control .booking-date-filter-button:hover,');

    expect(inactiveHoverIndex).toBeGreaterThan(-1);
    expect(legacyHoverIndex).toBe(-1);
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

  it('keeps react-datepicker month containers constrained inside Vuexy form surfaces', () => {
    const monthContainerIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__month-container {');
    const monthContainerBlock = cssRuleBlockAt(monthContainerIndex);
    const inlineMonthContainerIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker-inline .react-datepicker__month-container {',
    );
    const inlineMonthContainerBlock = cssRuleBlockAt(inlineMonthContainerIndex);

    expect(monthContainerIndex).toBeGreaterThan(-1);
    expect(inlineMonthContainerIndex).toBeGreaterThan(-1);
    expect(monthContainerBlock).toContain('box-sizing: border-box');
    expect(monthContainerBlock).toContain('max-inline-size: 100%');
    expect(monthContainerBlock).toContain('min-inline-size: 0');
    expect(inlineMonthContainerBlock).toContain('max-inline-size: 100%');
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

  it('keeps month, year, and quarter picker tiles on the Vuexy template rhythm', () => {
    const tileIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__month-text,');
    const tileBlock = cssRuleBlockAt(tileIndex);
    const todayIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__month-text--today,');
    const todayBlock = cssRuleBlockAt(todayIndex);

    expect(tileIndex).toBeGreaterThan(-1);
    expect(todayIndex).toBeGreaterThan(tileIndex);
    expect(tileBlock).toContain('align-items: center');
    expect(tileBlock).toContain('border-radius: var(--admin-radius)');
    expect(tileBlock).toContain('display: inline-flex');
    expect(tileBlock).toContain('font-size: 0.9375rem');
    expect(tileBlock).toContain('justify-content: center');
    expect(tileBlock).toContain('line-height: 2rem');
    expect(todayBlock).toContain('border: 1px solid var(--admin-accent)');
    expect(todayBlock).toContain('color: var(--admin-accent)');
    expect(todayBlock).toContain('font-weight: 400');
  });

  it('keeps react-datepicker month and year dropdown menus on the Vuexy popover surface', () => {
    const dropdownIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__header__dropdown {');
    const dropdownBlock = cssRuleBlockAt(dropdownIndex);
    const menuIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__month-dropdown,');
    const menuBlock = cssRuleBlockAt(menuIndex);
    const optionIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__month-option,');
    const optionBlock = cssRuleBlockAt(optionIndex);
    const selectedOptionIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__month-option.react-datepicker__month-option--selected_month,',
    );
    const selectedOptionBlock = cssRuleBlockAt(selectedOptionIndex);

    expect(dropdownIndex).toBeGreaterThan(-1);
    expect(menuIndex).toBeGreaterThan(dropdownIndex);
    expect(optionIndex).toBeGreaterThan(menuIndex);
    expect(selectedOptionIndex).toBeGreaterThan(optionIndex);
    expect(dropdownBlock).toContain('gap: 32px');
    expect(dropdownBlock).toContain('padding: 0 16px 16px');
    expect(menuBlock).toContain('background: var(--admin-surface)');
    expect(menuBlock).toContain('box-shadow: var(--admin-shadow-lg)');
    expect(menuBlock).toContain('border-radius: var(--admin-radius)');
    expect(optionBlock).toContain('border-radius: var(--admin-radius)');
    expect(optionBlock).toContain('padding: 6px 16px');
    expect(selectedOptionBlock).toContain('background: var(--admin-primary-soft)');
    expect(selectedOptionBlock).toContain('color: var(--admin-accent)');
  });

  it('keeps selected react-datepicker dates on the Vuexy primary-dark hover treatment', () => {
    const selectedHoverIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__day--selected:hover,',
    );
    const selectedHoverBlock = cssRuleBlockAt(selectedHoverIndex);

    expect(selectedHoverIndex).toBeGreaterThan(-1);
    expect(selectedHoverBlock).toContain('background: var(--admin-accent-strong) !important');
    expect(selectedHoverBlock).toContain('color: var(--admin-inverse-text) !important');
  });

  it('keeps readonly datepicker inputs stable when opening the Vuexy picker', () => {
    const genericFocusIndex = globalsCss.indexOf(
      '.admin-form-date.admin-form-control-labeled input:focus,\n.admin-form-input.admin-form-control-labeled input:focus,',
    );
    const datepickerFocusIndex = globalsCss.indexOf(
      '.calendar-datepicker-input > input.admin-form-date-input[readonly]:focus,',
    );
    const datepickerFocusBlock = cssRuleBlockAt(datepickerFocusIndex);

    expect(genericFocusIndex).toBeGreaterThan(-1);
    expect(datepickerFocusIndex).toBeGreaterThan(genericFocusIndex);
    expect(datepickerFocusBlock).toContain('border-width: 1px');
    expect(datepickerFocusBlock).toContain('outline: 0');
    expect(datepickerFocusBlock).toContain('padding: 7.25px 42px 7.25px 14px');
    expect(datepickerFocusBlock).not.toContain('padding: 6.25px 41px 6.25px 13px');
  });

  it('keeps time picker rows on Vuexy body typography and selected weight', () => {
    const timeItemIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__time-list-item {');
    const timeItemBlock = cssRuleBlockAt(timeItemIndex);
    const selectedIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__time-list-item--selected {',
    );
    const selectedBlock = cssRuleBlockAt(selectedIndex);

    expect(timeItemIndex).toBeGreaterThan(-1);
    expect(selectedIndex).toBeGreaterThan(-1);
    expect(timeItemBlock).toContain('font-size: 0.9375rem');
    expect(timeItemBlock).not.toContain('font-size: 0.8125rem');
    expect(selectedBlock).toContain('font-weight: 400');
  });

  it('keeps the react-datepicker time panel on the Vuexy surface in dark mode', () => {
    const timeContainerIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__time-container {');
    const timeContainerBlock = cssRuleBlockAt(timeContainerIndex);
    const timeSurfaceIndex = globalsCss.indexOf(
      '.react-datepicker.calendar-vuexy-datepicker .react-datepicker__time-container .react-datepicker__time,',
    );
    const timeSurfaceBlock = cssRuleBlockAt(timeSurfaceIndex);

    expect(timeContainerIndex).toBeGreaterThan(-1);
    expect(timeSurfaceIndex).toBeGreaterThan(-1);
    expect(timeContainerBlock).toContain('background: var(--admin-surface)');
    expect(timeSurfaceBlock).toContain('background: var(--admin-surface) !important');
  });

  it('keeps react-datepicker time list scrollbars on the Vuexy template surface', () => {
    const scrollbarIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__time-list::-webkit-scrollbar {');
    const scrollbarTrackIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__time-list::-webkit-scrollbar-track {',
    );
    const scrollbarThumbIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__time-list::-webkit-scrollbar-thumb {',
    );
    const scrollbarBlock = cssRuleBlockAt(scrollbarIndex);
    const scrollbarTrackBlock = cssRuleBlockAt(scrollbarTrackIndex);
    const scrollbarThumbBlock = cssRuleBlockAt(scrollbarThumbIndex);

    expect(scrollbarIndex).toBeGreaterThan(-1);
    expect(scrollbarTrackIndex).toBeGreaterThan(scrollbarIndex);
    expect(scrollbarThumbIndex).toBeGreaterThan(scrollbarTrackIndex);
    expect(scrollbarBlock).toContain('width: 8px');
    expect(scrollbarTrackBlock).toContain('background: var(--admin-surface)');
    expect(scrollbarThumbBlock).toContain('border-radius: 10px');
    expect(scrollbarThumbBlock).toContain('background: rgb(var(--admin-main-channel) / 0.34)');
  });

  it('keeps disabled react-datepicker time rows on the Vuexy disabled contract', () => {
    const disabledIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__time-list-item--disabled {',
    );
    const disabledSelectedIndex = globalsCss.indexOf(
      '.calendar-vuexy-datepicker .react-datepicker__time-list-item--disabled.react-datepicker__time-list-item--selected {',
    );
    const disabledBlock = cssRuleBlockAt(disabledIndex);
    const disabledSelectedBlock = cssRuleBlockAt(disabledSelectedIndex);

    expect(disabledIndex).toBeGreaterThan(-1);
    expect(disabledSelectedIndex).toBeGreaterThan(disabledIndex);
    expect(disabledBlock).toContain('color: var(--admin-disabled)');
    expect(disabledBlock).toContain('pointer-events: none');
    expect(disabledSelectedBlock).toContain('background: var(--admin-action-hover) !important');
    expect(disabledSelectedBlock).toContain('font-weight: 400');
  });

  it('keeps clearable react-datepicker icons on the Vuexy transparent close affordance', () => {
    const closeIconIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__close-icon {');
    const closeIconBlock = cssRuleBlockAt(closeIconIndex);
    const closeIconAfterIndex = globalsCss.indexOf('.calendar-vuexy-datepicker .react-datepicker__close-icon::after {');
    const closeIconAfterBlock = cssRuleBlockAt(closeIconAfterIndex);

    expect(closeIconIndex).toBeGreaterThan(-1);
    expect(closeIconAfterIndex).toBeGreaterThan(closeIconIndex);
    expect(closeIconBlock).toContain('padding-inline-end: 16px');
    expect(closeIconBlock).toContain('top: 10px');
    expect(closeIconAfterBlock).toContain('background: transparent !important');
    expect(closeIconAfterBlock).toContain('color: var(--admin-text)');
    expect(closeIconAfterBlock).toContain('font-size: 1.5rem');
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
    const compactDateFocusIndex = globalsCss.indexOf('.admin-form-date:focus-within,');
    const compactDateFocusBlock = cssRuleBlockAt(compactDateFocusIndex);
    const labeledShellFocusIndex = globalsCss.indexOf('.admin-form-input.admin-form-control-labeled:focus-within,');
    const labeledShellFocusBlock = cssRuleBlockAt(labeledShellFocusIndex);
    const labeledFieldFocusIndex = globalsCss.indexOf('.admin-form-input.admin-form-control-labeled input:focus,');
    const labeledFieldFocusBlock = cssRuleBlockAt(labeledFieldFocusIndex);
    const dateFieldFocusIndex = globalsCss.lastIndexOf('.admin-form-date.admin-form-control-labeled input:focus,');
    const dateFieldFocusBlock = cssRuleBlockAt(dateFieldFocusIndex);

    expect(compactFocusBlock).toContain('padding-inline: 13px');
    expect(compactDateFocusBlock).toContain('padding-inline: 13px 41px');
    expect(compactDateFocusBlock).not.toContain('padding-right: 41px');
    expect(labeledShellFocusBlock).toContain('border: 0');
    expect(labeledShellFocusBlock).toContain('box-shadow: none');
    expect(labeledShellFocusBlock).toContain('padding: 0');
    expect(labeledFieldFocusBlock).toContain('border-width: 2px');
    expect(labeledFieldFocusBlock).toContain('padding: var(--admin-input-padding-focused-sm)');
    expect(dateFieldFocusBlock).toContain('padding: 6.25px 41px 6.25px 13px');
  });

  it('keeps visible-label form controls on the Vuexy label-outside field model', () => {
    const shellIndex = globalsCss.indexOf('.admin-form-date.admin-form-control-labeled,');
    const shellBlock = cssRuleBlockAt(shellIndex);
    const textareaShellIndex = globalsCss.indexOf('.admin-form-textarea.admin-form-control-labeled');
    const fieldIndex = globalsCss.lastIndexOf(
      '.admin-form-date.admin-form-control-labeled input,\n' +
        '.admin-form-input.admin-form-control-labeled input,\n' +
        '.admin-form-select.admin-form-control-labeled select,\n' +
        '.admin-form-static-value.admin-form-control-labeled strong {',
    );
    const fieldBlock = cssRuleBlockAt(fieldIndex);
    const dateIconIndex = globalsCss.indexOf('.admin-form-date.admin-form-control-labeled::after,');
    const dateIconBlock = cssRuleBlockAt(dateIconIndex);
    const selectArrowIndex = globalsCss.indexOf('.admin-form-select.admin-form-control-labeled::after');
    const selectArrowBlock = cssRuleBlockAt(selectArrowIndex);

    expect(shellIndex).toBeGreaterThan(-1);
    expect(textareaShellIndex).toBeGreaterThan(shellIndex);
    expect(fieldIndex).toBeGreaterThan(shellIndex);
    expect(shellBlock).toContain('background: transparent');
    expect(shellBlock).toContain('border: 0');
    expect(shellBlock).toContain('.admin-form-textarea.admin-form-control-labeled');
    expect(shellBlock).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(shellBlock).toContain('padding: 0');
    expect(fieldBlock).toContain('background: var(--admin-surface)');
    expect(fieldBlock).toContain('border: 1px solid var(--admin-input-border)');
    expect(fieldBlock).toContain('min-height: var(--admin-control-height-sm)');
    expect(dateIconBlock).toContain('bottom: calc((var(--admin-control-height-sm) - 18px) / 2)');
    expect(selectArrowBlock).toContain('bottom: 15px');
  });

  it('hides native date input indicators behind the shared Vuexy calendar icon', () => {
    const dateIconIndex = globalsCss.indexOf('.admin-form-date::after,');
    const dateIconBlock = cssRuleBlockAt(dateIconIndex);
    const nativeIndicatorIndex = globalsCss.indexOf('.admin-form-date input::-webkit-calendar-picker-indicator,');
    const nativeIndicatorBlock = cssRuleBlockAt(nativeIndicatorIndex);

    expect(dateIconIndex).toBeGreaterThan(-1);
    expect(nativeIndicatorIndex).toBeGreaterThan(dateIconIndex);
    expect(dateIconBlock).toContain('pointer-events: none');
    expect(dateIconBlock).toContain('mask: url("data:image/svg+xml');
    expect(nativeIndicatorBlock).toContain('background: transparent');
    expect(nativeIndicatorBlock).toContain('color: transparent');
    expect(nativeIndicatorBlock).toContain('opacity: 0');
    expect(nativeIndicatorBlock).toContain('width: 38px');
  });

  it('keeps labeled input shells from creating a second visible field box', () => {
    const shellIndex = globalsCss.indexOf('.admin-form-date.admin-form-control-labeled,');
    const shellBlock = cssRuleBlockAt(shellIndex);
    const fieldIndex = globalsCss.lastIndexOf(
      '.admin-form-date.admin-form-control-labeled input,\n' +
        '.admin-form-input.admin-form-control-labeled input,\n' +
        '.admin-form-select.admin-form-control-labeled select,\n' +
        '.admin-form-static-value.admin-form-control-labeled strong {',
    );
    const fieldBlock = cssRuleBlockAt(fieldIndex);

    expect(shellBlock).toContain('display: grid');
    expect(shellBlock).toContain('inline-size: 100%');
    expect(shellBlock).toContain('min-width: 0');
    expect(shellBlock).toContain('overflow: visible');
    expect(fieldBlock).toContain('box-sizing: border-box');
    expect(fieldBlock).toContain('min-width: 0');
  });

  it('keeps datepicker wrapper shells fluid inside grid layouts', () => {
    const wrapperIndex = globalsCss.indexOf(
      '.calendar-datepicker-field,\n.calendar-datepicker-field .react-datepicker-wrapper,',
    );
    const wrapperBlock = cssRuleBlockAt(wrapperIndex);

    expect(wrapperIndex).toBeGreaterThan(-1);
    expect(wrapperBlock).toContain('display: block');
    expect(wrapperBlock).toContain('inline-size: 100%');
    expect(wrapperBlock).toContain('min-width: 0');
    expect(globalsCss).not.toContain('label.admin-form-date.admin-form-control-labeled');
  });

  it('keeps date-time native picker affordances aligned behind one Vuexy calendar icon', () => {
    const labeledIconIndex = globalsCss.indexOf('.admin-form-date.admin-form-control-labeled::after,');
    const labeledIconBlock = cssRuleBlockAt(labeledIconIndex);
    const nativeIndicatorIndex = globalsCss.indexOf('.admin-form-date input::-webkit-calendar-picker-indicator,');
    const nativeIndicatorBlock = cssRuleBlockAt(nativeIndicatorIndex);

    expect(labeledIconBlock).toContain('bottom: calc((var(--admin-control-height-sm) - 18px) / 2)');
    expect(nativeIndicatorBlock).toContain('position: absolute');
    expect(nativeIndicatorBlock).toContain('inset-block: 0');
    expect(nativeIndicatorBlock).toContain('inset-inline-end: 0');
    expect(nativeIndicatorBlock).toContain('margin: 0');
    expect(nativeIndicatorBlock).toContain('padding: 0');
  });

  it('keeps late compact input resets from stripping visible-label field borders', () => {
    const visibleFieldIndex = globalsCss.lastIndexOf(
      '.admin-form-date.admin-form-control-labeled input,\n' +
        '.admin-form-input.admin-form-control-labeled input,\n' +
        '.admin-form-select.admin-form-control-labeled select,\n' +
        '.admin-form-static-value.admin-form-control-labeled strong {',
    );
    const lateResetIndex = globalsCss.lastIndexOf(
      '.admin-form-search input,\n' +
        '.admin-form-date:not(.admin-form-control-labeled) input,\n' +
        '.admin-form-input:not(.admin-form-control-labeled) input,',
    );
    const lateResetBlock = cssRuleBlockAt(lateResetIndex);

    expect(visibleFieldIndex).toBeGreaterThan(-1);
    expect(lateResetIndex).toBeGreaterThan(visibleFieldIndex);
    expect(globalsCss).toContain(':root\n  .admin-form-date:not(.admin-form-control-labeled)');
    expect(globalsCss).toContain(':root\n  .admin-form-input:not(.admin-form-control-labeled)');
    expect(globalsCss).toContain(':root .admin-form-select:not(.admin-form-control-labeled) > select');
    expect(globalsCss).not.toContain(':root\n  .admin-form-date\n  > input:not');
    expect(globalsCss).not.toContain(':root\n  .admin-form-input\n  > input:not');
    expect(globalsCss).not.toContain(':root .admin-form-select > select {');
    expect(lateResetBlock).toContain('.admin-form-date:not(.admin-form-control-labeled) input');
    expect(lateResetBlock).toContain('.admin-form-input:not(.admin-form-control-labeled) input');
    expect(lateResetBlock).toContain('.admin-form-select:not(.admin-form-control-labeled) select');
    expect(lateResetBlock).not.toContain('\n.admin-form-date input,');
    expect(lateResetBlock).not.toContain('\n.admin-form-input input,');
    expect(lateResetBlock).not.toContain('\n.admin-form-select select,');
  });

  it('keeps standalone native fields from resizing on Vuexy focused border weight', () => {
    const rootFocusIndex = globalsCss.indexOf(
      ":root\n  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not(\n    [type='hidden']\n  ):not([type='color']):focus,",
    );
    const rootFocusBlock = cssRuleBlockAt(rootFocusIndex);

    expect(rootFocusIndex).toBeGreaterThan(-1);
    expect(rootFocusBlock).toContain('border-width: 2px');
    expect(rootFocusBlock).toContain('padding: var(--admin-input-padding-focused-sm)');
  });

  it('reserves Vuexy select end-adornment space after native field resets', () => {
    const resetIndex = globalsCss.lastIndexOf(
      '.admin-form-search input,\n.admin-form-date:not(.admin-form-control-labeled) input,',
    );
    const resetBlock = cssRuleBlockAt(resetIndex);
    const selectPaddingIndex = globalsCss.lastIndexOf(
      '.admin-form-select:not(.admin-form-control-labeled) select,\n.admin-directory-filter-select select {',
    );
    const selectPaddingBlock = cssRuleBlockAt(selectPaddingIndex);

    expect(resetIndex).toBeGreaterThan(-1);
    expect(resetBlock).toContain('padding: 0');
    expect(selectPaddingIndex).toBeGreaterThan(resetIndex);
    expect(selectPaddingBlock).toContain('padding-inline-end: 32px');
    expect(selectPaddingBlock).not.toContain('padding-right: 22px');
  });

  it('stretches compact select and search controls across the visible Vuexy hit area', () => {
    const compactSearchSelector = globalsCss.indexOf(
      ':root .admin-form-search > input:not([type=\'checkbox\'])',
    );
    const compactControlIndex = globalsCss.lastIndexOf(
      ':root .admin-form-search > input:not([type=\'checkbox\'])',
      globalsCss.indexOf('align-self: stretch', compactSearchSelector),
    );
    const compactControlBlock = cssRuleBlockAt(compactControlIndex);
    const compactSelectStretchIndex = globalsCss.lastIndexOf(
      ':root .admin-form-select:not(.admin-form-control-labeled) > select',
      globalsCss.indexOf('inline-size: 100%', compactControlIndex),
    );
    const compactSelectStretchBlock = cssRuleBlockAt(compactSelectStretchIndex);
    const compactSelectIndex = globalsCss.lastIndexOf(
      ':root .admin-form-select:not(.admin-form-control-labeled) > select',
    );
    const compactSelectBlock = cssRuleBlockAt(compactSelectIndex);
    const compactShellIndex = globalsCss.lastIndexOf(
      '.admin-form-select:not(.admin-form-control-labeled),\nlabel.admin-form-select:not(.admin-form-control-labeled),',
    );
    const compactShellBlock = cssRuleBlockAt(compactShellIndex);
    const compactSearchShellIndex = globalsCss.lastIndexOf(
      '.admin-form-search,\nlabel.admin-form-search,',
    );
    const compactSearchShellBlock = cssRuleBlockAt(compactSearchShellIndex);

    expect(compactControlIndex).toBeGreaterThan(-1);
    expect(compactControlBlock).toContain('align-self: stretch');
    expect(compactControlBlock).toContain('block-size: 100%');
    expect(compactControlBlock).toContain('box-sizing: border-box');
    expect(compactControlBlock).toContain('flex: 1 1 auto');
    expect(compactControlBlock).toContain('inline-size: auto');
    expect(compactControlBlock).not.toContain('inline-size: 100%');
    expect(compactControlBlock).toContain('min-block-size: calc(var(--admin-control-height-sm) - 2px)');
    expect(compactControlBlock).toContain('min-width: 0');
    expect(compactSelectStretchBlock).toContain('inline-size: 100%');
    expect(compactSelectBlock).toContain('cursor: pointer');
    expect(compactSelectBlock).toContain('padding: 0 42px 0 14px');
    expect(compactSearchShellBlock).toContain('display: flex');
    expect(compactSearchShellBlock).toContain('flex-wrap: nowrap');
    expect(compactShellBlock).toContain('cursor: pointer');
    expect(compactShellBlock).toContain('padding: 0');
  });

  it('reserves one visible calendar icon slot for labeled date picker inputs', () => {
    const datePaddingIndex = globalsCss.indexOf(':root\n  .admin-form-date.admin-form-control-labeled');
    const datePaddingBlock = cssRuleBlockAt(datePaddingIndex);

    expect(datePaddingIndex).toBeGreaterThan(-1);
    expect(datePaddingBlock).toContain(':root\n  .admin-form-input-date-picker.admin-form-control-labeled');
    expect(datePaddingBlock).toContain("> input:not([type='checkbox'])");
    expect(datePaddingBlock).toContain('padding: 7.25px 42px 7.25px 14px');
    expect(datePaddingBlock).not.toContain('padding-inline-end');
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

  it('keeps shared static values on the Vuexy text field font token', () => {
    const staticValueIndex = globalsCss.indexOf('.admin-form-static-value strong {');
    const staticValueBlock = cssRuleBlockAt(staticValueIndex);

    expect(staticValueIndex).toBeGreaterThan(-1);
    expect(staticValueBlock).toContain('font-size: var(--admin-input-font-md)');
    expect(staticValueBlock).not.toContain('font-size: var(--admin-input-font-size)');
  });

  it('keeps disabled shared form atoms on the Vuexy disabled surface', () => {
    const shellDisabledIndex = globalsCss.indexOf('.admin-form-search:has(input:disabled),');
    const shellDisabledBlock = cssRuleBlockAt(shellDisabledIndex);
    const textareaDisabledIndex = globalsCss.indexOf('.admin-form-textarea textarea:disabled');
    const textareaDisabledBlock = cssRuleBlockAt(textareaDisabledIndex);

    expect(shellDisabledIndex).toBeGreaterThan(-1);
    expect(textareaDisabledIndex).toBeGreaterThan(-1);
    expect(shellDisabledBlock).toContain('background: var(--admin-action-hover)');
    expect(shellDisabledBlock).toContain('color: var(--admin-disabled)');
    expect(shellDisabledBlock).toContain('cursor: not-allowed');
    expect(textareaDisabledBlock).toContain('background: var(--admin-action-hover)');
    expect(textareaDisabledBlock).toContain('color: var(--admin-disabled)');
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

  it('keeps calendar drawer controls on shared Vuexy form atoms instead of page field wrappers', () => {
    expect(globalsCss).not.toContain('.calendar-drawer-field');
  });

  it('keeps page filters and edit forms from restyling shared input atoms', () => {
    expect(globalsCss).not.toContain('.coupon-edit-form input');
    expect(globalsCss).not.toContain('.service-catalog-page .form-grid input');
    expect(globalsCss).not.toContain('.chat-archive-page .form-grid input');
    expect(globalsCss).not.toContain('.partners-page .partner-filter-card .form-grid input');
    expect(globalsCss).not.toContain('.audit-log-page .form-grid input');
    expect(globalsCss).not.toContain('/* Page-scoped controls keep the same Vuexy atom baseline. */');
  });

  it('anchors shared form grid layout and field widths on the Vuexy form grid atom', () => {
    const layoutIndex = globalsCss.indexOf('.admin-form-grid,\n.form-grid {');
    const layoutBlock = cssRuleBlockAt(layoutIndex);
    const fieldWidthIndex = globalsCss.indexOf(
      '.admin-form-grid input,\n.admin-form-grid select,\n.admin-form-grid textarea,',
    );
    const fieldWidthBlock = cssRuleBlockAt(fieldWidthIndex);

    expect(layoutIndex).toBeGreaterThan(-1);
    expect(layoutBlock).toContain('display: grid');
    expect(layoutBlock).toContain('grid-template-columns: repeat(auto-fit, minmax(190px, 1fr))');
    expect(fieldWidthIndex).toBeGreaterThan(-1);
    expect(fieldWidthBlock).toContain('width: 100%');
  });

  it('keeps native root fields on the Vuexy focused field model', () => {
    const selector =
      ":root\n  input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not(\n    [type='hidden']\n  ):not([type='color']):focus,";
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
    ['calendar drawer switch', '.calendar-drawer-switch .admin-form-checkbox-input:focus-visible + .admin-form-checkbox-mark'],
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
