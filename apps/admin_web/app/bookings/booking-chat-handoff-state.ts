import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingChatQuietNeedsOps as bookingChatQuietNeedsOpsFromFacts,
  bookingChatRepairNeedsOps as bookingChatRepairNeedsOpsFromFacts,
} from '../../lib/booking-chat-repair-action-state';
import { bookingChatMessageCount } from './booking-chat-message-count';

const handoffBookingStatuses = new Set(['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE']);

export function isHandoffBookingStatus(status: string): boolean {
  return handoffBookingStatuses.has(status);
}

export function bookingMatchingChatReady(booking: AdminBooking): boolean {
  return booking.matchingEvidence?.chatReady ?? Boolean(booking.chatRoom);
}

export function bookingChatRepairNeedsOps(booking: AdminBooking): boolean {
  return bookingChatRepairNeedsOpsFromFacts({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
  });
}

export function bookingChatQuietNeedsOps(booking: AdminBooking): boolean {
  return bookingChatQuietNeedsOpsFromFacts({
    status: booking.status,
    hasChatRoom: bookingMatchingChatReady(booking),
    messageCount: bookingChatMessageCount(booking),
  });
}

export function bookingHasQuietHandoffChat(booking: AdminBooking): boolean {
  return Boolean(
    booking.chatRoom &&
      bookingChatMessageCount(booking) === 0 &&
      isHandoffBookingStatus(booking.status),
  );
}
