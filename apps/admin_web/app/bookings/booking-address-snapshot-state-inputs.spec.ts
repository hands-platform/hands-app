import type { AdminBooking } from '../../lib/admin-api';
import { bookingAddressSnapshotStateInput } from './booking-address-snapshot-state-inputs';

function booking(overrides: Partial<AdminBooking> = {}): AdminBooking {
  return {
    id: 'booking-1',
    status: 'OPEN_MATCHING',
    ...overrides,
  } as AdminBooking;
}

describe('bookingAddressSnapshotStateInput', () => {
  it('maps immutable address snapshot text and pin labels', () => {
    expect(
      bookingAddressSnapshotStateInput(
        booking({
          addressSnapshot: {
            addressText: '  12 Nguyen Hue  ',
            latitude: '10.7769',
            longitude: '106.7009',
          } as AdminBooking['addressSnapshot'],
        }),
      ),
    ).toEqual({
      hasAddressSnapshot: true,
      snapshotAddressText: '  12 Nguyen Hue  ',
      snapshotPinLabel: '10.7769, 106.7009',
      legacyAddressText: null,
      legacyPinLabel: null,
    });
  });

  it('uses legacy address and booking pin when no snapshot exists', () => {
    expect(
      bookingAddressSnapshotStateInput(
        booking({
          address: { formattedAddress: '  District 1  ' },
          lat: 10.77,
          lng: 106.69,
        }),
      ),
    ).toEqual({
      hasAddressSnapshot: false,
      snapshotAddressText: null,
      snapshotPinLabel: null,
      legacyAddressText: 'District 1',
      legacyPinLabel: '10.7700, 106.6900',
    });
  });

  it('returns null labels for unreadable address and coordinates', () => {
    expect(bookingAddressSnapshotStateInput(booking({ lat: 'bad', lng: '106.69' }))).toEqual({
      hasAddressSnapshot: false,
      snapshotAddressText: null,
      snapshotPinLabel: null,
      legacyAddressText: null,
      legacyPinLabel: null,
    });
  });
});
