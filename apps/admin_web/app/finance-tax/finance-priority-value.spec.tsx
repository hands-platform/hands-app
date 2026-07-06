import { renderToStaticMarkup } from 'react-dom/server';

import { hasFinancePriorityWork, renderFinancePriorityValue } from './finance-priority-value';

describe('finance priority value renderer', () => {
  it('renders money priority values through the shared MoneyText atom', () => {
    const markup = renderToStaticMarkup(
      renderFinancePriorityValue({
        amount: 170_000,
        amountSuffix: 'cash debt',
        count: 3,
        currency: 'VND',
      }),
    );

    expect(markup).toContain('class="money-text money-text-positive"');
    expect(markup).toContain('170.000 VND');
    expect(markup).toContain('cash debt');
  });

  it('falls back to open count or queue copy when no amount exists', () => {
    expect(renderFinancePriorityValue({ amount: null, amountSuffix: null, count: 2, currency: null })).toBe('2 open');
    expect(renderFinancePriorityValue({ amount: null, amountSuffix: null, count: null, currency: null })).toBe(
      'Open queue',
    );
  });

  it('only treats non-zero counts or non-zero amount deltas as actionable work', () => {
    expect(hasFinancePriorityWork({ amount: null, amountSuffix: null, count: 0, currency: null })).toBe(false);
    expect(hasFinancePriorityWork({ amount: 0, amountSuffix: null, count: null, currency: 'VND' })).toBe(false);
    expect(hasFinancePriorityWork({ amount: 10_000, amountSuffix: null, count: null, currency: 'VND' })).toBe(true);
    expect(hasFinancePriorityWork({ amount: null, amountSuffix: null, count: 1, currency: null })).toBe(true);
  });
});
