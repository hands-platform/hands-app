import type { AdminBooking } from '../../lib/admin-api';

export function bookingChatMessageCount(booking: Pick<AdminBooking, 'chatRoom'>) {
  return booking.chatRoom?._count?.messages ?? booking.chatRoom?.messages?.length ?? 0;
}
