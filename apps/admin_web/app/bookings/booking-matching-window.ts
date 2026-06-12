type BookingMatchingWindowFact = {
  readonly expiresAt?: Date | string | null;
  readonly status: string;
};

export function bookingMatchingWindowExpired(
  booking: BookingMatchingWindowFact,
  nowMs: number,
): boolean {
  if (booking.status !== 'OPEN_MATCHING' || !booking.expiresAt || nowMs <= 0) {
    return false;
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt < nowMs;
}

export function bookingMatchingWindowLabel(
  booking: BookingMatchingWindowFact,
  nowMs: number,
): string {
  if (!booking.expiresAt || nowMs <= 0) {
    return 'window pending';
  }
  const expiresAt = new Date(booking.expiresAt).getTime();
  if (!Number.isFinite(expiresAt)) {
    return 'window invalid';
  }

  const minutes = Math.round((expiresAt - nowMs) / 60_000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes === 0) {
    return 'expires now';
  }
  return `${minutes}m left`;
}
