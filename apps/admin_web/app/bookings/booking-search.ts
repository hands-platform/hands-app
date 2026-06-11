import type { AdminBooking } from '../../lib/admin-api';
import { bookingServiceOptionLabel } from './booking-service-labels';

export function bookingMatchesSearch(booking: AdminBooking, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return bookingSearchHaystack(booking).includes(normalized);
}

export function bookingSearchHaystack(booking: AdminBooking) {
  return [
    booking.id,
    booking.status,
    bookingServiceOptionLabel(booking),
    booking.customerProfile?.user?.fullName,
    booking.customerProfile?.user?.phone,
    booking.preferredProvider?.displayName,
    booking.preferredProvider?.user?.fullName,
    booking.preferredProvider?.user?.phone,
    booking.selectedProvider?.displayName,
    booking.selectedProvider?.user?.fullName,
    booking.selectedProvider?.user?.phone,
    booking.payment?.method,
    booking.payment?.status,
    booking.payment?.providerRef,
    ...(booking.participants ?? []).flatMap((participant) => [
      participant.providerProfile?.displayName,
      participant.providerProfile?.user?.fullName,
      participant.providerProfile?.user?.phone,
      participant.status,
    ]),
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ')
    .toLowerCase();
}

export function uniqueSortedOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((left, right) =>
    left.localeCompare(right),
  );
}
