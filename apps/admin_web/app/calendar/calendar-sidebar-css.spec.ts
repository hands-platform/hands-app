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
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
