import { readFileSync } from 'node:fs';

import { AdminInlineFallback } from './admin-inline-fallback';

const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('AdminInlineFallback', () => {
  it('renders missing inline values with the shared Vuexy muted fallback class', () => {
    const fallback = AdminInlineFallback({
      children: 'No bank transaction',
    });

    expect(fallback.type).toBe('span');
    expect(fallback.props).toMatchObject({
      className: 'admin-inline-fallback',
      children: 'No bank transaction',
    });
  });

  it('preserves caller spacing classes without duplicating the fallback class', () => {
    const fallback = AdminInlineFallback({
      children: 'No journal entry',
      className: 'admin-mt-8 admin-inline-fallback',
    });

    expect(fallback.props.className).toBe('admin-inline-fallback admin-mt-8');
  });

  it('keeps inline fallbacks on the Vuexy body-small muted rhythm', () => {
    const fallbackIndex = globalsCss.indexOf('.admin-inline-fallback {');
    const fallbackBlock = cssRuleBlockAt(fallbackIndex);

    expect(fallbackIndex).toBeGreaterThan(-1);
    expect(fallbackBlock).toContain('align-items: center');
    expect(fallbackBlock).toContain('display: inline-flex');
    expect(fallbackBlock).toContain('font-size: 0.8125rem');
    expect(fallbackBlock).toContain('line-height: 20px');
    expect(fallbackBlock).toContain('max-width: 100%');
    expect(fallbackBlock).toContain('overflow-wrap: anywhere');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalsCss.indexOf('}', index);
  return globalsCss.slice(index, endIndex + 1);
}
