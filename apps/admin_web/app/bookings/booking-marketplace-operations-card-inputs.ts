import type { AdminBooking } from '../../lib/admin-api';
import type { MarketplaceOperationsBookingFact } from '../../lib/marketplace-operations-cards';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingHasPartnerWalletDebtSignal } from './booking-marketplace-wallet-signal';

export type BookingMarketplaceOperationsCardFacts = {
  readonly hasCustomerSelectablePartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly selectedPartnerPresent: boolean;
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
