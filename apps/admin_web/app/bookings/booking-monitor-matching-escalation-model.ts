import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMatchingEscalationBoard } from '../../lib/booking-matching-escalation-board';
import { buildBookingMatchingEscalationRows } from '../../lib/booking-matching-escalation-rows';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import {
  bookingCustomerSelectableCount,
  bookingMarketplaceCountFacts,
  bookingMarketplaceParticipantCount,
} from './booking-marketplace-count-facts';
import { bookingMatchingEscalationBoardInput } from './booking-matching-escalation-board-inputs';
import { bookingMatchingEscalationRowInputFromBooking } from './booking-matching-escalation-row-inputs';
import { bookingMatchingWindowExpired } from './booking-matching-window';
import {
  bookingMonitorSelectionLabelForBooking,
  bookingMonitorSelectionPathLabelForBooking,
} from './booking-monitor-selection-model';
import { bookingPreferredAwaitingDecision as bookingFirstPickPending } from './booking-preferred-provider-state';

export function buildBookingMonitorMatchingEscalationBoard(
  bookings: readonly AdminBooking[],
  nowMs: number,
) {
  return buildBookingMatchingEscalationBoard(
    buildBookingMonitorMatchingEscalationFacts(bookings, nowMs),
  );
}

export function buildBookingMonitorMatchingEscalationFacts(
  bookings: readonly AdminBooking[],
  nowMs: number,
) {
  return bookingMatchingEscalationBoardInput(
    bookings.map((booking) => ({
      booking,
      customerSelectableCount: bookingCustomerSelectableCount(booking),
      firstPickPending: bookingFirstPickPending(booking),
      hasChatRoom: bookingMatchingChatReady(booking),
      marketplaceParticipantCount: bookingMarketplaceParticipantCount(booking),
      responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
      status: booking.status,
    })),
  );
}

export function buildBookingMonitorMatchingEscalationRows(
  bookings: readonly AdminBooking[],
  nowMs: number,
) {
  return buildBookingMatchingEscalationRows(
    bookings.map((booking) => {
      const counts = bookingMarketplaceCountFacts(booking);
      return bookingMatchingEscalationRowInputFromBooking(booking, nowMs, {
        marketplaceCount: counts.marketplaceParticipantCount,
        preferredAwaitingDecision: bookingFirstPickPending(booking),
        selectableCount: counts.customerSelectableCount,
        selectionLabel: bookingMonitorSelectionLabelForBooking(booking),
        selectionPathLabel: bookingMonitorSelectionPathLabelForBooking(booking),
      });
    }),
  );
}
