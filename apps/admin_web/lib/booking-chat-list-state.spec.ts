import {
  bookingChatListStateFromFacts,
  type BookingChatListStateInput,
} from './booking-chat-list-state';

const baseInput: BookingChatListStateInput = {
  hasChatRoom: false,
  messageCount: 0,
  status: 'OPEN_MATCHING',
};

describe('bookingChatListStateFromFacts', () => {
  it('returns ready state when a chat room exists', () => {
    expect(
      bookingChatListStateFromFacts({
        ...baseInput,
        hasChatRoom: true,
        messageCount: 3,
      }),
    ).toEqual({
      label: 'Chat ready',
      detail: '3 message(s) retained for admin review.',
      tone: 'pill-success',
    });
  });

  it.each(['MATCHED', 'PROVIDER_ON_THE_WAY', 'IN_SERVICE'])(
    'returns missing state for %s when chat is not linked',
    (status) => {
      expect(bookingChatListStateFromFacts({ ...baseInput, status })).toEqual({
        label: 'Chat missing',
        detail: 'Customer and Partner are matched, but no chat room is linked yet.',
        tone: 'pill-danger',
      });
    },
  );

  it('returns archived state for completed bookings without a chat room', () => {
    expect(bookingChatListStateFromFacts({ ...baseInput, status: 'COMPLETED' })).toEqual({
      label: 'Chat record ready',
      detail: 'Service is completed. Admin should keep any linked chat record available.',
      tone: 'pill-info',
    });
  });

  it('returns pending state before final Partner chat handoff', () => {
    expect(bookingChatListStateFromFacts(baseInput)).toEqual({
      label: 'Chat pending',
      detail: 'Chat opens after the customer locks a final Partner.',
      tone: 'pill-neutral',
    });
  });
});
