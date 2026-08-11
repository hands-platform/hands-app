import { summarizeBankReconciliationSelection } from './bank-reconciliation-selection-summary';

describe('summarizeBankReconciliationSelection', () => {
  it('summarizes selected amount and overdue work without mixing currencies', () => {
    expect(
      summarizeBankReconciliationSelection([
        { amount: 250000, currency: 'VND', overdue: true },
        { amount: 500000, currency: 'VND', overdue: false },
        { amount: 20, currency: 'USD', overdue: true },
      ]),
    ).toEqual({
      amounts: ['750.000 VND', '20 USD'],
      count: 3,
      overdueCount: 2,
    });
  });
});
