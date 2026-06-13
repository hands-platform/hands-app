import type { AdminBooking } from '../../lib/admin-api';
import { bookingAddressSnapshotStateFromFacts } from '../../lib/booking-address-snapshot-state';
import { bookingChatListStateFromFacts } from '../../lib/booking-chat-list-state';
import { bookingAddressSnapshotStateInput } from './booking-address-snapshot-state-inputs';
import { bookingMatchingChatReady } from './booking-chat-handoff-state';
import {
  bookingLocationPillLabel,
  bookingLocationSignalLabel,
  bookingLocationToneClass,
} from './booking-location-display';
import type { BookingMonitorListRow } from './booking-monitor-list-section';

export function buildBookingMonitorAddressState(booking: AdminBooking) {
  return bookingAddressSnapshotStateFromFacts(bookingAddressSnapshotStateInput(booking));
}

export function buildBookingMonitorChatState(booking: AdminBooking) {
  return bookingChatListStateFromFacts({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: booking.chatRoom?.messages?.length ?? 0,
  });
}

export function buildBookingMonitorListLocation(
  booking: AdminBooking,
  nowMs: number,
): BookingMonitorListRow['location'] {
  return {
    pillLabel: bookingLocationPillLabel(booking, nowMs),
    signalLabel: bookingLocationSignalLabel(booking, nowMs),
    toneClass: bookingLocationToneClass(booking, nowMs),
  };
}
