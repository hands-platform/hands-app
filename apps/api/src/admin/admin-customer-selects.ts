import { Prisma, ReferralAudience } from '@prisma/client';
import {
  adminCustomerBookingListSelect,
  adminCustomerDetailBookingSelect,
} from './admin-booking-selects';
import { adminProviderBookingListSummarySelect } from './admin-provider-selects';
import { adminBookingServiceSummarySelect } from './admin-service-selects';
import {
  adminPushDeviceSummarySelect,
  adminUserIdentitySelect,
  adminUserSummarySelect,
} from './admin-user-selects';
import { customerAppNotificationWhere } from '../notifications/customer-app-notification.policy';

export const ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT = 10;
export const ADMIN_CUSTOMER_DIRECTORY_BOOKING_LIMIT = 10;
export const ADMIN_CUSTOMER_DIRECTORY_PUSH_DEVICE_LIMIT = 3;
export const ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT = 1;

const adminCustomerDirectoryAppSessionSelect = {
  deviceId: true,
  platform: true,
  appVersion: true,
  deviceLanguage: true,
  lastLoginAddress: true,
  ipAddress: true,
  active: true,
  lastSeenAt: true,
} satisfies Prisma.AppSessionSelect;

const adminCustomerDirectoryPushDeviceSelect = {
  id: true,
  platform: true,
  enabled: true,
  lastSeenAt: true,
  deliveries: {
    orderBy: { attemptedAt: 'desc' },
    take: 1,
    select: { status: true },
  },
} satisfies Prisma.PushDeviceSelect;

const adminCustomerDirectoryUserSelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  createdAt: true,
  updatedAt: true,
  appSessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_CUSTOMER_DIRECTORY_SESSION_LIMIT,
    select: adminCustomerDirectoryAppSessionSelect,
  },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: ADMIN_CUSTOMER_DIRECTORY_PUSH_DEVICE_LIMIT,
    select: adminCustomerDirectoryPushDeviceSelect,
  },
} satisfies Prisma.UserSelect;

export const adminCustomerDirectorySelect = {
  id: true,
  userId: true,
  gender: true,
  addresses: true,
  user: { select: adminCustomerDirectoryUserSelect },
  _count: { select: { selectedLocations: true } },
  bookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DIRECTORY_BOOKING_LIMIT,
    select: adminCustomerBookingListSelect,
  },
} satisfies Prisma.CustomerProfileSelect;

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

const adminCustomerSafeSessionSummarySelect = {
  deviceLanguage: true,
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
export const ADMIN_CUSTOMER_DETAIL_REFERRAL_LIMIT = 10;

const adminCustomerDetailReferralRewardSelect = {
  id: true,
  amount: true,
  availableAt: true,
  currency: true,
  qualifyingBookingId: true,
  status: true,
  walletOwnerCustomerProfileId: true,
  createdAt: true,
} satisfies Prisma.ReferralRewardSelect;

const adminCustomerDetailReferralCodeSelect = {
  id: true,
  code: true,
  active: true,
  createdAt: true,
} satisfies Prisma.ReferralCodeSelect;

const adminCustomerDetailReferralAttributionSelect = {
  id: true,
  status: true,
  fraudReviewStatus: true,
  installSource: true,
  platform: true,
  createdAt: true,
  referralCode: { select: adminCustomerDetailReferralCodeSelect },
  referrerCustomerProfile: {
    select: { id: true, user: { select: adminUserIdentitySelect } },
  },
  referredCustomerProfile: {
    select: { id: true, user: { select: adminUserIdentitySelect } },
  },
  rewards: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_REFERRAL_LIMIT,
    select: adminCustomerDetailReferralRewardSelect,
  },
} satisfies Prisma.ReferralAttributionSelect;

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
    where: customerAppNotificationWhere(),
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT,
    select: adminCustomerNotificationSelect,
  },
} satisfies Prisma.UserSelect;

const adminCustomerDetailUserWithoutDiagnosticsSelect = {
  ...adminUserSummarySelect,
  appSessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 1,
    select: adminCustomerSafeSessionSummarySelect,
  },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_PUSH_DEVICE_LIMIT,
    select: adminPushDeviceSummarySelect,
  },
  notifications: {
    where: customerAppNotificationWhere(),
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_NOTIFICATION_LIMIT,
    select: adminCustomerNotificationSelect,
  },
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
  referralCodes: {
    where: { audience: ReferralAudience.CUSTOMER },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: adminCustomerDetailReferralCodeSelect,
  },
  referralsMade: {
    where: { audience: ReferralAudience.CUSTOMER },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_CUSTOMER_DETAIL_REFERRAL_LIMIT,
    select: adminCustomerDetailReferralAttributionSelect,
  },
  referralsReceived: {
    where: { audience: ReferralAudience.CUSTOMER },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: adminCustomerDetailReferralAttributionSelect,
  },
} satisfies Prisma.CustomerProfileSelect;

export const adminCustomerDetailWithoutDiagnosticsSelect = {
  ...adminCustomerDetailSelect,
  user: {
    select: adminCustomerDetailUserWithoutDiagnosticsSelect,
  },
} satisfies Prisma.CustomerProfileSelect;
