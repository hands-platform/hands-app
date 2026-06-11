import { readOptionalNumber, readOptionalString } from './booking-readers';

describe('booking readers', () => {
  it('reads finite numbers from numeric and string values', () => {
    expect(readOptionalNumber(12)).toBe(12);
    expect(readOptionalNumber('12.5')).toBe(12.5);
    expect(readOptionalNumber('')).toBe(0);
    expect(readOptionalNumber('abc')).toBeNull();
    expect(readOptionalNumber(Number.NaN)).toBeNull();
  });

  it('reads trimmed non-empty strings', () => {
    expect(readOptionalString('  ready  ')).toBe('ready');
    expect(readOptionalString('')).toBeNull();
    expect(readOptionalString('   ')).toBeNull();
    expect(readOptionalString(12)).toBeNull();
  });
});
