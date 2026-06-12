import type { AdminBooking } from '../../lib/admin-api';
import type { MarketplaceBookingCoverageRowInput } from '../../lib/marketplace-booking-coverage';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import { bookingChatRepairNeedsOps } from './booking-chat-handoff-state';
import {
  bookingFinalPartnerLabel,
  bookingHasFinalPartner,
} from './booking-final-partner-state';
import { bookingCreatedTimestamp } from './booking-list-time';
import {
  firstPickCoverageStateFromFacts,
  marketplaceBookingNextActionFromFacts,
} from './booking-marketplace-coverage-state';
import { bookingMarketplaceWalletSignal } from './booking-marketplace-wallet-signal';
import { bookingMatchingWindowExpired } from './booking-matching-window';
import { bookingCashDebtNeedsOps } from './booking-payment-closeout-facts';
import {
  bookingIsBackupSelected,
  bookingPreferredAwaitingDecision,
  bookingPreferredProviderStateLabel,
} from './booking-preferred-provider-state';

export type BookingMarketplaceCoverageInputFacts = {
  readonly backupSelected: boolean;
  readonly firstPickPending: boolean;
  readonly hasFinalPartner: boolean;
  readonly marketplaceParticipantCount: number;
  readonly matchingWindowExpired: boolean;
  readonly preferredProviderState: string | null;
  readonly selectableCount: number;
  readonly selectedPartnerLabel: string | null;
};

export type BookingMarketplaceCoverageBookingFacts = {
  readonly marketplaceParticipantCount: number;
  readonly selectableCount: number;
};

export function bookingMarketplaceCoverageInput(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMarketplaceCoverageInputFacts,
): MarketplaceBookingCoverageRowInput<AdminBooking> {
  const trace = bookingBackupAlertTraceSummary(booking, nowMs);
  const wallet = bookingMarketplaceWalletSignal(booking);
  const chatRepairNeeded = bookingChatRepairNeedsOps(booking);
  const hasPreferredProvider = Boolean(booking.preferredProvider);
  const firstPick = firstPickCoverageStateFromFacts({
    backupSelected: facts.backupSelected,
    firstPickPending: facts.firstPickPending,
    hasPreferredProvider,
    matchingWindowExpired: facts.matchingWindowExpired,
    preferredProviderState: facts.preferredProviderState,
    status: booking.status,
  });
  const nextAction = marketplaceBookingNextActionFromFacts({
    cashDebtNeedsOps: bookingCashDebtNeedsOps(booking),
    chatRepairNeedsOps: chatRepairNeeded,
    customerSelectableCount: facts.selectableCount,
    firstPickPending: facts.firstPickPending,
    hasFinalPartner: facts.hasFinalPartner,
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    matchingWindowExpired: facts.matchingWindowExpired,
    status: booking.status,
  });

  return {
    booking,
    chatRepairNeeded,
    firstPickLabel: firstPick.label,
    firstPickTone: firstPick.tone,
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    nextActionLabel: nextAction.label,
    nextActionTone: nextAction.tone,
    participantCount: booking.participants?.length ?? 0,
    selectableCount: facts.selectableCount,
    selectedPartnerLabel: facts.selectedPartnerLabel,
    sortTimestamp: bookingCreatedTimestamp(booking),
    status: booking.status,
    traceBatchCount: trace.batchCount,
    traceLastAge: trace.lastAge,
    traceLastStage: trace.lastStage,
    traceTotalNotified: trace.totalNotified,
    walletLabel: wallet.walletLabel,
    walletTone: wallet.walletTone,
  };
}

export function bookingMarketplaceCoverageInputFromBooking(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingMarketplaceCoverageBookingFacts,
): MarketplaceBookingCoverageRowInput<AdminBooking> {
  const hasPreferredProvider = Boolean(booking.preferredProvider);

  return bookingMarketplaceCoverageInput(booking, nowMs, {
    backupSelected: hasPreferredProvider && bookingIsBackupSelected(booking),
    firstPickPending: hasPreferredProvider && bookingPreferredAwaitingDecision(booking),
    hasFinalPartner: bookingHasFinalPartner(booking),
    marketplaceParticipantCount: facts.marketplaceParticipantCount,
    matchingWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
    preferredProviderState: hasPreferredProvider ? bookingPreferredProviderStateLabel(booking) : null,
    selectableCount: facts.selectableCount,
    selectedPartnerLabel: bookingFinalPartnerLabel(booking),
  });
}
