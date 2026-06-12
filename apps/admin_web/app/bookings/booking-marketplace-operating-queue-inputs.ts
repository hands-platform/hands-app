import type { AdminBooking } from '../../lib/admin-api';
import type { MarketplaceOperatingQueueBookingFact } from '../../lib/marketplace-operating-queue';
import { bookingChatRepairNeedsOps } from './booking-chat-handoff-state';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';

export type BookingMarketplaceOperatingQueueFacts = {
  readonly hasCustomerSelectablePartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly preferredAwaitingDecision: boolean;
  readonly responseWindowExpired: boolean;
};

export function bookingMarketplaceOperatingQueueFact(
  booking: AdminBooking,
  facts: BookingMarketplaceOperatingQueueFacts,
): MarketplaceOperatingQueueBookingFact<AdminBooking> {
  return {
    booking,
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    chatRepairNeedsOps: bookingChatRepairNeedsOps(booking),
    hasCustomerSelectablePartner: facts.hasCustomerSelectablePartner,
    hasPreferredPartner: Boolean(booking.preferredProvider),
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    preferredAwaitingDecision: facts.preferredAwaitingDecision,
    responseWindowExpired: facts.responseWindowExpired,
    status: booking.status,
  };
}
