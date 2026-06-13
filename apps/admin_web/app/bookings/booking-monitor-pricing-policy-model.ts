import type { AdminBooking } from '../../lib/admin-api';
import { bookingPricingPolicySignalFromFacts } from '../../lib/booking-pricing-policy-signal';
import { bookingPricingPolicySignalInput } from './booking-pricing-policy-inputs';

export function buildBookingMonitorPricingPolicySignal(booking: AdminBooking) {
  return bookingPricingPolicySignalFromFacts(bookingPricingPolicySignalInput(booking));
}

export function bookingMonitorPricingPolicyNeedsOps(booking: AdminBooking) {
  return buildBookingMonitorPricingPolicySignal(booking).status !== 'ready';
}
