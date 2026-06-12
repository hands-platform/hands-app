import type { AdminBooking } from '../../lib/admin-api';
import {
  hasProviderCoordinate,
  type BookingLocationNeedsOpsFromFactsInput,
} from '../../lib/booking-status-location-helpers';
import { providerLocationFreshness } from './booking-location-display';

type BookingProviderLocationBooking = Pick<AdminBooking, 'participants' | 'selectedProvider'>;

export function bookingHasProviderLocation(booking: BookingProviderLocationBooking): boolean {
  if (hasProviderCoordinate(booking.selectedProvider)) {
    return true;
  }

  return (booking.participants ?? []).some((participant) =>
    hasProviderCoordinate(participant.providerProfile),
  );
}

export function bookingLocationNeedsOpsInput(
  booking: AdminBooking,
  nowMs: number,
): BookingLocationNeedsOpsFromFactsInput {
  return {
    status: booking.status,
    hasProviderLocation: bookingHasProviderLocation(booking),
    providerLocationFreshness: providerLocationFreshness(booking, nowMs),
  };
}
