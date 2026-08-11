import { describe, expect, it } from 'vitest';

import { paymentClearingStateModel } from './payment-clearing-state-model';

describe('paymentClearingStateModel', () => {
  it('allows matching only for open states with a remaining amount', () => {
    expect(paymentClearingStateModel('OPEN', 300000).isMatchable).toBe(true);
    expect(paymentClearingStateModel('PARTIALLY_CLEARED', 100000).isMatchable).toBe(true);
    expect(paymentClearingStateModel('OPEN', 0).isMatchable).toBe(false);
  });

  it('keeps cleared and reversed evidence terminal even when legacy remaining data is positive', () => {
    expect(paymentClearingStateModel('CLEARED', 300000)).toMatchObject({
      isMatchable: false,
      isTerminal: true,
      resultLabel: 'Fully matched',
    });
    expect(paymentClearingStateModel('REVERSED', 300000)).toMatchObject({
      closedAtLabel: 'Closed at',
      isMatchable: false,
      isTerminal: true,
      resultLabel: 'Reversed',
    });
  });
});
