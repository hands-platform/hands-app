import {
  ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT,
  adminBookingDetailSelect,
  adminPaymentDetailSelect,
} from './admin-booking-detail-selects';
import { adminBookingDetailProviderSelect } from './admin-provider-profile-selects';

describe('admin booking detail selects', () => {
  it('keeps booking detail connected to customer, provider, payment, and ops context', () => {
    expect(adminBookingDetailSelect).toMatchObject({
      customerProfile: expect.any(Object),
      preferredProvider: { select: adminBookingDetailProviderSelect },
      selectedProvider: { select: adminBookingDetailProviderSelect },
      payment: expect.any(Object),
      opsTasks: expect.any(Object),
      providerCustomerReview: {
        select: expect.objectContaining({
          bookingId: true,
          customerProfileId: true,
          providerProfileId: true,
        }),
      },
      review: {
        select: expect.objectContaining({
          bookingId: true,
          customerProfileId: true,
          providerProfileId: true,
        }),
      },
      participants: { take: 20 },
      providerRequestEvents: { take: 50 },
      refunds: { take: 10 },
      opsTasks: { take: 10 },
      snapshots: { take: 10 },
    });
  });

  it('keeps booking detail chat transcript capped for initial admin review', () => {
    expect(ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT).toBe(25);
    expect(adminBookingDetailSelect.chatRoom.select).toMatchObject({
      _count: { select: { messages: true } },
    });
    expect(adminBookingDetailSelect.chatRoom.select.messages).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT,
      select: expect.any(Object),
    });
  });

  it('keeps payment detail attached to booking detail and refunds', () => {
    expect(adminPaymentDetailSelect.booking).toMatchObject({
      select: adminBookingDetailSelect,
    });
    expect(adminPaymentDetailSelect.refunds).toMatchObject({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });
});
