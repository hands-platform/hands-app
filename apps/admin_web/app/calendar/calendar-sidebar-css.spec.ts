import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../globals.css', import.meta.url), 'utf8');

describe('Calendar sidebar CSS', () => {
  it('keeps the calendar sidebar on Vuexy SidebarLeft width and p-6 spacing', () => {
    const shellBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-shell {'));
    const sectionBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-sidebar-section {'));
    const miniPickerSectionBlock = cssRuleBlockAt(
      globalsCss.indexOf('.calendar-sidebar-section:has(.calendar-mini-picker) {'),
    );

    expect(shellBlock).toContain('grid-template-columns: 280px minmax(0, 1fr)');
    expect(sectionBlock).toContain('padding: 24px');
    expect(sectionBlock).not.toContain('padding: 16px');
    expect(miniPickerSectionBlock).toContain('padding: 0');
  });

  it('scopes hashtag filter typography to the checkbox label slots', () => {
    expect(globalsCss).toContain(
      '.calendar-filter-row .admin-form-checkbox-label > span:not(.pill):not(.calendar-filter-count)',
    );
    expect(globalsCss).not.toContain('.calendar-filter-row span:not(.pill) {');
  });

  it('reserves the mini datepicker space while the lazy bundle loads', () => {
    const skeletonBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-mini-datepicker-skeleton {'));

    expect(skeletonBlock).toContain('min-block-size: 286px');
    expect(skeletonBlock).toContain('inline-size: 100%');
  });

  it('scopes Vuexy datepicker navigation chrome to direct navigation buttons', () => {
    expect(globalsCss).toContain(
      '.calendar-vuexy-datepicker > .react-datepicker__navigation > .react-datepicker__navigation-icon',
    );
    expect(globalsCss).toContain('.calendar-vuexy-datepicker > .react-datepicker__navigation::before');
    expect(globalsCss).not.toContain('.calendar-vuexy-datepicker .react-datepicker__navigation-icon {');
    expect(globalsCss).not.toContain('.calendar-vuexy-datepicker .react-datepicker__navigation::before');
  });

  it('keeps Vuexy time picker focus styling separate from selected styling', () => {
    expect(globalsCss).not.toContain(
      '.calendar-vuexy-datepicker .react-datepicker__time-list-item--selected,\n' +
        '.calendar-vuexy-datepicker .react-datepicker__time-list-item:focus',
    );
    expect(globalsCss).toContain('.calendar-vuexy-datepicker .react-datepicker__time-list-item:focus {');
    expect(globalsCss).toContain(
      '.calendar-vuexy-datepicker .react-datepicker__time-list-item:focus:not(.react-datepicker__time-list-item--selected) {',
    );
    expect(globalsCss).toContain('.calendar-vuexy-datepicker .react-datepicker__time-list-item--selected {');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
