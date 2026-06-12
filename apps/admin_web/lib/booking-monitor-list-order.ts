export type BookingMonitorListOrderFact = {
  readonly sortTimestampMs?: number | null;
  readonly status?: string | null;
};

export function compareBookingMonitorListOrder(
  left: BookingMonitorListOrderFact,
  right: BookingMonitorListOrderFact,
) {
  const priorityDelta =
    bookingMonitorStatusPriority(right.status) - bookingMonitorStatusPriority(left.status);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  return (right.sortTimestampMs ?? 0) - (left.sortTimestampMs ?? 0);
}

export function bookingMonitorStatusPriority(status?: string | null) {
  if (status === 'NO_SHOW') {
    return 6;
  }
  if (status === 'IN_SERVICE') {
    return 5;
  }
  if (status === 'PROVIDER_ON_THE_WAY' || status === 'ARRIVED') {
    return 4;
  }
  if (status === 'MATCHED') {
    return 3;
  }
  if (status === 'OPEN_MATCHING') {
    return 2;
  }
  return 1;
}
