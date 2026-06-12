export type BookingMonitorBasicFiltersInput = {
  readonly paymentFilter: string;
  readonly paymentMethod?: string | null;
  readonly status?: string | null;
  readonly statusFilter: string;
};

export function bookingMatchesMonitorBasicFilters(input: BookingMonitorBasicFiltersInput) {
  return (
    bookingMatchesMonitorStatusFilter(input.status, input.statusFilter) &&
    bookingMatchesMonitorPaymentFilter(input.paymentMethod, input.paymentFilter)
  );
}

export function bookingMatchesMonitorStatusFilter(
  status: string | null | undefined,
  statusFilter: string,
) {
  return statusFilter === 'all' || status === statusFilter;
}

export function bookingMatchesMonitorPaymentFilter(
  paymentMethod: string | null | undefined,
  paymentFilter: string,
) {
  return paymentFilter === 'all' || (paymentMethod ?? 'NO_PAYMENT') === paymentFilter;
}
