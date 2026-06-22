import {
  customerBookingAddressEvidenceLabel,
  customerSelectedLocationDetail,
} from './customer-detail-location-copy';

describe('customer detail location copy', () => {
  it('shows selected customer service locations without exposing raw coordinates', () => {
    expect(
      customerSelectedLocationDetail({
        addressText: 'Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội',
        latitude: 21.036,
        longitude: 105.782,
      }),
    ).toBe('Đ. Xuân Thủy/241 P. Dịch Vọng Hậu, Cầu Giấy, Hà Nội');
  });

  it('uses a readable fallback when only selected-location coordinates exist', () => {
    expect(
      customerSelectedLocationDetail({
        addressText: '',
        latitude: 21.036,
        longitude: 105.782,
      }),
    ).toBe('Saved service address without readable address text');
  });

  it('shows booking address evidence without appending snapshot coordinates', () => {
    expect(
      customerBookingAddressEvidenceLabel({
        addressSnapshot: {
          addressText: 'Láng, Hà Nội',
          latitude: 21.02,
          longitude: 105.8,
        },
      }),
    ).toBe('Láng, Hà Nội');
  });

  it('does not expose legacy booking pins when no readable address exists', () => {
    expect(customerBookingAddressEvidenceLabel({ lat: 21.02, lng: 105.8 })).toBe(
      'Booking address saved without readable address text',
    );
  });
});
