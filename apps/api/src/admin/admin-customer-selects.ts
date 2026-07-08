import { Prisma } from '@prisma/client';
import { adminCustomerDetailBookingSelect } from './admin-booking-selects';
import { adminProviderBookingListSummarySelect } from './admin-provider-selects';
import { adminBookingServiceSummarySelect } from './admin-service-selects';
import {
  adminPushDeviceSummarySelect,
  adminUserIdentitySelect,
  adminUserSummarySelect,
} from './admin-user-selects';

export const ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT = 10;

const adminCustomerNotificationDeliverySelect = {
  id: true,
  notificationId: true,
  pushDeviceId: true,
  provider: true,
  status: true,
  attemptedAt: true,
} satisfies Prisma.NotificationDeliverySelect;

const adminCustomerDetailAppSessionSelect = {
  id: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  deviceLanguage: true,
  lastLoginAddress: true,
  ipAddress: true,
  active: true,
  lastSeenAt: true,
} satisfies Prisma.AppSessionSelect;

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
    select: adminCustomerNotificationDeliverySelect,
  },
} satisfies Prisma.NotificationSelect;

export const ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_FAVORITE_PROVIDER_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_VIEWED_PROVIDER_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_REVIEW_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_PROVIDER_REVIEW_LIMIT = 10;
export const ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT = 6;

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
  customerProfile: { select: { id: true, user: { select: adminUserIdentitySelect } } },
  providerProfile: { select: adminProviderBookingListSummarySelect },
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
  customerProfile: { select: { id: true, user: { select: adminUserIdentitySelect } } },
  providerProfile: { select: adminProviderBookingListSummarySelect },
  booking: { select: adminCustomerDetailReviewBookingSelect },
} satisfies Prisma.ProviderCustomerReviewSelect;

const adminCustomerDetailUserSelect = {
  ...adminUserSummarySelect,
  appSessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 10,
    select: adminCustomerDetailAppSessionSelect,
  },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
    select: adminPushDeviceSummarySelect,
  },
  notifications: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT,
    select: adminCustomerNotificationSelect,
  },
} satisfies Prisma.UserSelect;

const adminCustomerDetailUserWithoutDiagnosticsSelect = {
  ...adminUserSummarySelect,
} satisfies Prisma.UserSelect;

export const adminCustomerDetailSelect = {
  id: true,
  userId: true,
  addresses: true,
  user: {
    select: adminCustomerDetailUserSelect,
  },
  selectedLocations: {
    orderBy: { createdAt: 'desc' },
    take: 10,
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
    take: ADMIN_CUSTOMER_DETAIL_BOOKING_LIMIT,
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
      providerProfile: { select: adminProviderBookingListSummarySelect },
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
      providerProfile: { select: adminProviderBookingListSummarySelect },
    },
  },
} satisfies Prisma.CustomerProfileSelect;

export const adminCustomerDetailWithoutDiagnosticsSelect = {
  ...adminCustomerDetailSelect,
  user: {
    select: adminCustomerDetailUserWithoutDiagnosticsSelect,
  },
} satisfies Prisma.CustomerProfileSelect;
