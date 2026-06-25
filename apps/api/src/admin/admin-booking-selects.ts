import { Prisma } from '@prisma/client';
import {
  adminEarningSummarySelect,
  adminPaymentSummarySelect,
  adminRefundSummarySelect,
} from './admin-payment-selects';
import { adminProviderSummarySelect } from './admin-provider-selects';
import { adminBookingServiceSummarySelect } from './admin-service-selects';
import { adminUserSummarySelect } from './admin-user-selects';

export const adminAddressSnapshotSelect = {
  id: true,
  bookingId: true,
  customerProfileId: true,
  selectedLocationId: true,
  address: true,
  addressText: true,
  latitude: true,
  longitude: true,
  source: true,
  createdAt: true,
} satisfies Prisma.BookingAddressSnapshotSelect;

export const adminChatRoomPresenceSelect = {
  id: true,
  messages: {
    orderBy: { createdAt: 'asc' },
    take: 20,
    select: {
      id: true,
      createdAt: true,
      body: true,
      sender: { select: { id: true, phone: true, fullName: true, roles: true } },
    },
  },
} satisfies Prisma.ChatRoomSelect;

export const adminBookingOpsTaskSummarySelect = {
  id: true,
  bookingId: true,
  type: true,
  status: true,
  note: true,
  actorId: true,
  createdAt: true,
  updatedAt: true,
  actor: { select: { id: true, phone: true, fullName: true } },
} satisfies Prisma.BookingOpsTaskSelect;

export const adminChatMessageSummarySelect = {
  id: true,
  chatRoomId: true,
  senderId: true,
  body: true,
  attachments: true,
  createdAt: true,
  sender: { select: { id: true, phone: true, fullName: true, roles: true } },
} satisfies Prisma.ChatMessageSelect;

export const ADMIN_CUSTOMER_DETAIL_BOOKING_CHAT_MESSAGE_LIMIT = 20;

export const adminBookingListSelect = {
  id: true,
  customerProfileId: true,
  preferredProviderId: true,
  selectedProviderId: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  openedAt: true,
  expiresAt: true,
  matchedAt: true,
  matchSource: true,
  closedAt: true,
  closedByRole: true,
  closedReason: true,
  closedNote: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
  address: true,
  lat: true,
  lng: true,
  customerProfile: {
    select: {
      id: true,
      user: {
        select: {
          ...adminUserSummarySelect,
          appSessions: {
            orderBy: { lastSeenAt: 'desc' },
            take: 1,
            select: { deviceLanguage: true },
          },
        },
      },
    },
  },
  preferredProvider: { select: adminProviderSummarySelect },
  selectedProvider: { select: adminProviderSummarySelect },
  participants: {
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      providerProfileId: true,
      status: true,
      distanceMeters: true,
      providerStatusAtJoin: true,
      joinedAt: true,
      respondedAt: true,
      providerProfile: { select: adminProviderSummarySelect },
    },
  },
  services: { select: adminBookingServiceSummarySelect },
  addressSnapshot: { select: adminAddressSnapshotSelect },
  payment: { select: adminPaymentSummarySelect },
  refunds: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminRefundSummarySelect,
  },
  earning: { select: adminEarningSummarySelect },
  chatRoom: { select: adminChatRoomPresenceSelect },
} satisfies Prisma.BookingSelect;

export const adminCustomerBookingListSelect = {
  id: true,
  customerProfileId: true,
  preferredProviderId: true,
  selectedProviderId: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  expiresAt: true,
  matchedAt: true,
  matchSource: true,
  closedAt: true,
  closedByRole: true,
  closedReason: true,
  closedNote: true,
  createdAt: true,
  updatedAt: true,
  metadata: true,
  address: true,
  lat: true,
  lng: true,
  preferredProvider: { select: adminProviderSummarySelect },
  selectedProvider: { select: adminProviderSummarySelect },
  services: { select: adminBookingServiceSummarySelect },
  addressSnapshot: { select: adminAddressSnapshotSelect },
  payment: { select: adminPaymentSummarySelect },
  refunds: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminRefundSummarySelect,
  },
  chatRoom: { select: { id: true } },
} satisfies Prisma.BookingSelect;

export const adminCustomerDetailBookingSelect = {
  ...adminBookingListSelect,
  review: true,
  walletLedgerEntries: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      type: true,
      sourceKey: true,
      amount: true,
      currency: true,
      reference: true,
      notes: true,
      createdAt: true,
    },
  },
  opsTasks: {
    orderBy: { updatedAt: 'desc' },
    select: adminBookingOpsTaskSummarySelect,
  },
  chatRoom: {
    select: {
      id: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        take: ADMIN_CUSTOMER_DETAIL_BOOKING_CHAT_MESSAGE_LIMIT,
        select: adminChatMessageSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingSelect;
