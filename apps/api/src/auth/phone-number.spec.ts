import { normalizeVietnamPhoneIdentifier } from './phone-number';

describe('normalizeVietnamPhoneIdentifier', () => {
  it.each([
    ['+84901234567', '+84901234567'],
    ['84901234567', '+84901234567'],
    ['0901234567', '+84901234567'],
    ['+84 90-123-4567', '+84901234567'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeVietnamPhoneIdentifier(input)).toBe(expected);
  });

  it('keeps non-phone fallback identifiers stable', () => {
    expect(normalizeVietnamPhoneIdentifier('supabase:user-1')).toBe('supabase:user-1');
  });
});
