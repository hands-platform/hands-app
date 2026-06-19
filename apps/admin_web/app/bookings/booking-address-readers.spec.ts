import { coordinatePairLabel, readAddressText, serviceAddressAreaLabel } from './booking-address-readers';

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

  it('summarizes booking service addresses to area and city for list views', () => {
    expect(serviceAddressAreaLabel('Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội 10000 베트남')).toBe(
      'Cầu Giấy, Hà Nội',
    );
    expect(serviceAddressAreaLabel('159 P. Chùa Láng, Láng, Hà Nội 100000 베트남')).toBe('Láng, Hà Nội');
    expect(serviceAddressAreaLabel('Ngõ 86 Duy Tân, Cầu Giấy, Hà Nội 100000 베트남')).toBe(
      'Cầu Giấy, Hà Nội',
    );
    expect(serviceAddressAreaLabel('Ng. 91 P. Chùa Láng, Láng, Hà Nội, 베트남')).toBe('Láng, Hà Nội');
    expect(serviceAddressAreaLabel('7C Ng. 445 Đ. Nguyễn Khang, Cầu Giấy, Hà Nội, 베트남')).toBe(
      'Cầu Giấy, Hà Nội',
    );
    expect(serviceAddressAreaLabel('85/9 Phạm Viết Chánh, Thạnh Mỹ Tây, Hồ Chí Minh 700000 베트남')).toBe(
      'Thạnh Mỹ Tây, Hồ Chí Minh',
    );
    expect(serviceAddressAreaLabel('Hẻm 1 Đ. Số 9, Khu Phố 4, An Khánh, Hồ Chí Minh, 베트남')).toBe(
      'An Khánh, Hồ Chí Minh',
    );
    expect(serviceAddressAreaLabel('32 Phan Huy Ích, Vũng Tàu, Hồ Chí Minh 790000 베트남')).toBe(
      'Vũng Tàu, Hồ Chí Minh',
    );
    expect(serviceAddressAreaLabel('22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City')).toBe(
      'District 1, Ho Chi Minh City',
    );
  });
});
