import type { AdminBookingDetail } from '../../../lib/admin-api';
import { addressLabel, bookingAddressSnapshotLabel } from './booking-formatters';

describe('booking formatters', () => {
  it('formats structured address parts while ignoring pin labels', () => {
    expect(addressLabel({ label: 'Booking pin 16.0471, 108.2062' })).toBe('Address pending');
    expect(addressLabel({ line1: '12 Nguyen Hue', city: 'Da Nang' })).toBe('12 Nguyen Hue, Da Nang');
  });

  it('prefers real booking address text over snapshot pin labels', () => {
    const booking = {
      address: { formattedAddress: '88 Tran Phu, Da Nang' },
      addressSnapshot: {
        address: { label: 'Booking pin 16.0471, 108.2062' },
        addressText: null,
      },
      serviceAddressText: null,
    } as AdminBookingDetail;

    expect(bookingAddressSnapshotLabel(booking)).toBe('88 Tran Phu, Da Nang');
  });

  it('keeps server-computed service address as the strongest display source', () => {
    const booking = {
      address: { formattedAddress: '88 Tran Phu, Da Nang' },
      addressSnapshot: {
        address: { formattedAddress: 'Snapshot fallback address' },
        addressText: 'Snapshot text address',
      },
      serviceAddressText: '12 Nguyen Hue, Da Nang',
    } as AdminBookingDetail;

    expect(bookingAddressSnapshotLabel(booking)).toBe('12 Nguyen Hue, Da Nang');
  });
});
