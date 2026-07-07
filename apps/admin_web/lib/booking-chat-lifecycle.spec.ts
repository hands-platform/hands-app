import { bookingChatLifecycle, type BookingChatLifecycleInput } from './booking-chat-lifecycle';

describe('booking chat lifecycle helper', () => {
  it('keeps chat locked before the room exists', () => {
    const booking: BookingChatLifecycleInput = {
      status: 'MATCHED',
      chatRoom: null,
    };

    expect(bookingChatLifecycle(booking, 0)).toEqual({
      status: 'Not created',
      tone: 'pill-neutral',
      customerState: 'Locked',
      customerDetail: 'Customer chat appears after final Partner handoff.',
      partnerState: 'Locked',
      partnerDetail: 'Partner chat appears after match/service start.',
      adminState: 'Waiting',
      adminDetail: 'No transcript exists yet.',
      roomLabel: 'No room yet',
    });
  });

  it('shows chat live while the booking is active', () => {
    const booking: BookingChatLifecycleInput = {
      status: 'IN_SERVICE',
      chatRoom: { id: 'chatroom-1234567890' },
    };

    expect(bookingChatLifecycle(booking, 3)).toEqual({
      status: 'Live',
      tone: 'pill-info',
      customerState: 'Visible',
      customerDetail: 'Customer can coordinate with the assigned Partner.',
      partnerState: 'Visible',
      partnerDetail: 'Partner can message the customer during handoff and service.',
      adminState: 'Live archive',
      adminDetail: '3 message(s) visible now and retained after closeout.',
      roomLabel: 'chatroom',
    });
  });

  it('retains chat for admin after terminal closeout', () => {
    const booking: BookingChatLifecycleInput = {
      status: 'COMPLETED',
      chatRoom: { id: 'room-completed-9999' },
    };

    expect(bookingChatLifecycle(booking, 8)).toEqual({
      status: 'Retained for review',
      tone: 'pill-success',
      customerState: 'Hidden after closeout',
      customerDetail: 'Customer app can hide the active room when the service record is closed.',
      partnerState: 'Hidden after closeout',
      partnerDetail: 'Partner app can hide the active room after completion or closeout.',
      adminState: 'Archived',
      adminDetail: '8 message(s) kept for support, refund, and dispute review.',
      roomLabel: 'room-com',
    });
  });
});
