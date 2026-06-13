import type { AdminBooking } from '../../lib/admin-api';
import { bookingCommandDecisionStrip } from '../../lib/booking-command-decision-strip';
import { bookingCommandDecisionStripInput } from './booking-command-decision-strip-inputs';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingHasFinalPartner } from './booking-final-partner-state';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceParticipantCount,
} from './booking-marketplace-count-facts';
import { buildBookingMonitorAddressState } from './booking-monitor-list-state-model';
import {
  bookingCashDebtNeedsOps,
  bookingCompletedCloseoutNeedsOps,
} from './booking-payment-closeout-facts';

export function buildBookingMonitorCommandDecisionStrip(booking: AdminBooking) {
  const addressState = buildBookingMonitorAddressState(booking);
  const marketplaceCount = bookingMarketplaceParticipantCount(booking);

  return bookingCommandDecisionStrip(
    bookingCommandDecisionStripInput(booking, {
      addressLabel: addressState.detail,
      cashDebtNeedsSettlement: bookingCashDebtNeedsOps(booking),
      closeoutNeedsOps: bookingCompletedCloseoutNeedsOps(booking),
      customerChoiceCandidateCount: bookingCustomerSelectableCount(booking),
      marketplaceEligibleCount: marketplaceCount,
      hasFinalPartner: bookingHasFinalPartner(booking),
      hasChatRoom: bookingMatchingChatReady(booking),
    }),
  );
}
