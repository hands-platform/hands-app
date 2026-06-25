import type { AdminBooking } from '../../lib/admin-api';
import { bookingChatMessageCount } from './booking-chat-message-count';

describe('bookingChatMessageCount', () => {
  it('reads the lightweight chat room message count from booking list rows', () => {
    expect(
      bookingChatMessageCount({
        chatRoom: { id: 'chat_1', _count: { messages: 7 } },
      } as unknown as AdminBooking),
    ).toBe(7);
  });

  it('falls back to embedded messages for detail rows and legacy fixtures', () => {
    expect(
      bookingChatMessageCount({
        chatRoom: {
          id: 'chat_1',
          messages: [
            {
              id: 'message_1',
              body: 'hello',
              createdAt: '2026-06-13T03:29:00.000Z',
            },
            {
              id: 'message_2',
              body: 'hi',
              createdAt: '2026-06-13T03:30:00.000Z',
            },
          ],
        },
      } as unknown as AdminBooking),
    ).toBe(2);
  });

  it('returns zero when no chat room or retained messages are attached', () => {
    expect(bookingChatMessageCount({ chatRoom: null } as unknown as AdminBooking)).toBe(0);
  });
});
