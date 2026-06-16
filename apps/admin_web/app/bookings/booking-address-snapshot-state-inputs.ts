import type { AdminBooking } from '../../lib/admin-api';
import type { BookingAddressSnapshotStateInput } from '../../lib/booking-address-snapshot-state';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { coordinatePairLabel, readAddressText } from './booking-address-readers';

type BookingAddressSnapshotStateBooking = Pick<
  AdminBooking,
  'address' | 'addressSnapshot' | 'lat' | 'lng'
>;

export function bookingAddressSnapshotStateInput(
  booking: BookingAddressSnapshotStateBooking,
): BookingAddressSnapshotStateInput {
  const snapshot = booking.addressSnapshot;
  const legacyAddress = readAddressText(booking.address);

  return {
    hasAddressSnapshot: Boolean(snapshot),
    snapshotAddressText: displayAddressText(snapshot?.addressText),
    snapshotPinLabel: snapshot ? coordinatePairLabel(snapshot.latitude, snapshot.longitude) : null,
    legacyAddressText: displayAddressText(legacyAddress),
    legacyPinLabel: coordinatePairLabel(booking.lat, booking.lng),
  };
}

function displayAddressText(value?: string | null) {
  return value ? marketplaceDisplayText(value) : null;
}
