import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingProviderLocationMetricHelper,
  bookingProviderLocationMetricValue,
} from '../../../lib/booking-provider-location-copy';
import {
  latestProviderLocation,
  latestProviderLocationFreshness,
} from './booking-status-location';

export function bookingDetailProviderLocationMetricValue(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricValue(latestProviderLocationFreshness(booking));
}

export function bookingDetailProviderLocationMetricHelper(booking: AdminBookingDetail) {
  return bookingProviderLocationMetricHelper(latestProviderLocation(booking)?.recordedAt);
}
