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
    expect(readAddressText({ address_text: 'Da Nang nested legacy key' })).toBe('Da Nang nested legacy key');
    expect(readAddressText({ formatted_address: 'Da Nang snake case' })).toBe('Da Nang snake case');
    expect(readAddressText({ street: 'Hoi An' })).toBe('Hoi An');
    expect(readAddressText({ addressText: '   ' })).toBeNull();
  });

  it('reads nested address objects and composed address parts', () => {
    expect(readAddressText({ address: { formattedAddress: 'Nested service address' } })).toBe(
      'Nested service address',
    );
    expect(
      readAddressText({
        address: { line1: 'Ignored because parts live outside' },
        ward: 'Ward 1',
        district: 'District 3',
        city: 'Ho Chi Minh City',
      }),
    ).toBe('Ward 1, District 3, Ho Chi Minh City');
    expect(readAddressText({ ward: 'Ward 2', district: 'District 7', city: 'Ho Chi Minh City' })).toBe(
      'Ward 2, District 7, Ho Chi Minh City',
    );
  });

  it('does not treat pin or coordinate labels as real addresses', () => {
    expect(readAddressText('10.7769, 106.7009')).toBeNull();
    expect(readAddressText({ label: 'Booking pin 10.7769, 106.7009' })).toBeNull();
    expect(
      readAddressText({
        address: { label: 'Selected pin 10.7769, 106.7009' },
        line1: '12 Nguyen Hue',
        city: 'Da Nang',
      }),
    ).toBe('12 Nguyen Hue, Da Nang');
  });
});
