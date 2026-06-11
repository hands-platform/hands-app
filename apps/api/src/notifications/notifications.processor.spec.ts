import { toPushData } from './notifications.processor';

describe('notification push data', () => {
  it('keeps OS push data limited to routing identifiers', () => {
    expect(
      toPushData({
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
        providerProfileId: 'provider-1',
        reason: 'Internal operator note',
        addressText: 'Private customer address',
        nested: { unsafe: true },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      chatRoomId: 'chat-1',
      providerProfileId: 'provider-1',
    });
  });

  it('omits push data when no safe keys are present', () => {
    expect(toPushData({ reason: 'Internal operator note' })).toBeUndefined();
    expect(toPushData(null)).toBeUndefined();
  });

  it('keeps payout setup detail objects out of OS push data', () => {
    expect(
      toPushData({
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        missing: {
          taxProfileApproved: true,
          residentialAddress: true,
          agreements: ['PAYOUT'],
        },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      providerProfileId: 'provider-1',
    });
  });
});
