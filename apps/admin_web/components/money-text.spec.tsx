import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MoneyText, moneyTextClassName } from './money-text';

describe('MoneyText', () => {
  it('maps amount direction to operator-safe classes', () => {
    expect(moneyTextClassName(120000)).toBe('money-text money-text-positive');
    expect(moneyTextClassName(0)).toBe('money-text money-text-zero');
    expect(moneyTextClassName(-50000)).toBe('money-text money-text-negative');
    expect(moneyTextClassName(null)).toBe('money-text money-text-muted');
  });

  it('renders formatted VND by default', () => {
    const text = MoneyText({ amount: 120000 });

    expect(text.type).toBe('span');
    expect(text.props).toMatchObject({
      className: 'money-text money-text-positive',
      children: '120.000 VND',
    });
  });

  it('renders fallback copy when amount is not set', () => {
    const text = MoneyText({ amount: null, fallback: 'No ledger amount' });

    expect(text.props).toMatchObject({
      className: 'money-text money-text-muted',
      children: 'No ledger amount',
    });
  });

  it('keeps money values backed by the Vuexy numeric display token contract', () => {
    const globals = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
    const moneyBlock = cssRuleBlock(globals, '.money-text {');

    expect(globals).toContain('.money-text {');
    expect(moneyBlock).toContain('font-feature-settings: "tnum" 1;');
    expect(moneyBlock).toContain('font-variant-numeric: tabular-nums;');
    expect(moneyBlock).toContain('font-weight: 600;');
    expect(moneyBlock).toContain('letter-spacing: 0;');
    expect(moneyBlock).toContain('white-space: nowrap;');
    expect(globals).toContain('.money-text-positive {');
    expect(globals).toContain('.money-text-negative {');
    expect(globals).toContain('.money-text-zero {');
    expect(globals).toContain('.money-text-muted {');
    expect(globals).toContain('color: var(--admin-muted);');
  });
});

function cssRuleBlock(source: string, selector: string) {
  const index = source.indexOf(selector);
  if (index < 0) {
    return '';
  }

  const endIndex = source.indexOf('}', index);
  return source.slice(index, endIndex + 1);
}
