import type { AdminBookingDetail } from '../../../lib/admin-api';

export type BookingChatEvidenceInput = Pick<AdminBookingDetail, 'chatRoom' | 'matchingEvidence'>;

export function bookingChatReady(booking: BookingChatEvidenceInput): boolean {
  return booking.matchingEvidence?.chatReady ?? Boolean(booking.chatRoom);
}
