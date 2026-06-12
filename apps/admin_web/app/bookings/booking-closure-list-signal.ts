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
    const actor = booking.closedByRole ? booking.closedByRole.toLowerCase() : 'actor missing';
    const reason = booking.closedReason ? humanizeClosureReason(booking.closedReason) : 'reason not saved';
    const note = booking.closedNote ? ` / ${booking.closedNote}` : '';

    return {
      label: `Closed ${options.formatDate(booking.closedAt)}`,
      detail: `${actor} closure / ${reason}${note}`,
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-info',
    };
  }

  if (terminalBookingStatuses.has(booking.status)) {
    return {
      label: 'Terminal',
      detail: 'Terminal booking has no explicit closure actor/reason saved yet.',
      tone: booking.status === 'NO_SHOW' ? 'pill-danger' : 'pill-warn',
    };
  }

  return null;
}
