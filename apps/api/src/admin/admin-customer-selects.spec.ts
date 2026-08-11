import { adminCustomerDetailBookingSelect } from './admin-booking-selects';
import { CUSTOMER_APP_NOTIFICATION_TYPES } from '../notifications/customer-app-notification.policy';
import {
  ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT,
  ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT,
  ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT,
  ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT,
  ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
  ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT,
  ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT,
  ADMIN_CUSTOMER_DIRECTORY_BOOKING_LIMIT,
  ADMIN_CUSTOMER_DIRECTORY_PUSH_DEVICE_LIMIT,
  ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT,
  adminCustomerDirectorySelect,
  adminCustomerDetailSelect,
  adminCustomerDetailWithoutDiagnosticsSelect,
  adminCustomerNotificationSelect,
} from './admin-customer-selects';

describe('admin customer selects', () => {
  it('keeps customer directory rows compact while preserving operator evidence', () => {
    expect(adminCustomerDirectorySelect.bookings).toMatchObject({
      take: ADMIN_CUSTOMER_DIRECTORY_BOOKING_LIMIT,
    });
    expect(adminCustomerDirectorySelect.user.select.appSessions).toMatchObject({
      take: ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT,
      select: expect.objectContaining({
        deviceId: true,
        deviceLanguage: true,
        ipAddress: true,
        lastSeenAt: true,
      }),
    });
    expect(adminCustomerDirectorySelect.user.select.pushDevices).toMatchObject({
      take: ADMIN_CUSTOMER_DIRECTORY_PUSH_DEVICE_LIMIT,
      select: expect.objectContaining({
        enabled: true,
        lastSeenAt: true,
        deliveries: { orderBy: { attemptedAt: 'desc' }, take: 1, select: { status: true } },
      }),
    });
    expect(adminCustomerDirectorySelect.user.select.pushDevices.select.deliveries.select).not.toHaveProperty(
      'response',
    );
    expect(adminCustomerDirectorySelect).not.toHaveProperty('selectedLocations');
    expect(adminCustomerDirectorySelect._count).toEqual({ select: { selectedLocations: true } });
    expect(ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT).toBe(1);
  });

  it('keeps customer notifications bounded with delivery context', () => {
    expect(adminCustomerNotificationSelect.deliveries).toMatchObject({
      orderBy: { attemptedAt: 'desc' },
      take: 5,
      select: expect.objectContaining({ status: true, attemptedAt: true }),
    });
  });

  it('keeps customer detail activity lists bounded', () => {
    expect(ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT).toBe(6);
    expect(ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT).toBe(10);
    expect(ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT).toBe(10);
    expect(ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT).toBe(10);
    expect(ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT).toBe(10);
    expect(ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT).toBe(10);
    expect(adminCustomerDetailSelect.user.select.appSessions).toMatchObject({ take: 10 });
    expect(adminCustomerDetailSelect.user.select.appSessions.select).toMatchObject({
      deviceLanguage: true,
      lastLoginAddress: true,
    });
    expect(adminCustomerDetailSelect.user.select.notifications).toMatchObject({
      where: { type: { in: [...CUSTOMER_APP_NOTIFICATION_TYPES] } },
      take: 10,
      select: adminCustomerNotificationSelect,
    });
    expect(adminCustomerDetailSelect.user.select.pushDevices).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
    });
    expect(adminCustomerDetailSelect.selectedLocations).toMatchObject({ take: 10 });
    expect(adminCustomerDetailSelect.bookings).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT,
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
    expect(adminCustomerDetailSelect.referralsMade).toMatchObject({
      take: 10,
      select: expect.objectContaining({
        referralCode: expect.any(Object),
        referredCustomerProfile: expect.any(Object),
        rewards: expect.objectContaining({
          take: 10,
          select: expect.objectContaining({
            amount: true,
            availableAt: true,
            qualifyingBookingId: true,
            status: true,
          }),
        }),
      }),
    });
  });

  it('keeps customer detail booking chat previews intentionally small', () => {
    expect(adminCustomerDetailBookingSelect.chatRoom).toMatchObject({
      select: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 3,
        },
      },
    });
  });

  it('keeps customer detail notification delivery payload compact', () => {
    expect(adminCustomerNotificationSelect.deliveries.select).toMatchObject({
      id: true,
      provider: true,
      status: true,
      attemptedAt: true,
    });
    expect(adminCustomerNotificationSelect.deliveries.select).not.toHaveProperty('response');
    expect(adminCustomerNotificationSelect.deliveries.select).not.toHaveProperty('pushDevice');
  });

  it('keeps customer detail review people payload compact', () => {
    expect(adminCustomerDetailSelect.reviews.select).toMatchObject({
      customerProfile: { select: { id: true, user: { select: { id: true, phone: true, fullName: true } } } },
      providerProfile: {
        select: expect.objectContaining({
          id: true,
          displayName: true,
          status: true,
          user: { select: { id: true, phone: true, fullName: true } },
        }),
      },
    });
    expect(adminCustomerDetailSelect.reviews.select.providerProfile.select).not.toHaveProperty('ratingAvg');
    expect(adminCustomerDetailSelect.reviews.select.customerProfile.select.user.select).not.toHaveProperty('email');
    expect(adminCustomerDetailSelect.providerReviews.select.providerProfile.select).not.toHaveProperty('ratingAvg');
    expect(adminCustomerDetailSelect.providerReviews.select.customerProfile.select.user.select).not.toHaveProperty(
      'email',
    );
  });

  it('keeps customer detail app session payload focused on visible evidence', () => {
    expect(adminCustomerDetailSelect.user.select.appSessions.select).toMatchObject({
      id: true,
      deviceId: true,
      platform: true,
      appVersion: true,
      deviceLanguage: true,
      lastLoginAddress: true,
      ipAddress: true,
      active: true,
      lastSeenAt: true,
    });
    expect(adminCustomerDetailSelect.user.select.appSessions.select).not.toHaveProperty('userId');
    expect(adminCustomerDetailSelect.user.select.appSessions.select).not.toHaveProperty('expiresAt');
    expect(adminCustomerDetailSelect.user.select.appSessions.select).not.toHaveProperty('createdAt');
    expect(adminCustomerDetailSelect.user.select.appSessions.select).not.toHaveProperty('updatedAt');
  });

  it('keeps a safe session summary and customer notifications while removing developer diagnostics', () => {
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user).toMatchObject({
      select: expect.objectContaining({
        id: true,
        phone: true,
        fullName: true,
      }),
    });
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user.select.appSessions).toMatchObject({
      take: 1,
      select: {
        deviceLanguage: true,
        lastSeenAt: true,
      },
    });
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user.select.appSessions.select).not.toHaveProperty(
      'deviceId',
    );
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user.select.appSessions.select).not.toHaveProperty(
      'ipAddress',
    );
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user.select.pushDevices).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
    });
    expect(adminCustomerDetailWithoutDiagnosticsSelect.user.select.notifications).toMatchObject({
      where: { type: { in: [...CUSTOMER_APP_NOTIFICATION_TYPES] } },
      take: ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT,
    });
    expect(adminCustomerDetailWithoutDiagnosticsSelect.bookings).toMatchObject({
      take: ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT,
      select: adminCustomerDetailBookingSelect,
    });
  });
});
