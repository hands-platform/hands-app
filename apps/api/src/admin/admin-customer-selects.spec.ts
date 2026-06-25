import { adminCustomerDetailBookingSelect } from './admin-booking-selects';
import {
  ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT,
  ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT,
  ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
  ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT,
  ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT,
  adminCustomerDetailSelect,
  adminCustomerNotificationSelect,
} from './admin-customer-selects';

describe('admin customer selects', () => {
  it('keeps customer notifications bounded with delivery context', () => {
    expect(adminCustomerNotificationSelect.deliveries).toMatchObject({
      orderBy: { attemptedAt: 'desc' },
      take: 5,
      select: expect.objectContaining({ status: true, attemptedAt: true }),
    });
  });

  it('keeps customer detail activity lists bounded', () => {
    expect(adminCustomerDetailSelect.user.select.appSessions).toMatchObject({ take: 20 });
    expect(adminCustomerDetailSelect.user.select.appSessions.select).toMatchObject({
      deviceLanguage: true,
      lastLoginAddress: true,
    });
    expect(adminCustomerDetailSelect.user.select.notifications).toMatchObject({
      take: 50,
      select: adminCustomerNotificationSelect,
    });
    expect(adminCustomerDetailSelect.user.select.pushDevices).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
    });
    expect(adminCustomerDetailSelect.selectedLocations).toMatchObject({ take: 25 });
    expect(adminCustomerDetailSelect.bookings).toMatchObject({
      take: 100,
      select: adminCustomerDetailBookingSelect,
    });
    expect(adminCustomerDetailSelect.reviews).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT,
      select: expect.objectContaining({
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
      }),
    });
    expect(adminCustomerDetailSelect.providerReviews).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT,
      select: expect.objectContaining({
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
      }),
    });
    expect(adminCustomerDetailSelect.favoriteProviders).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT,
      select: expect.objectContaining({
        providerProfile: expect.objectContaining({
          select: expect.objectContaining({ displayName: true, status: true }),
        }),
      }),
    });
    expect(adminCustomerDetailSelect.viewedProviders).toMatchObject({
      orderBy: { lastViewedAt: 'desc' },
      take: ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT,
      select: expect.objectContaining({
        viewCount: true,
        providerProfile: expect.objectContaining({
          select: expect.objectContaining({ displayName: true, status: true }),
        }),
      }),
    });
  });
});
