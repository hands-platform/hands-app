import { coordinatePairLabel, readAddressText } from './booking-address-readers';

describe('booking address readers', () => {
  it('formats coordinate pairs to four decimals when both values are finite', () => {
    expect(coordinatePairLabel(10.7769, '106.7009')).toBe('10.7769, 106.7009');
    expect(coordinatePairLabel('10.7', null)).toBe('10.7000, 0.0000');
    expect(coordinatePairLabel('invalid', '106.7')).toBeNull();
  });

  it('reads address text from strings and known address object fields', () => {
    expect(readAddressText('  12 Nguyen Hue  ')).toBe('12 Nguyen Hue');
    expect(readAddressText({ formattedAddress: 'District 1' })).toBe('District 1');
    expect(readAddressText({ addressText: '  Da Nang  ', street: 'fallback' })).toBe('Da Nang');
    expect(readAddressText({ street: 'Hoi An' })).toBe('Hoi An');
    expect(readAddressText({ addressText: '   ' })).toBeNull();
  });
});
