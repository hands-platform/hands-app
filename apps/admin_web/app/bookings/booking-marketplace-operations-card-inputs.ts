import type { AdminBooking } from '../../lib/admin-api';
import type { MarketplaceOperationsBookingFact } from '../../lib/marketplace-operations-cards';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingHasFinalPartner } from './booking-final-partner-state';
import { bookingHasPartnerWalletDebtSignal } from './booking-marketplace-wallet-signal';

export type BookingMarketplaceOperationsCardFacts = {
  readonly hasCustomerSelectablePartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly selectedPartnerPresent: boolean;
};

export type BookingMarketplaceOperationsCardBookingFacts = {
  readonly customerSelectableCount: number;
  readonly marketplaceParticipantCount: number;
};

export function bookingMarketplaceOperationsBookingFact(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMarketplaceOperationsCardFacts,
): MarketplaceOperationsBookingFact {
  return {
    alertTraceBatchCount: bookingBackupAlertTraceSummary(booking, nowMs).batchCount,
    hasCustomerSelectablePartner: facts.hasCustomerSelectablePartner,
    hasWalletDebt: bookingHasPartnerWalletDebtSignal(booking),
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    selectedPartnerPresent: facts.selectedPartnerPresent,
    status: booking.status,
  };
}

export function bookingMarketplaceOperationsBookingFactFromBooking(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMarketplaceOperationsCardBookingFacts,
): MarketplaceOperationsBookingFact {
  return bookingMarketplaceOperationsBookingFact(booking, nowMs, {
    hasCustomerSelectablePartner: facts.customerSelectableCount > 0,
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    selectedPartnerPresent: bookingHasFinalPartner(booking),
  });
}
