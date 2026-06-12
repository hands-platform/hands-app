import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingChatQuietNeedsOps,
  bookingChatRepairNeedsOps,
  bookingHasQuietHandoffChat,
  bookingMatchingChatReady,
  isHandoffBookingStatus,
} from './booking-chat-handoff-state';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('booking chat handoff state', () => {
  it('reads matching chat readiness from evidence before chat room presence', () => {
    expect(bookingMatchingChatReady(booking({ matchingEvidence: { chatReady: true } as never }))).toBe(
      true,
    );
    expect(bookingMatchingChatReady(booking({ chatRoom: { id: 'chat' } as never }))).toBe(true);
    expect(bookingMatchingChatReady(booking({}))).toBe(false);
  });

  it('detects chat repair and quiet handoff states', () => {
    const matchedWithoutChat = booking({ status: 'MATCHED' });
    const matchedWithEmptyChat = booking({
      chatRoom: { messages: [] } as never,
      status: 'MATCHED',
    });
    const createdWithEmptyChat = booking({
      chatRoom: { messages: [] } as never,
      status: 'CREATED',
    });

    expect(bookingChatRepairNeedsOps(matchedWithoutChat)).toBe(true);
    expect(bookingChatRepairNeedsOps(matchedWithEmptyChat)).toBe(false);
    expect(bookingChatQuietNeedsOps(matchedWithEmptyChat)).toBe(true);
    expect(bookingHasQuietHandoffChat(matchedWithEmptyChat)).toBe(true);
    expect(bookingHasQuietHandoffChat(createdWithEmptyChat)).toBe(false);
    expect(isHandoffBookingStatus('IN_SERVICE')).toBe(true);
    expect(isHandoffBookingStatus('COMPLETED')).toBe(false);
  });
});
