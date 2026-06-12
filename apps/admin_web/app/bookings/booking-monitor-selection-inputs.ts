import type { AdminBooking } from '../../lib/admin-api';
import { bookingFinalSelectionCopy } from '../../lib/booking-final-selection-copy';
import type { BookingMonitorSelectionFacts } from './booking-monitor-selection';
import { bookingMarketplaceParticipantCount } from './booking-marketplace-count-facts';
import {
  bookingIsBackupSelected,
  bookingIsSelectedProviderParticipant,
  bookingPreferredAwaitingDecision,
  bookingPreferredProviderStateLabel,
} from './booking-preferred-provider-state';

export type BookingMonitorSelectionInputFacts = {
  readonly firstPickPending: boolean;
  readonly isBackupSelected: boolean;
  readonly isSelectedProviderParticipant: boolean;
  readonly marketplaceCount: number;
  readonly preferredProviderState: string | null;
};

export function bookingMonitorSelectionFactsFromBooking(
  booking: AdminBooking,
  facts: BookingMonitorSelectionInputFacts = bookingMonitorSelectionInputFactsFromBooking(booking),
): BookingMonitorSelectionFacts {
  const hasPreferredProvider = Boolean(booking.preferredProvider);

  return {
    finalSelectionCopy: bookingFinalSelectionCopy(booking.matchingEvidence?.finalSelection),
    firstPickPending: hasPreferredProvider && booking.status === 'OPEN_MATCHING' && facts.firstPickPending,
    hasPreferredProvider,
    isBackupSelected: hasPreferredProvider && facts.isBackupSelected,
    isMatched: booking.status === 'MATCHED',
    isSelectedProviderParticipant: hasPreferredProvider && facts.isSelectedProviderParticipant,
    marketplaceCount: facts.marketplaceCount,
    preferredProviderState: hasPreferredProvider ? facts.preferredProviderState : null,
  };
}

export function bookingMonitorSelectionInputFactsFromBooking(
  booking: AdminBooking,
): BookingMonitorSelectionInputFacts {
  const hasPreferredProvider = Boolean(booking.preferredProvider);

  return {
    firstPickPending: bookingPreferredAwaitingDecision(booking),
    isBackupSelected: bookingIsBackupSelected(booking),
    isSelectedProviderParticipant: bookingIsSelectedProviderParticipant(booking),
    marketplaceCount: bookingMarketplaceParticipantCount(booking),
    preferredProviderState: hasPreferredProvider ? bookingPreferredProviderStateLabel(booking) : null,
  };
}
