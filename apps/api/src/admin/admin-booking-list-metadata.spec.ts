import { BookingStatus } from '@prisma/client';
import { bookingServiceAddressText } from './admin-booking-list-metadata';

describe('admin booking list metadata', () => {
  it('prefers real booking address text over snapshot pin labels', () => {
    expect(
      bookingServiceAddressText({
        address: { formattedAddress: '88 Tran Phu, Da Nang' },
        addressSnapshot: {
          address: { label: 'Booking pin 16.0471, 108.2062' },
          addressText: null,
        },
        status: BookingStatus.OPEN_MATCHING,
      }),
    ).toBe('88 Tran Phu, Da Nang');
  });

  it('builds address text from parts before falling back to nested labels', () => {
    expect(
      bookingServiceAddressText({
        address: {
          address: { label: 'Selected pin 16.0471, 108.2062' },
          line1: '12 Nguyen Hue',
          city: 'Da Nang',
        },
        addressSnapshot: null,
        status: BookingStatus.CREATED,
      }),
    ).toBe('12 Nguyen Hue, Da Nang');
  });
});
