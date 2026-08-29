import {
  bankReconciliationBulkAssignmentReady,
  summarizeBankReconciliationSelection,
} from './bank-reconciliation-selection-summary';

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

describe('bankReconciliationBulkAssignmentReady', () => {
  const ownerOptions = [{ value: '' }, { value: 'finance-owner-1' }];

  it.each([
    [0, ownerOptions, 'finance-owner-1', 'Twelve chars!', false],
    [1, null, '', '', false],
    [1, [{ value: '' }], '', '', false],
    [1, ownerOptions, '', 'Twelve chars!', false],
    [1, ownerOptions, 'finance-owner-1', '', false],
    [1, ownerOptions, 'finance-owner-1', '11 chars...', false],
    [1, ownerOptions, 'finance-owner-1', 'Twelve chars!', true],
    [1, ownerOptions, 'not-an-option', 'Twelve chars!', false],
  ] as const)(
    'returns %s selections / owner %s / reason %s readiness as %s',
    (selectedCount, options, owner, reason, expected) => {
      expect(bankReconciliationBulkAssignmentReady(selectedCount, options, owner, reason)).toBe(expected);
    },
  );
});
