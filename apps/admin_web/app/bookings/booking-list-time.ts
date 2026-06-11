import type { AdminBooking } from '../../lib/admin-api';
import { bookingEventTimestamp, bookingListSortTimestamp } from '../../lib/admin-booking-time';
import { formatDateTime } from '../../lib/admin-format';

const displayTimeZone = 'Asia/Ho_Chi_Minh';
const clockFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: displayTimeZone,
});

export function bookingTimestamp(booking: AdminBooking) {
  return new Date(bookingListSortTimestamp(booking) ?? 0).getTime();
}

export function bookingCreatedTimestamp(booking: AdminBooking) {
  const value = bookingEventTimestamp(booking);
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function relativeTimeLabel(value: string, nowMs: number) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'unknown time';
  }

  const reference = nowMs > 0 ? nowMs : Date.now();
  const minutesAgo = Math.max(0, Math.round((reference - timestamp) / 60_000));
  if (minutesAgo < 1) {
    return 'just now';
  }
  if (minutesAgo < 60) {
    return `${minutesAgo}m ago`;
  }

  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `${hoursAgo}h ago`;
  }
  return `${Math.round(hoursAgo / 24)}d ago`;
}

export function formatBookingDate(value?: string | null) {
  return formatDateTime(value, 'No request time');
}

export function formatBookingClockTime(value: Date) {
  return clockFormatter.format(value);
}

export function bookingRecencyLabel(booking: AdminBooking, nowMs: number | null) {
  const timestamp = bookingListSortTimestamp(booking);
  if (!timestamp) {
    return 'Created time unavailable';
  }
  if (!nowMs) {
    return 'Recency loading...';
  }

  const minutesAgo = Math.max(0, Math.round((nowMs - new Date(timestamp).getTime()) / 60_000));
  if (minutesAgo < 1) {
    return 'Updated just now';
  }
  if (minutesAgo < 60) {
    return `Updated ${minutesAgo}m ago`;
  }
  const hoursAgo = Math.round(minutesAgo / 60);
  if (hoursAgo < 24) {
    return `Updated ${hoursAgo}h ago`;
  }
  const daysAgo = Math.round(hoursAgo / 24);
  return `Updated ${daysAgo}d ago`;
}

export function bookingAgeLabel(booking: AdminBooking, nowMs: number) {
  const timestamp = bookingListSortTimestamp(booking);
  if (!timestamp || nowMs <= 0) {
    return 'age pending';
  }

  const minutes = Math.max(0, Math.round((nowMs - new Date(timestamp).getTime()) / 60_000));
  if (minutes < 60) {
    return `${minutes}m old`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h old`;
  }
  return `${Math.round(hours / 24)}d old`;
}
