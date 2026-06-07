import {
  bookingChatRepairActionState,
  bookingChatRepairNeedsOps,
} from './booking-chat-repair-action-state';

describe('booking chat repair action state', () => {
  it('requires operations repair for matched or active bookings without retained chat', () => {
    for (const status of ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED']) {
      expect(bookingChatRepairNeedsOps({ status, hasChatRoom: false })).toBe(true);
    }
  });

  it('does not require repair before matching or when chat exists', () => {
    expect(bookingChatRepairNeedsOps({ status: 'OPEN_MATCHING', hasChatRoom: false })).toBe(false);
    expect(bookingChatRepairNeedsOps({ status: 'MATCHED', hasChatRoom: true })).toBe(false);
  });

  it('returns ready state when the chat room exists', () => {
    expect(
      bookingChatRepairActionState({
        status: 'MATCHED',
        hasChatRoom: true,
        chatRoomShortId: 'abc123',
        hasSelectedPartner: true,
      }),
    ).toEqual({
      canSubmit: false,
      status: 'Chat ready',
      tone: 'pill-success',
      helper: 'Room abc123 is retained for admin evidence.',
    });
  });

  it('locks repair when final partner is missing', () => {
    expect(
      bookingChatRepairActionState({
        status: 'MATCHED',
        hasChatRoom: false,
        chatRoomShortId: null,
        hasSelectedPartner: false,
      }),
    ).toMatchObject({
      canSubmit: false,
      status: 'Final partner missing',
      tone: 'pill-warn',
    });
  });

  it('opens repair when final partner exists but retained chat is missing', () => {
    expect(
      bookingChatRepairActionState({
        status: 'MATCHED',
        hasChatRoom: false,
        chatRoomShortId: null,
        hasSelectedPartner: true,
      }),
    ).toMatchObject({
      canSubmit: true,
      status: 'Repair available',
      tone: 'pill-danger',
    });
  });
});
