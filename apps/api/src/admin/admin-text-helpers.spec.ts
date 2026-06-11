import { normalizeAuditReason, normalizeNullable, slugify } from './admin-text-helpers';

describe('admin text helpers', () => {
  it('normalizes nullable operator text', () => {
    expect(normalizeNullable('  review note  ')).toBe('review note');
    expect(normalizeNullable('   ')).toBeNull();
    expect(normalizeNullable(null)).toBeNull();
  });

  it('builds stable service group slugs', () => {
    expect(slugify('Massage Đặc Biệt 60m')).toBe('massage_dac_biet_60m');
    expect(slugify('***')).toBe('service');
  });

  it('normalizes audit reasons with a bounded fallback', () => {
    expect(normalizeAuditReason('  Need   admin   review  ')).toBe('Need admin review');
    expect(normalizeAuditReason('')).toBe('No reason provided by API caller');
    expect(normalizeAuditReason('a'.repeat(600))).toHaveLength(500);
  });
});
