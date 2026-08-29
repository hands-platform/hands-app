import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\r\n?/g, '\n');

describe('Admin workspace header CSS', () => {
  it('keeps topbar icon buttons on the Vuexy medium IconButton rhythm', () => {
    const iconIndex = globalsCss.indexOf('.topbar-icon-chip {');
    const iconBlock = cssRuleBlockAt(iconIndex);
    const hoverIndex = globalsCss.indexOf('.topbar-search:hover,');
    const hoverBlock = cssRuleBlockAt(hoverIndex);

    expect(iconIndex).toBeGreaterThan(-1);
    expect(iconBlock).toContain('height: 38px');
    expect(iconBlock).toContain('width: 38px');
    expect(iconBlock).toContain('font-size: 1.375rem');
    expect(iconBlock).not.toContain('height: 36px');
    expect(iconBlock).not.toContain('width: 36px');
    expect(hoverBlock).toContain('background: var(--admin-action-hover)');
    expect(hoverBlock).not.toContain('background: var(--admin-sidebar-hover)');
  });

  it('keeps the theme control aligned with Vuexy medium IconButton sizing', () => {
    const toggleButtonIndex = globalsCss.indexOf('.theme-toggle-button {');
    const toggleButtonBlock = cssRuleBlockAt(toggleButtonIndex);

    expect(toggleButtonIndex).toBeGreaterThan(-1);
    expect(toggleButtonBlock).toContain('height: 38px');
    expect(toggleButtonBlock).toContain('min-height: 38px');
    expect(toggleButtonBlock).toContain('width: 38px');
    expect(toggleButtonBlock).toContain('font-size: 1.375rem');
    expect(toggleButtonBlock).not.toContain('height: 30px');
    expect(toggleButtonBlock).not.toContain('width: 30px');
  });

  it('keeps workspace breadcrumbs on the Vuexy Breadcrumbs link rhythm', () => {
    const breadcrumbLinkIndex = globalsCss.indexOf('.workspace-breadcrumb a {');
    const breadcrumbLinkBlock = cssRuleBlockAt(breadcrumbLinkIndex);
    const breadcrumbCurrentIndex = globalsCss.indexOf(".workspace-breadcrumb span[aria-current='page'] {");
    const breadcrumbCurrentBlock = cssRuleBlockAt(breadcrumbCurrentIndex);

    expect(breadcrumbLinkIndex).toBeGreaterThan(-1);
    expect(breadcrumbLinkBlock).toContain('color: var(--admin-link)');
    expect(breadcrumbLinkBlock).toContain('text-decoration: none');
    expect(breadcrumbCurrentIndex).toBeGreaterThan(-1);
    expect(breadcrumbCurrentBlock).toContain('color: var(--admin-text)');
  });

  it('keeps topbar dropdowns aligned with the Vuexy Menu popover rhythm', () => {
    const dropdownIndex = globalsCss.indexOf('.topbar-dropdown {');
    const dropdownBlock = cssRuleBlockAt(dropdownIndex);
    const linkIndex = globalsCss.indexOf('.topbar-dropdown-link,\n.topbar-empty {');
    const linkBlock = cssRuleBlockAt(linkIndex);

    expect(dropdownIndex).toBeGreaterThan(-1);
    expect(dropdownBlock).toContain('box-shadow: var(--admin-shadow-lg)');
    expect(dropdownBlock).toContain('padding: 8px 0');
    expect(dropdownBlock).toContain('top: calc(100% + 4px)');
    expect(dropdownBlock).not.toContain('padding: 10px');
    expect(dropdownBlock).not.toContain('top: calc(100% + 10px)');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(linkBlock).toContain('gap: 4px');
    expect(linkBlock).toContain('margin-inline: 16px');
    expect(linkBlock).toContain('padding: 10px 16px');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
