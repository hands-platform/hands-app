import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingFinalGateReason as buildBookingFinalGateReasonFromFacts,
  bookingFinalGateReasonPresentation,
} from '../../lib/booking-final-gate-reason';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import { bookingHasFinalPartner } from './booking-final-partner-state';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceParticipantCount,
} from './booking-marketplace-count-facts';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export function buildBookingMonitorFinalGateReason(booking: AdminBooking) {
  const reason = buildBookingFinalGateReasonFromFacts({
    cashDebt: bookingCashDebtNeedsOps(booking),
    walletLedgerLabel: 'Cash fee settlement required',
    hasAddressSnapshot: Boolean(booking.addressSnapshot),
    bookingStatus: booking.status,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    preferredAwaitingDecision: bookingFirstPickPending(booking),
    customerChoiceCandidates: bookingCustomerSelectableCount(booking),
    marketplaceParticipants: bookingMarketplaceParticipantCount(booking),
    selected: bookingHasFinalPartner(booking),
    hasChatRoom: bookingMatchingChatReady(booking),
  });

  return bookingFinalGateReasonPresentation({
    bookingId: booking.id,
    reason,
  });
}
