import { Prisma } from '@prisma/client';

export const adminUserSummarySelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  roles: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const adminUserIdentitySelect = {
  id: true,
  phone: true,
  fullName: true,
} satisfies Prisma.UserSelect;

export const adminUserAuthSelect = {
  ...adminUserSummarySelect,
  supabaseUserId: true,
} satisfies Prisma.UserSelect;

export const adminAppSessionSummarySelect = {
  id: true,
  userId: true,
  role: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  deviceLanguage: true,
  lastLoginAddress: true,
  ipAddress: true,
  active: true,
  lastSeenAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppSessionSelect;

export const adminPushDeviceSummarySelect = {
  id: true,
  role: true,
  platform: true,
  enabled: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  deliveries: {
    orderBy: { attemptedAt: 'desc' },
    take: 1,
    select: {
      id: true,
      status: true,
      attemptedAt: true,
      provider: true,
      response: true,
    },
  },
} satisfies Prisma.PushDeviceSelect;

export const adminNotificationPushDeviceSelect = {
  id: true,
  role: true,
  platform: true,
  enabled: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PushDeviceSelect;

export const adminNotificationDeliverySelect = {
  id: true,
  notificationId: true,
  pushDeviceId: true,
  provider: true,
  status: true,
  response: true,
  attemptedAt: true,
  pushDevice: { select: adminNotificationPushDeviceSelect },
} satisfies Prisma.NotificationDeliverySelect;

export const adminUserListPushDeviceSelect = {
  id: true,
  role: true,
  platform: true,
  enabled: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PushDeviceSelect;

export const adminAppSessionListSelect = {
  id: true,
  userId: true,
  role: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  ipAddress: true,
  active: true,
  lastSeenAt: true,
  expiresAt: true,
  user: {
    select: {
      phone: true,
      fullName: true,
      customerProfile: { select: { id: true } },
      providerProfile: {
        select: {
          id: true,
          displayName: true,
        },
      },
      pushDevices: {
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          platform: true,
          enabled: true,
          lastSeenAt: true,
        },
      },
    },
  },
} satisfies Prisma.AppSessionSelect;

export const adminNotificationUserSelect = {
  id: true,
  phone: true,
  fullName: true,
  roles: true,
  customerProfile: { select: { id: true } },
  providerProfile: { select: { id: true, displayName: true, status: true } },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: adminUserListPushDeviceSelect,
  },
} satisfies Prisma.UserSelect;

export const adminNotificationListSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  createdAt: true,
  user: { select: adminNotificationUserSelect },
  deliveries: {
    orderBy: { attemptedAt: 'desc' },
    take: 10,
    select: adminNotificationDeliverySelect,
  },
} satisfies Prisma.NotificationSelect;

export const adminNotificationBoardListSelect = {
  ...adminNotificationListSelect,
  user: {
    select: {
      ...adminNotificationUserSelect,
      pushDevices: {
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: adminUserListPushDeviceSelect,
      },
    },
  },
  deliveries: {
    orderBy: { attemptedAt: 'desc' },
    take: 10,
    select: adminNotificationDeliverySelect,
  },
} satisfies Prisma.NotificationSelect;

export const adminUserListSessionSelect = {
  id: true,
  userId: true,
  role: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  deviceLanguage: true,
  lastLoginAddress: true,
  active: true,
  lastSeenAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppSessionSelect;

export const adminUserListSelect = {
  ...adminUserSummarySelect,
  adminOperatorPermission: {
    select: {
      id: true,
      categories: true,
      updatedAt: true,
    },
  },
  customerProfile: { select: { id: true, userId: true, addresses: true } },
  providerProfile: { select: { id: true, displayName: true, status: true } },
  appSessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 1,
    select: adminUserListSessionSelect,
  },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: adminUserListPushDeviceSelect,
  },
} satisfies Prisma.UserSelect;

export const adminFinanceApproverDirectoryUserSelect = {
  ...adminUserSummarySelect,
  appSessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 1,
    select: adminUserListSessionSelect,
  },
  pushDevices: {
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: adminUserListPushDeviceSelect,
  },
} satisfies Prisma.UserSelect;
