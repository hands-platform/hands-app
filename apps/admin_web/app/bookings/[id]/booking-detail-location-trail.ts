import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingLocationTrail } from '../../../lib/booking-status-location-helpers';
import { latestProviderLocation } from './booking-status-location';

export function bookingDetailLocationTrail(booking: AdminBookingDetail) {
  return bookingLocationTrail(booking.snapshots, latestProviderLocation(booking));
}
