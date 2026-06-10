import {
  bookingChatRepairActionState,
  bookingChatQuietNeedsOps,
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

  it('flags quiet chat only for active bookings with a retained empty room', () => {
    expect(
      bookingChatQuietNeedsOps({
        status: 'MATCHED',
        hasChatRoom: true,
        messageCount: 0,
      }),
    ).toBe(true);
    expect(
      bookingChatQuietNeedsOps({
        status: 'COMPLETED',
        hasChatRoom: true,
        messageCount: 0,
      }),
    ).toBe(false);
    expect(
      bookingChatQuietNeedsOps({
        status: 'MATCHED',
        hasChatRoom: true,
        messageCount: 1,
      }),
    ).toBe(false);
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
      helper: 'Repair is locked until first-pick match or customer final selection is recorded.',
    });
  });

  it('describes chat as unavailable before first-pick match or customer final selection', () => {
    expect(
      bookingChatRepairActionState({
        status: 'OPEN_MATCHING',
        hasChatRoom: false,
        chatRoomShortId: null,
        hasSelectedPartner: false,
      }),
    ).toMatchObject({
      canSubmit: false,
      status: 'Not required',
      tone: 'pill-neutral',
      helper: 'Chat opens after first-pick match or customer final selection.',
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
