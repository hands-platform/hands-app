import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

describe('Calendar drawer CSS', () => {
  it('keeps shared right-side drawers on the Vuexy Drawer and Dialog spacing rhythm', () => {
    const drawerBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-drawer {'));
    const chromeBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-drawer-header,\n.calendar-drawer-footer {'));
    const bodyBlock = cssRuleBlockAt(globalsCss.indexOf('.calendar-drawer-body {'));

    expect(drawerBlock).toContain('box-shadow: var(--admin-shadow-lg)');
    expect(drawerBlock).toContain('width: 400px');
    expect(chromeBlock).toContain('padding: 24px');
    expect(chromeBlock).not.toContain('padding: 20px 24px');
    expect(bodyBlock).toContain('padding: 24px');
    expect(bodyBlock).not.toContain('padding: 20px 24px');
  });

  it('keeps nested review drawer footers aligned after the shared 24px drawer padding', () => {
    const reviewFooterIndex = globalsCss.indexOf('.review-edit-drawer-form .calendar-drawer-footer {');
    const reviewFooterBlock = cssRuleBlockAt(reviewFooterIndex);

    expect(reviewFooterIndex).toBeGreaterThan(-1);
    expect(reviewFooterBlock).toContain('margin: 2px -24px -24px');
    expect(reviewFooterBlock).not.toContain('margin: 2px -24px -20px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
