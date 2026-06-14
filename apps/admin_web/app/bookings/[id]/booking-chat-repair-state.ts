import type { AdminBookingDetail } from '../../../lib/admin-api';
import {
  bookingChatRepairActionState as buildBookingChatRepairActionState,
  bookingChatRepairNeedsOps as buildBookingChatRepairNeedsOps,
} from '../../../lib/booking-chat-repair-action-state';
import { bookingChatReady } from './booking-chat-evidence';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { shortId } from './booking-formatters';

export function bookingChatRepairNeedsOps(booking: AdminBookingDetail) {
  return buildBookingChatRepairNeedsOps({
    status: booking.status,
    hasChatRoom: bookingChatReady(booking),
  });
}

export function bookingChatRepairActionState(booking: AdminBookingDetail) {
  return buildBookingChatRepairActionState({
    status: booking.status,
    hasChatRoom: bookingChatReady(booking),
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    hasSelectedPartner: bookingFinalPartnerSummary(booking).selected,
  });
}
