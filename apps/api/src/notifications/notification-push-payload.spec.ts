import {
  isPartnerAlert,
  maskPushTokenInJson,
  notificationPushData,
  notificationDeliveryResponse,
  toJson,
  toPushData,
} from './notification-push-payload';

describe('notification push payload helpers', () => {
  it('keeps OS push data limited to routing identifiers', () => {
    expect(
      toPushData({
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
        payoutBatchId: 'payout-batch-1',
        providerProfileId: 'provider-1',
        reason: 'Internal operator note',
        addressText: 'Private customer address',
        nested: { unsafe: true },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      chatRoomId: 'chat-1',
      payoutBatchId: 'payout-batch-1',
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

  it('adds the stored notification id to safe OS push data', () => {
    expect(
      notificationPushData({
        id: 'notification-1',
        data: {
          bookingId: 'booking-1',
          notificationId: 'stale-client-value',
          reason: 'Internal operator note',
        },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      notificationId: 'notification-1',
    });
  });

  it('classifies partner alert notification types', () => {
    expect(isPartnerAlert('provider.payout_setup_required')).toBe(true);
    expect(isPartnerAlert('provider.payout_batch.updated')).toBe(true);
    expect(isPartnerAlert('payment.updated')).toBe(false);
  });

  it('masks push tokens before delivery responses are stored', () => {
    expect(maskPushTokenInJson({ reason: 'token fcm-token-1 leaked' }, 'fcm-token-1')).toEqual({
      reason: 'token [masked] leaked',
    });
    expect(
      notificationDeliveryResponse(
        {
          provider: 'FCM',
          status: 'FAILED',
          disableDevice: true,
          failureCode: 'messaging/registration-token-not-registered',
          response: { reason: 'registration token fcm-token-1 leaked' },
        },
        'fcm-token-1',
      ),
    ).toEqual({
      reason: 'registration token [masked] leaked',
      failureCode: 'messaging/registration-token-not-registered',
    });
  });

  it('serializes delivery payloads for Prisma JSON input', () => {
    expect(toJson({ sentAt: new Date('2026-06-11T00:00:00.000Z') })).toEqual({
      sentAt: '2026-06-11T00:00:00.000Z',
    });
  });
});
