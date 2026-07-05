import {
  formatCurrencyAmount,
  formatPendingDateTime,
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

  it('formats pending date-time values for realtime operation signals', () => {
    expect(formatPendingDateTime(null)).toBe('pending');
    expect(formatPendingDateTime('not-a-date')).toBe('pending');
    expect(formatPendingDateTime(new Date(0).toISOString())).toBe('pending');
    expect(formatPendingDateTime('2026-06-26T20:39:00.000Z')).toBe('27 Jun 2026, 03:39');
  });
});
