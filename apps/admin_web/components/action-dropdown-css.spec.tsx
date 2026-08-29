import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Action dropdown CSS', () => {
  it('keeps shared action dropdown triggers and menus on the Vuexy menu rhythm', () => {
    const triggerBlock = cssRuleBlockAt(globalsCss.indexOf('.admin-action-trigger {'));
    const menuBlock = cssRuleBlockAt(globalsCss.indexOf('.admin-action-menu {'));
    const caretBlock = cssRuleBlockAt(globalsCss.indexOf('.admin-action-menu::before {'));
    const itemBlock = cssRuleBlockAt(globalsCss.indexOf('.admin-action-item {'));

    expect(triggerBlock).toContain('height: 38px');
    expect(triggerBlock).toContain('width: 38px');
    expect(triggerBlock).toContain('border-radius: var(--admin-radius)');
    expect(triggerBlock).not.toContain('height: 34px');
    expect(triggerBlock).not.toContain('width: 34px');
    expect(menuBlock).toContain('box-shadow: var(--admin-shadow-lg)');
    expect(menuBlock).toContain('padding: 8px 0');
    expect(menuBlock).toContain('top: calc(100% + 4px)');
    expect(caretBlock).toContain('display: none');
    expect(itemBlock).toContain('border-radius: var(--admin-radius)');
    expect(itemBlock).toContain('font-weight: 500');
    expect(itemBlock).toContain('gap: 16px');
    expect(itemBlock).toContain('margin-inline: 8px');
    expect(itemBlock).toContain('min-height: 38px');
    expect(itemBlock).toContain('padding: 8px 16px');
  });

  it('keeps review action dropdowns visually compatible with shared action menus', () => {
    const menuBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-review-action-menu {'));
    const caretBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-review-action-menu::before {'));
    const itemBlock = cssRuleBlockAt(globalsCss.indexOf('.vuexy-review-action-item {'));

    expect(menuBlock).toContain('box-shadow: var(--admin-shadow-lg)');
    expect(menuBlock).toContain('padding: 8px 0');
    expect(menuBlock).toContain('top: calc(100% + 4px)');
    expect(caretBlock).toContain('display: none');
    expect(itemBlock).toContain('border-radius: var(--admin-radius)');
    expect(itemBlock).toContain('font-weight: 500');
    expect(itemBlock).toContain('gap: 16px');
    expect(itemBlock).toContain('margin-inline: 8px');
    expect(itemBlock).toContain('min-height: 38px');
    expect(itemBlock).toContain('padding: 8px 16px');
    expect(itemBlock).toContain('white-space: nowrap');
    expect(itemBlock).toContain('width: auto');
    expect(itemBlock).not.toContain('width: 100%');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
