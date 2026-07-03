import {
  formatCurrencyAmount,
  formatPercentLabel,
  formatWholeNumber,
} from './admin-format';

describe('admin formatting helpers', () => {
  it('formats whole-number dashboard counts consistently', () => {
    expect(formatWholeNumber(1234567.89)).toBe('1,234,568');
    expect(formatWholeNumber(0)).toBe('0');
  });

  it('formats dashboard currency amounts with the existing VND display style', () => {
    expect(formatCurrencyAmount(1234567)).toBe('₫1,234,567');
    expect(formatCurrencyAmount(1234567, 'USD')).toBe('$1,234,567');
  });

  it('formats whole-number percent labels', () => {
    expect(formatPercentLabel(42)).toBe('42%');
    expect(formatPercentLabel(1234)).toBe('1,234%');
  });
});
