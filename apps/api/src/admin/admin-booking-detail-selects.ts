import { Prisma } from '@prisma/client';
import {
  adminAddressSnapshotSelect,
  adminBookingOpsTaskSummarySelect,
  adminChatMessageSummarySelect,
} from './admin-booking-selects';
import {
  adminEarningDetailSelect,
  adminPaymentSummarySelect,
  adminRecentPlatformFeeLogsSelect,
  adminRecentProviderTaxLogsSelect,
  adminRecentProviderWalletLedgerEntriesSelect,
  adminRefundSummarySelect,
} from './admin-payment-selects';
import {
  adminBookingDetailProviderSelect,
  adminLocationSnapshotSummarySelect,
} from './admin-provider-profile-selects';
import { adminBookingServiceSummarySelect } from './admin-service-selects';
import { adminUserSummarySelect } from './admin-user-selects';

export const ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT = 200;

export const adminBookingDetailSelect = {
  id: true,
  customerProfileId: true,
  preferredProviderId: true,
  selectedProviderId: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  address: true,
  lat: true,
  lng: true,
  notes: true,
  metadata: true,
  travelBufferMin: true,
  earlyAcceptMin: true,
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
  customerProfile: {
    select: {
      id: true,
      userId: true,
      addresses: true,
      user: { select: adminUserSummarySelect },
    },
  },
  preferredProvider: { select: adminBookingDetailProviderSelect },
  selectedProvider: { select: adminBookingDetailProviderSelect },
  participants: {
    orderBy: { joinedAt: 'asc' },
    select: {
      id: true,
      bookingId: true,
      providerProfileId: true,
      status: true,
      distanceMeters: true,
      providerStatusAtJoin: true,
      joinedAt: true,
      respondedAt: true,
      providerProfile: { select: adminBookingDetailProviderSelect },
    },
  },
  services: { select: adminBookingServiceSummarySelect },
  payment: { select: adminPaymentSummarySelect },
  refunds: {
    orderBy: { createdAt: 'desc' },
    select: adminRefundSummarySelect,
  },
  review: true,
  addressSnapshot: { select: adminAddressSnapshotSelect },
  earning: { select: adminEarningDetailSelect },
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(5),
  taxLogs: adminRecentProviderTaxLogsSelect(5),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(5),
  opsTasks: {
    orderBy: { updatedAt: 'desc' },
    select: adminBookingOpsTaskSummarySelect,
  },
  snapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 10,
    select: adminLocationSnapshotSummarySelect,
  },
  chatRoom: {
    select: {
      id: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: ADMIN_BOOKING_DETAIL_CHAT_MESSAGE_LIMIT,
        select: adminChatMessageSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingSelect;

export const adminPaymentDetailSelect = {
  ...adminPaymentSummarySelect,
  booking: { select: adminBookingDetailSelect },
  refunds: {
    orderBy: { createdAt: 'desc' },
    select: adminRefundSummarySelect,
  },
} satisfies Prisma.PaymentSelect;
