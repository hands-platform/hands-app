type BookingTimeInput = {
  openedAt?: string | null;
  createdAt?: string | null;
  scheduledStartAt?: string | null;
  expiresAt?: string | null;
  updatedAt?: string | null;
};

export function bookingRequestOpenedAt(booking: BookingTimeInput) {
  return booking.openedAt ?? booking.createdAt ?? booking.scheduledStartAt ?? null;
}

export function bookingRecordCreatedAt(booking: BookingTimeInput) {
  return booking.createdAt ?? booking.scheduledStartAt ?? null;
}

export function bookingListSortTimestamp(booking: BookingTimeInput) {
  return bookingRecordCreatedAt(booking) ?? booking.expiresAt ?? null;
}

export function bookingEventTimestamp(booking: BookingTimeInput) {
  return booking.createdAt ?? booking.updatedAt ?? booking.scheduledStartAt ?? null;
}

export function bookingLatestActivityAt(booking: BookingTimeInput) {
  return booking.updatedAt ?? booking.createdAt ?? booking.scheduledStartAt ?? null;
}
