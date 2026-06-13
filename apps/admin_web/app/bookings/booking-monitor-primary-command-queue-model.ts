import type { AdminBooking } from '../../lib/admin-api';
import { bookingPrimaryCommandHref } from '../../lib/booking-primary-command-href';
import { bookingPrimaryCommandSummary } from '../../lib/booking-primary-command-summary';
import { buildBookingMonitorCommandDecisionStrip } from './booking-monitor-command-decision-model';

export function buildBookingMonitorPrimaryCommandQueue(bookings: readonly AdminBooking[]) {
  return bookingPrimaryCommandSummary(
    bookings.map((booking) => {
      const strip = buildBookingMonitorCommandDecisionStrip(booking);

      return {
        bookingId: booking.id,
        href: bookingPrimaryCommandHref(strip.status),
        strip,
      };
    }),
  );
}
