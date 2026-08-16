import { Role } from '@prisma/client';
import {
  backupBookingAvailableNotification,
  bookingOpenedNotification,
  customerBookingCancelledNotification,
  customerFirstPickRejectedNotification,
  customerMarketplaceProviderAcceptedNotification,
  customerProviderJoinedNotification,
  firstPickMatchedCustomerNotification,
  preferredProviderRequestedNotification,
  providerBookingCancelledNotification,
  providerPayoutSetupRequiredNotification,
  selectedPartnerMatchedProviderNotification,
  serviceStartedCustomerNotification,
  serviceStartedProviderNotification,
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
      targetRole: Role.CUSTOMER,
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
      }),
    ).toEqual({
      userId: 'provider-user-1',
      targetRole: Role.PROVIDER,
      type: 'booking.requested',
      title: 'New direct booking request',
      body: 'A customer requested one of your services.',
      data: { bookingId: 'booking-1' },
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
      customerBookingCancelledNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        releasedPayment: false,
        refundRequested: true,
      }),
    ).toMatchObject({
      body: 'Your request has been cancelled and the captured payment is queued for refund review.',
    });

    expect(
      customerFirstPickRejectedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
      }),
    ).toMatchObject({
      type: 'booking.rejected',
      body: 'This booking request has ended. You can review the result and make a new booking.',
    });

    expect(
      customerProviderJoinedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        provider: { id: 'provider-1', displayName: 'Mai' },
      }),
    ).toMatchObject({
      type: 'provider.joined',
      templateKey: 'provider.joined',
      body: 'Mai joined your booking.',
      data: { bookingId: 'booking-1', partnerName: 'Mai', providerProfileId: 'provider-1' },
    });

    expect(
      customerMarketplaceProviderAcceptedNotification({
        userId: 'customer-user-1',
        bookingId: 'booking-1',
        provider: { id: 'provider-1', displayName: 'Mai' },
      }),
    ).toMatchObject({
      type: 'provider.accepted',
      templateKey: 'provider.accepted',
      data: { bookingId: 'booking-1', partnerName: 'Mai', providerProfileId: 'provider-1' },
    });
  });

  it('builds matched and service lifecycle payloads', () => {
    expect(selectedPartnerMatchedProviderNotification('provider-user-1', 'booking-1')).toEqual({
      userId: 'provider-user-1',
      targetRole: Role.PROVIDER,
      templateKey: 'booking.matched.partner',
      type: 'booking.matched',
      title: 'You were selected',
      body: 'The customer selected you for this booking.',
      data: { bookingId: 'booking-1', destination: 'jobs' },
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

    expect(
      serviceStartedProviderNotification({
        userId: 'provider-user-1',
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
      }),
    ).toEqual({
      userId: 'provider-user-1',
      targetRole: Role.PROVIDER,
      templateKey: 'service.started.partner',
      type: 'service.started',
      title: 'Service started',
      body: 'Continue with the customer in the matched chat if needed.',
      data: {
        destination: 'chat',
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
      },
    });

    expect(
      serviceStartedProviderNotification({
        userId: 'provider-user-1',
        bookingId: 'booking-1',
      }),
    ).toMatchObject({
      body: 'Your active booking is ready in Jobs.',
      data: { bookingId: 'booking-1', destination: 'jobs' },
    });
  });

  it('builds marketplace backup and payout setup payloads', () => {
    expect(
      backupBookingAvailableNotification({
        userId: 'provider-user-1',
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        distanceMeters: 1234,
        backupProviderRadiusMeters: 10000,
        alertPolicy: { backupOpenMode: 'OPEN_MARKETPLACE' },
      }),
    ).toEqual({
      userId: 'provider-user-1',
      targetRole: Role.PROVIDER,
      type: 'booking.backup_available',
      title: 'Nearby booking available',
      body: 'A customer request within 10km is open for marketplace participation.',
      data: {
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        distanceMeters: 1234,
        backupOpenMode: 'OPEN_MARKETPLACE',
      },
    });

    expect(
      providerPayoutSetupRequiredNotification({
        userId: 'provider-user-1',
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        missing: { residentialAddress: true },
      }),
    ).toEqual({
      userId: 'provider-user-1',
      targetRole: Role.PROVIDER,
      type: 'provider.payout_setup_required',
      title: 'Payout setup required',
      body: 'Your first HANDS earning is recorded. Add address and payout agreements before requesting payout.',
      data: {
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        missing: { residentialAddress: true },
      },
    });
  });
});
