import type { AdminBooking } from '../../lib/admin-api';
import { humanizeClosureReason } from '../../lib/booking-closure-summary';

export const terminalBookingStatuses = new Set(['COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW']);

export type BookingClosureListSignal = {
  readonly detail: string;
  readonly label: string;
  readonly tone: 'pill-danger' | 'pill-info' | 'pill-warn';
};

type BookingClosureListSignalBooking = Pick<
  AdminBooking,
  'closedAt' | 'closedByRole' | 'closedNote' | 'closedReason' | 'status'
>;

export function bookingClosureListSignal(
  booking: BookingClosureListSignalBooking,
  options: { readonly formatDate: (value: string) => string },
): BookingClosureListSignal | null {
  if (booking.closedAt) {
    const actor = bookingClosureActorLabel(booking.closedByRole);
    const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'Closure reason missing';
    const note = booking.closedNote ? ` · ${booking.closedNote}` : '';

    return {
      label: actor,
      detail: `${reason}${note} · ${options.formatDate(booking.closedAt)}`,
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-info',
    };
  }

  if (terminalBookingStatuses.has(booking.status)) {
    return {
      label: 'Closure metadata missing',
      detail: 'Closure actor and reason are not recorded.',
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-warn',
    };
  }

  return null;
}

function bookingClosureActorLabel(role?: string | null) {
  switch (role?.trim().toLowerCase()) {
    case 'provider':
    case 'partner':
      return 'Closed by Partner';
    case 'customer':
      return 'Closed by Customer';
    case 'admin':
    case 'operator':
      return 'Closed by Admin';
    case 'system':
      return 'Closed by System';
    default:
      return 'Closure actor missing';
  }
}
