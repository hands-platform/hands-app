import type { AdminBooking } from '../../lib/admin-api';
import { bookingCustomerProtectionBoardFromFacts } from './booking-customer-protection-board';
import { bookingCustomerProtectionFactsFromBookings } from './booking-payment-closeout-facts';

export function buildBookingMonitorCustomerProtectionBoard(bookings: readonly AdminBooking[]) {
  return bookingCustomerProtectionBoardFromFacts(bookingCustomerProtectionFactsFromBookings(bookings));
}
