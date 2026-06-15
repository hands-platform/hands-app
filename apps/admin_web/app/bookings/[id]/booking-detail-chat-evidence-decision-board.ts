import type {
  AdminBookingDetail,
  AdminChatMessage,
  AdminLocationSnapshot,
} from '../../../lib/admin-api';
import { bookingChatEvidenceDecisionBoard } from '../../../lib/booking-chat-evidence-decision-board';
import { messageSenderLabel } from './booking-communication-movement-handoff';
import {
  compactActivityText,
  coordinateLabel,
  formatDate,
  shortId,
} from './booking-formatters';

export type BookingDetailChatEvidenceDecisionBoardInput = {
  booking: AdminBookingDetail;
  latestLocation: AdminLocationSnapshot | null;
  messages: readonly AdminChatMessage[];
  notificationCount: number;
  operatorNoteLines: readonly string[];
};

export function bookingDetailChatEvidenceDecisionBoard({
  booking,
  latestLocation,
  messages,
  notificationCount,
  operatorNoteLines,
}: BookingDetailChatEvidenceDecisionBoardInput) {
  const latestMessage = messages[messages.length - 1];

  return bookingChatEvidenceDecisionBoard({
    bookingId: booking.id,
    bookingStatus: booking.status,
    hasChatRoom: Boolean(booking.chatRoom),
    chatRoomShortId: booking.chatRoom ? shortId(booking.chatRoom.id) : null,
    messageCount: messages.length,
    latestMessageAtLabel: latestMessage ? formatDate(latestMessage.createdAt) : null,
    latestMessagePreview: latestMessage
      ? `${messageSenderLabel(latestMessage)}: ${compactActivityText(latestMessage.body, 90)}`
      : null,
    hasLatestLocation: Boolean(latestLocation),
    latestLocationAtLabel: latestLocation ? formatDate(latestLocation.recordedAt) : null,
    latestLocationCoordinateLabel: latestLocation
      ? coordinateLabel(latestLocation.lat, latestLocation.lng)
      : null,
    alertCount: notificationCount,
    auditLogCount: booking.auditLogs?.length ?? 0,
    operatorNoteLines: [...operatorNoteLines],
  });
}
