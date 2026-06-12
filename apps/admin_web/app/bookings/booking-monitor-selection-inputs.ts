import type { AdminBooking } from '../../lib/admin-api';
import { bookingFinalSelectionCopy } from '../../lib/booking-final-selection-copy';
import type { BookingMonitorSelectionFacts } from './booking-monitor-selection';

export type BookingMonitorSelectionInputFacts = {
  readonly firstPickPending: boolean;
  readonly isBackupSelected: boolean;
  readonly isSelectedProviderParticipant: boolean;
  readonly marketplaceCount: number;
  readonly preferredProviderState: string | null;
};

export function bookingMonitorSelectionFactsFromBooking(
  booking: AdminBooking,
  facts: BookingMonitorSelectionInputFacts,
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
