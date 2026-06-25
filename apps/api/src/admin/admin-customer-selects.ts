import { Prisma } from '@prisma/client';
import { adminCustomerDetailBookingSelect } from './admin-booking-selects';
import { adminBookingServiceSummarySelect } from './admin-service-selects';
import { adminProviderSummarySelect } from './admin-provider-selects';
import {
  adminAppSessionSummarySelect,
  adminNotificationDeliverySelect,
  adminPushDeviceSummarySelect,
  adminUserSummarySelect,
} from './admin-user-selects';

export const adminCustomerNotificationSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
  deliveries: {
    orderBy: { attemptedAt: 'desc' },
    take: 5,
    select: adminNotificationDeliverySelect,
  },
} satisfies Prisma.NotificationSelect;

export const ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT = 25;
export const ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT = 25;
export const ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT = 25;
export const ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT = 25;

const adminCustomerDetailReviewBookingSelect = {
  id: true,
  openedAt: true,
  createdAt: true,
  services: { select: adminBookingServiceSummarySelect },
} satisfies Prisma.BookingSelect;

const adminCustomerDetailReviewSelect = {
  id: true,
  bookingId: true,
  customerProfileId: true,
  providerProfileId: true,
  rating: true,
  comment: true,
  status: true,
  reportReason: true,
  createdAt: true,
  customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
  providerProfile: { select: adminProviderSummarySelect },
  booking: { select: adminCustomerDetailReviewBookingSelect },
} satisfies Prisma.ReviewSelect;

const adminCustomerDetailProviderReviewSelect = {
  id: true,
  bookingId: true,
  customerProfileId: true,
  providerProfileId: true,
  comment: true,
  status: true,
  reportReason: true,
  moderatedAt: true,
  createdAt: true,
  customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
  providerProfile: { select: adminProviderSummarySelect },
  booking: { select: adminCustomerDetailReviewBookingSelect },
} satisfies Prisma.ProviderCustomerReviewSelect;

export const adminCustomerDetailSelect = {
  id: true,
  userId: true,
  addresses: true,
  user: {
    select: {
      ...adminUserSummarySelect,
      appSessions: {
        orderBy: { lastSeenAt: 'desc' },
        take: 20,
        select: adminAppSessionSummarySelect,
      },
      pushDevices: {
        orderBy: { updatedAt: 'desc' },
        take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
        select: adminPushDeviceSummarySelect,
      },
      notifications: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: adminCustomerNotificationSelect,
      },
    },
  },
  selectedLocations: {
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      latitude: true,
      longitude: true,
      addressText: true,
      createdAt: true,
    },
  },
  bookings: {
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: adminCustomerDetailBookingSelect,
  },
  reviews: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT,
    select: adminCustomerDetailReviewSelect,
  },
  providerReviews: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT,
    select: adminCustomerDetailProviderReviewSelect,
  },
  favoriteProviders: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT,
    select: {
      id: true,
      providerProfileId: true,
      createdAt: true,
      providerProfile: { select: adminProviderSummarySelect },
    },
  },
  viewedProviders: {
    orderBy: { lastViewedAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT,
    select: {
      id: true,
      providerProfileId: true,
      firstViewedAt: true,
      lastViewedAt: true,
      viewCount: true,
      providerProfile: { select: adminProviderSummarySelect },
    },
  },
} satisfies Prisma.CustomerProfileSelect;
