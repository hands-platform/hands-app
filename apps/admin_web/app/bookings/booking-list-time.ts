import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingEventTimestamp,
  bookingListSortTimestamp,
  bookingRequestOpenedAt,
} from '../../lib/admin-booking-time';
import { formatDateTime } from '../../lib/admin-format';
import type { AdminQueueSort } from '../../lib/admin-queue-list';

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

export function orderBookingsForQueue(
  bookings: readonly AdminBooking[],
  sort: AdminQueueSort,
  preserveServerOrder: boolean,
) {
  if (preserveServerOrder) return bookings;

  const direction = sort === 'oldest' ? 1 : -1;
  return [...bookings].sort((left, right) => {
    const timeDifference = bookingRequestTimestamp(left) - bookingRequestTimestamp(right);
    return timeDifference === 0 ? left.id.localeCompare(right.id) : timeDifference * direction;
  });
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

export function deadlineRelativeLabel(value: string | null | undefined, nowMs: number) {
  if (!value || nowMs <= 0) {
    return 'Deadline unavailable';
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Deadline unavailable';
  }

  const minutes = Math.round(Math.abs(timestamp - nowMs) / 60_000);
  const duration =
    minutes < 60
      ? `${minutes}m`
      : minutes < 24 * 60
        ? `${Math.round(minutes / 60)}h`
        : `${Math.round(minutes / (24 * 60))}d`;
  return timestamp <= nowMs ? `${duration} overdue` : `${duration} remaining`;
}

export function formatBookingDate(value?: string | null) {
  return formatDateTime(value, 'No request time');
}

export function formatBookingClockTime(value: Date) {
  return clockFormatter.format(value);
}

export function bookingStatusEvent(booking: AdminBooking) {
  const timestamp = ['COMPLETED', 'REFUNDED', 'EXPIRED'].includes(booking.status)
    ? bookingStatusEventTimestamp(booking)
    : booking.statusChangedAt ?? bookingStatusEventTimestamp(booking);
  const label = (booking.statusChangedLabel?.trim() || bookingStatusEventLabel(booking)).replace(
    /\s+at$/u,
    '',
  );
  const parsedTimestamp = timestamp ? new Date(timestamp) : null;

  return {
    clockLabel:
      parsedTimestamp && Number.isFinite(parsedTimestamp.getTime())
        ? formatBookingClockTime(parsedTimestamp)
        : null,
    dateLabel: timestamp ? formatBookingDate(timestamp) : 'Time unavailable',
    label,
    relativeLabel:
      timestamp && nowTimestampIsUsable(timestamp)
        ? (nowMs: number | null) =>
            nowMs ? `${label} ${relativeTimeLabel(timestamp, nowMs)}` : `${label} time loading...`
        : () => `${label} time unavailable`,
    timestamp,
  };
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

function bookingStatusEventTimestamp(booking: AdminBooking) {
  switch (booking.status) {
    case 'CREATED':
    case 'OPEN_MATCHING':
      return booking.openedAt ?? booking.createdAt ?? booking.updatedAt ?? null;
    case 'MATCHED':
      return booking.matchedAt ?? booking.updatedAt ?? null;
    case 'PROVIDER_ON_THE_WAY':
    case 'ARRIVED':
    case 'IN_SERVICE':
      return booking.updatedAt ?? booking.matchedAt ?? null;
    case 'COMPLETED':
    case 'CANCELLED':
    case 'NO_SHOW':
      return booking.closedAt ?? booking.updatedAt ?? booking.createdAt ?? null;
    case 'EXPIRED':
      return booking.closedAt ?? booking.expiresAt ?? booking.updatedAt ?? booking.createdAt ?? null;
    case 'REFUNDED':
      return booking.closedAt ?? booking.updatedAt ?? booking.createdAt ?? null;
    default:
      return booking.updatedAt ?? booking.createdAt ?? null;
  }
}

function bookingStatusEventLabel(booking: AdminBooking) {
  switch (booking.status) {
    case 'CREATED':
      return 'Requested';
    case 'OPEN_MATCHING':
      return 'Matching opened';
    case 'MATCHED':
      return 'Matched';
    case 'PROVIDER_ON_THE_WAY':
      return 'Partner on the way';
    case 'ARRIVED':
      return 'Arrived';
    case 'IN_SERVICE':
      return 'Service started';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return booking.matchedAt || booking.selectedProviderId || booking.selectedProvider
        ? 'Partner cancelled'
        : 'Cancelled';
    case 'NO_SHOW':
      return 'No-show marked';
    case 'EXPIRED':
      return 'Expired';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return 'Updated';
  }
}

function nowTimestampIsUsable(value: string) {
  return Number.isFinite(new Date(value).getTime());
}

function bookingRequestTimestamp(booking: AdminBooking) {
  const value = bookingRequestOpenedAt(booking);
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}
