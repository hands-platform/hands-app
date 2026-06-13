import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingMatchingFlowTimeline,
  type BookingMatchingFlowStep,
} from '../../lib/booking-matching-flow-timeline';
import {
  bookingMatchingFlowTimelineBookingFact,
  bookingMatchingFlowTimelineInput,
} from './booking-matching-flow-timeline-inputs';
import { bookingMarketplaceCountFacts } from './booking-marketplace-count-facts';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export function buildBookingMonitorMatchingFlowTimeline(
  bookings: readonly AdminBooking[],
  nowMs: number,
): readonly BookingMatchingFlowStep<AdminBooking>[] {
  return buildBookingMatchingFlowTimeline(
    bookingMatchingFlowTimelineInput(
      bookings.map((booking) =>
        bookingMatchingFlowTimelineBookingFact(booking, nowMs, {
          ...bookingMarketplaceCountFacts(booking),
          firstPickPending: bookingFirstPickPending(booking),
        }),
      ),
    ),
  );
}
