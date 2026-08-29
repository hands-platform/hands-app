import { paymentClearingBulkAssignmentReady } from './payment-clearing-selection-controls';

const ownerOptions = [
  { value: '' },
  { value: 'finance-owner-1' },
];

describe('paymentClearingBulkAssignmentReady', () => {
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
      expect(paymentClearingBulkAssignmentReady(selectedCount, options, owner, reason)).toBe(expected);
    },
  );
});
