import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingListStageFromFacts,
  type BookingListStage,
  type BookingListStageInput,
} from '../../lib/booking-list-stage';
import { bookingBackupAlertTraceSummary } from './booking-alert-trace';
import {
  bookingMatchingChatReady,
  isHandoffBookingStatus,
} from './booking-chat-handoff-state';
import { terminalBookingStatuses } from './booking-closure-list-signal';
import { bookingHasFinalPartner } from './booking-final-partner-state';
import { bookingLocationNeedsOpsFromFacts } from '../../lib/booking-status-location-helpers';
import { bookingLocationNeedsOpsInput } from './booking-location-ops-inputs';
import { bookingMatchingWindowExpired } from './booking-matching-window';

export type BookingListStageBookingFacts = {
  readonly marketplaceCount: number;
  readonly selectableCount: number;
};

export function bookingListStageInput(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingListStageBookingFacts,
): BookingListStageInput {
  const locationNeedsOps = bookingLocationNeedsOpsFromFacts(bookingLocationNeedsOpsInput(booking, nowMs));
  const marketplaceAlertNotifiedCount = bookingBackupAlertTraceSummary(booking).totalNotified;

  return {
    bookingId: booking.id,
    hasChatRoom: bookingMatchingChatReady(booking),
    isHandoffStatus: isHandoffBookingStatus(booking.status),
    isTerminalStatus: terminalBookingStatuses.has(booking.status),
    locationNeedsOps,
    matchingEvidence: booking.matchingEvidence,
    marketplaceAlertNotifiedCount,
    marketplaceCount: facts.marketplaceCount,
    responseWindowExpired: bookingMatchingWindowExpired(booking, nowMs),
    selectableCount: facts.selectableCount,
    selectedPartnerPresent: bookingHasFinalPartner(booking),
    status: booking.status,
  };
}

export function bookingListStage(
  booking: AdminBooking,
  nowMs: number,
  facts: BookingListStageBookingFacts,
): BookingListStage {
  return bookingListStageFromFacts(bookingListStageInput(booking, nowMs, facts));
}
