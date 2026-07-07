import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin responsive shell CSS', () => {
  it('collapses the Vuexy admin shell below the desktop sidebar breakpoint', () => {
    const responsiveIndex = globalsCss.indexOf('@media (max-width: 1023px) {');
    const responsiveBlock = cssNestedBlockAt(responsiveIndex);

    expect(responsiveIndex).toBeGreaterThan(-1);
    expect(responsiveBlock).toContain('body,');
    expect(responsiveBlock).toContain('.shell,');
    expect(responsiveBlock).toContain('.auth-shell');
    expect(responsiveBlock).toContain('min-width: 0');
    expect(responsiveBlock).toContain('.sidebar {');
    expect(responsiveBlock).toContain('display: none');
    expect(responsiveBlock).toContain('.content {');
    expect(responsiveBlock).toContain('margin-left: 0');
    expect(responsiveBlock).toContain('padding: 16px');
    expect(responsiveBlock).toContain('.topbar {');
    expect(responsiveBlock).toContain('flex-direction: column');
    expect(responsiveBlock).toContain('.topbar-actions {');
    expect(responsiveBlock).toContain('flex-wrap: wrap');
    expect(responsiveBlock).toContain('.topbar-chip {');
    expect(responsiveBlock).toContain('display: none');
  });

  it('collapses the split login layout on phone-sized screens', () => {
    const mobileIndex = globalsCss.lastIndexOf('@media (max-width: 599px) {');
    const mobileBlock = cssNestedBlockAt(mobileIndex);

    expect(mobileIndex).toBeGreaterThan(-1);
    expect(mobileBlock).toContain('.admin-auth-page {');
    expect(mobileBlock).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(mobileBlock).toContain('.admin-auth-visual {');
    expect(mobileBlock).toContain('display: none');
    expect(mobileBlock).toContain('.card.admin-auth-card {');
    expect(mobileBlock).toContain('border-left: 0');
    expect(mobileBlock).toContain('padding: 40px 24px');
  });
});

function cssNestedBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  let depth = 0;
  for (let position = index; position < globalsCss.length; position += 1) {
    const character = globalsCss[position];
    if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return globalsCss.slice(index, position + 1);
      }
    }
  }

  return globalsCss.slice(index);
}
