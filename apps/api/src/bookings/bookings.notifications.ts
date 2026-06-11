export type BookingNotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: unknown;
};

type DisplayProvider = {
  id: string;
  displayName: string;
};

export function bookingOpenedNotification(input: {
  userId: string;
  bookingId: string;
  preferredProvider?: DisplayProvider | null;
  couponCode?: string;
  discountAmount: number;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.opened',
    title: input.preferredProvider ? 'Booking request sent' : 'Booking opened',
    body: input.preferredProvider
      ? `${input.preferredProvider.displayName} received your booking request.`
      : 'We are looking for nearby partners.',
    data: {
      bookingId: input.bookingId,
      providerProfileId: input.preferredProvider?.id,
      couponCode: input.couponCode,
      discountAmount: input.discountAmount,
    },
  };
}

export function preferredProviderRequestedNotification(input: {
  userId: string;
  bookingId: string;
  customerProfileId: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.requested',
    title: 'New direct booking request',
    body: 'A customer requested one of your services.',
    data: { bookingId: input.bookingId, customerProfileId: input.customerProfileId },
  };
}

export function providerBookingCancelledNotification(userId: string, bookingId: string): BookingNotificationPayload {
  return {
    userId,
    type: 'booking.cancelled',
    title: 'Booking cancelled',
    body: 'The customer cancelled this booking request before partner commitment.',
    data: { bookingId },
  };
}

export function customerBookingCancelledNotification(input: {
  userId: string;
  bookingId: string;
  releasedPayment: boolean;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.cancelled',
    title: 'Booking cancelled',
    body: input.releasedPayment
      ? 'Your request has been cancelled and the payment hold was released.'
      : 'Your request has been cancelled.',
    data: { bookingId: input.bookingId },
  };
}

export function customerProviderJoinedNotification(input: {
  userId: string;
  bookingId: string;
  provider: DisplayProvider;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'provider.joined',
    title: 'A partner joined',
    body: `${input.provider.displayName} joined your booking.`,
    data: { bookingId: input.bookingId, providerProfileId: input.provider.id },
  };
}

export function selectedPartnerMatchedProviderNotification(
  userId: string,
  bookingId: string,
): BookingNotificationPayload {
  return {
    userId,
    type: 'booking.matched',
    title: 'You were selected',
    body: 'The customer selected you for this booking.',
    data: { bookingId },
  };
}

export function selectedPartnerMatchedCustomerNotification(input: {
  userId: string;
  bookingId: string;
  chatRoomId?: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.matched',
    title: 'Partner selected',
    body: 'Your chat room is ready.',
    data: { bookingId: input.bookingId, chatRoomId: input.chatRoomId },
  };
}

export function firstPickMatchedProviderNotification(userId: string, bookingId: string): BookingNotificationPayload {
  return {
    userId,
    type: 'booking.matched',
    title: 'You were matched',
    body: 'Your first-pick request was accepted and matched.',
    data: { bookingId },
  };
}

export function firstPickMatchedCustomerNotification(input: {
  userId: string;
  bookingId: string;
  provider: DisplayProvider;
  chatRoomId?: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.matched',
    title: 'Partner matched',
    body: `${input.provider.displayName} accepted your request. Your chat room is ready.`,
    data: {
      bookingId: input.bookingId,
      chatRoomId: input.chatRoomId,
      providerProfileId: input.provider.id,
    },
  };
}

export function customerFirstPickRejectedNotification(input: {
  userId: string;
  bookingId: string;
  providerProfileId: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'booking.rejected',
    title: 'Partner declined your booking',
    body: 'We are still looking for another available partner.',
    data: { bookingId: input.bookingId, providerProfileId: input.providerProfileId },
  };
}

export function customerMarketplaceProviderAcceptedNotification(input: {
  userId: string;
  bookingId: string;
  provider: DisplayProvider;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'provider.accepted',
    title: 'Marketplace partner is ready',
    body: `${input.provider.displayName} can take this booking. Select this partner if you want to switch.`,
    data: { bookingId: input.bookingId, providerProfileId: input.provider.id },
  };
}

export function customerMarketplaceProviderRejectedNotification(input: {
  userId: string;
  bookingId: string;
  provider: DisplayProvider;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'provider.rejected',
    title: 'Partner declined',
    body: `${input.provider.displayName} cannot take this booking.`,
    data: { bookingId: input.bookingId, providerProfileId: input.provider.id },
  };
}

export function serviceStartedCustomerNotification(input: {
  userId: string;
  bookingId: string;
  chatRoomId?: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'service.started',
    title: 'Service started',
    body: 'Your partner started the service. Continue in the matched chat if needed.',
    data: { bookingId: input.bookingId, chatRoomId: input.chatRoomId },
  };
}

export function serviceStartedProviderNotification(input: {
  userId: string;
  bookingId: string;
  chatRoomId?: string;
}): BookingNotificationPayload {
  return {
    userId: input.userId,
    type: 'service.started',
    title: 'Service started',
    body: 'Continue with the customer in the matched chat if needed.',
    data: { bookingId: input.bookingId, chatRoomId: input.chatRoomId },
  };
}

export function customerServiceCompletedNotification(userId: string, bookingId: string): BookingNotificationPayload {
  return {
    userId,
    type: 'service.completed',
    title: 'Service completed',
    body: 'Please leave a review when you are ready.',
    data: { bookingId },
  };
}

export function providerEarningCreatedNotification(userId: string, bookingId: string): BookingNotificationPayload {
  return {
    userId,
    type: 'earning.created',
    title: 'Earning created',
    body: 'Your completed service has been added to earnings.',
    data: { bookingId },
  };
}
