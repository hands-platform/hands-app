import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorCheckFlagsFromFacts } from '../../lib/booking-monitor-check-flags';
import { bookingMatchingWindowExpired } from './booking-matching-window';
import { bookingMarketplaceParticipantCount } from './booking-marketplace-count-facts';
import { bookingMonitorCheckFlagsInputFromBooking } from './booking-monitor-check-flags-inputs';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';
import { bookingPreferredAwaitingDecision } from './booking-preferred-provider-state';
import { buildBookingMonitorPricingPolicySignal } from './booking-monitor-pricing-policy-model';

export function bookingMonitorCheckFlags(booking: AdminBooking, nowMs: number) {
  return bookingMonitorCheckFlagsFromFacts(
    bookingMonitorCheckFlagsInputFromBooking(booking, nowMs, {
      completedCloseoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
      pricingPolicy: buildBookingMonitorPricingPolicySignal(booking),
      responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      firstPickPending: bookingPreferredAwaitingDecision(booking),
      marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
    }),
  );
}
