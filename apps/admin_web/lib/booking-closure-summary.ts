import { formatDateTime } from './admin-format';

const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export type BookingClosureSummaryInput = {
  status?: string | null;
  closedAt?: string | null;
  closedByRole?: string | null;
  closedReason?: string | null;
  closedNote?: string | null;
};

export type BookingClosureSummary = {
  status: string;
  detail: string;
};

export function bookingClosureSummary(booking: BookingClosureSummaryInput): BookingClosureSummary {
  if (!booking.closedAt) {
    return {
      status: terminalBookingStatuses.has(booking.status ?? '')
        ? 'Terminal without closure stamp'
        : 'Open',
      detail: terminalBookingStatuses.has(booking.status ?? '')
        ? 'This booking is terminal but has no explicit closure actor/reason saved.'
        : 'No closure has been recorded yet.',
    };
  }

  const actor = booking.closedByRole
    ? `${booking.closedByRole.toLowerCase()} closure`
    : 'closure actor missing';
  const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'reason not saved';
  const note = booking.closedNote ? ` / ${booking.closedNote}` : '';

  return {
    status: formatDateTime(booking.closedAt, 'Not set'),
    detail: `${actor} / ${reason}${note}`,
  };
}

export function humanizeClosureReason(reason: string) {
  return reason
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}
