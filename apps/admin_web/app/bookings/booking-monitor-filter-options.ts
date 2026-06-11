import { uniqueSortedOptions } from './booking-search';

export function bookingStatusFilterOptions<T extends { status: string }>(bookings: readonly T[]) {
  return uniqueSortedOptions(bookings.map((booking) => booking.status));
}

export function bookingPaymentFilterOptions<
  T extends { payment?: { method?: string | null } | null },
>(bookings: readonly T[]) {
  return uniqueSortedOptions(bookings.map((booking) => booking.payment?.method ?? 'NO_PAYMENT'));
}
