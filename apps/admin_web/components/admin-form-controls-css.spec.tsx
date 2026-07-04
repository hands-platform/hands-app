import { readFileSync } from 'node:fs';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('Admin form control button CSS', () => {
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
});
