import {
  vietnamRegionCodeFromCoordinate,
  vietnamRegionCodeFromValues,
  vietnamRegionLabel,
} from './admin-vietnam-region-overview';

describe('admin Vietnam region overview helpers', () => {
  it('maps Vietnamese booking address text to the operating region bucket', () => {
    expect(
      vietnamRegionCodeFromValues([
        'Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội 10000 Việt Nam',
      ]),
    ).toBe('hanoi');

    expect(
      vietnamRegionCodeFromValues([
        '85/9 Phạm Viết Chánh, Thạnh Mỹ Tây, Hồ Chí Minh 700000 Việt Nam',
      ]),
    ).toBe('hcm');

    expect(
      vietnamRegionCodeFromValues(['32 Phan Huy Ích, Vũng Tàu, Hồ Chí Minh 790000 Việt Nam']),
    ).toBe('vung-tau');
  });

  it('maps English city text and nested records without exposing coordinates', () => {
    expect(
      vietnamRegionCodeFromValues([
        {
          addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
          latitude: 10.776,
          longitude: 106.7,
        },
      ]),
    ).toBe('hcm');
  });

  it('uses stored coordinates as an aggregate-only fallback when address text is incomplete', () => {
    expect(
      vietnamRegionCodeFromValues(['Custom price payout smoke flow'], {
        latitude: '10.7769',
        longitude: '106.7009',
      }),
    ).toBe('hcm');

    expect(vietnamRegionCodeFromCoordinate({ latitude: 21.0278, longitude: 105.8342 })).toBe(
      'hanoi',
    );
  });

  it('keeps unknown Vietnamese addresses in the other Vietnam bucket', () => {
    expect(vietnamRegionCodeFromValues(['Vietnam service address'])).toBe('other-vietnam');
    expect(vietnamRegionLabel('unknown')).toBe('Other Vietnam');
  });
});
