import { readFileSync } from 'node:fs';

describe('Admin font loading policy', () => {
  it('does not block Admin page rendering on external Google Fonts CSS', () => {
    const globalCss = readFileSync('app/globals.css', 'utf8');

    expect(globalCss.includes('fonts.googleapis.com')).toBe(false);
    expect(globalCss.includes('@import url(')).toBe(false);
  });
});
