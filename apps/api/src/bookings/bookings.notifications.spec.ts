import {
  bookingOpenedNotification,
  customerBookingCancelledNotification,
  customerMarketplaceProviderAcceptedNotification,
  customerProviderJoinedNotification,
  firstPickMatchedCustomerNotification,
  preferredProviderRequestedNotification,
  providerBookingCancelledNotification,
  selectedPartnerMatchedProviderNotification,
  serviceStartedCustomerNotification,
} from './bookings.notifications';

describe('booking notification payloads', () => {
  it('builds customer booking opened payloads for direct and marketplace bookings', () => {
    expect(
      bookingOpenedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        preferredProvider: { id: 'provider-1', displayName: 'Mai' },
        couponCode: 'SAVE',
        discountAmount: 30000,
      }),
    ).toEqual({
      userId: 'customer-user-1',
      type: 'booking.opened',
      title: 'Booking request sent',
      body: 'Mai received your booking request.',
      data: {
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        couponCode: 'SAVE',
        discountAmount: 30000,
      },
    });

    expect(
      bookingOpenedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        discountAmount: 0,
      }),
    ).toMatchObject({
      title: 'Booking opened',
      body: 'We are looking for nearby partners.',
    });
  });

  it('builds provider request and cancellation payloads', () => {
    expect(
      preferredProviderRequestedNotification({
        userId: 'provider-user-1',
        bookingId: 'booking-1',
        customerProfileId: 'customer-1',
      }),
    ).toEqual({
      userId: 'provider-user-1',
      type: 'booking.requested',
      title: 'New direct booking request',
      body: 'A customer requested one of your services.',
      data: { bookingId: 'booking-1', customerProfileId: 'customer-1' },
    });

    expect(providerBookingCancelledNotification('provider-user-1', 'booking-1')).toMatchObject({
      type: 'booking.cancelled',
      data: { bookingId: 'booking-1' },
    });
  });

  it('builds customer cancellation and partner activity payloads', () => {
    expect(
      customerBookingCancelledNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        releasedPayment: true,
      }),
    ).toMatchObject({
      body: 'Your request has been cancelled and the payment hold was released.',
    });

    expect(
      customerProviderJoinedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        provider: { id: 'provider-1', displayName: 'Mai' },
      }),
    ).toMatchObject({
      type: 'provider.joined',
      body: 'Mai joined your booking.',
      data: { bookingId: 'booking-1', providerProfileId: 'provider-1' },
    });

    expect(
      customerMarketplaceProviderAcceptedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        provider: { id: 'provider-1', displayName: 'Mai' },
      }),
    ).toMatchObject({
      type: 'provider.accepted',
      data: { bookingId: 'booking-1', providerProfileId: 'provider-1' },
    });
  });

  it('builds matched and service lifecycle payloads', () => {
    expect(selectedPartnerMatchedProviderNotification('provider-user-1', 'booking-1')).toEqual({
      userId: 'provider-user-1',
      type: 'booking.matched',
      title: 'You were selected',
      body: 'The customer selected you for this booking.',
      data: { bookingId: 'booking-1' },
    });

    expect(
      firstPickMatchedCustomerNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
        provider: { id: 'provider-1', displayName: 'Mai' },
      }),
    ).toMatchObject({
      type: 'booking.matched',
      body: 'Mai accepted your request. Your chat room is ready.',
      data: { bookingId: 'booking-1', chatRoomId: 'chat-1', providerProfileId: 'provider-1' },
    });

    expect(
      serviceStartedCustomerNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
      }),
    ).toMatchObject({
      type: 'service.started',
      data: { bookingId: 'booking-1', chatRoomId: 'chat-1' },
    });
  });
});
