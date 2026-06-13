import type { AdminBooking } from '../../lib/admin-api';
import { bookingMarketplaceCountFacts } from './booking-marketplace-count-facts';
import { bookingListStage as bookingListStageFromBooking } from './booking-list-stage-inputs';

export function buildBookingMonitorListStage(booking: AdminBooking, nowMs: number) {
  const counts = bookingMarketplaceCountFacts(booking);

  return bookingListStageFromBooking(booking, nowMs, {
    marketplaceCount: counts.marketplaceParticipantCount,
    selectableCount: counts.customerSelectableCount,
  });
}
