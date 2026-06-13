import type { AdminBooking } from '../../lib/admin-api';
import { bookingNextActionCopy } from '../../lib/booking-next-action-copy';
import { bookingNextActionCopyInputFromBooking } from './booking-next-action-inputs';

export function bookingMonitorNextActionLabel(booking: AdminBooking) {
  return bookingNextActionCopy(bookingNextActionCopyInputFromBooking(booking));
}
