import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  EarningStatus,
  FilePurpose,
  FileReviewStatus,
  FileUploadStatus,
  FileVisibility,
  PayoutBatchStatus,
  PaymentStatus,
  Prisma,
  ProviderReportSeverity,
  ProviderReportSource,
  ProviderReportStatus,
  ProviderSanctionStatus,
  ProviderSanctionType,
  ProviderStatus,
  ReviewStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';
import { SupabaseAdminService } from '../auth/supabase-admin.service';
import { EarningsService } from '../earnings/earnings.service';
import {
  NO_SHOW_ADMIN_REVIEW_REQUIRED,
  NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW,
  NO_SHOW_PARTNER_REPORT_POLICY_KEY,
  OPERATIONAL_POLICY_DEFINITIONS,
} from '../matching/matching.policy';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { groupServiceCatalogOptions } from '../services/service-catalog-groups';

const PRICE_STEP_UNIT_VND = 100000;
const ADMIN_APP_SESSION_LIST_LIMIT = 500;
const ADMIN_CUSTOMER_LIST_LIMIT = 500;
const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 500;
const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 30;

const adminUserSummarySelect = {
  id: true,
  phone: true,
  email: true,
  fullName: true,
  roles: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const adminUserAuthSelect = {
  ...adminUserSummarySelect,
  supabaseUserId: true,
} satisfies Prisma.UserSelect;

const adminAppSessionSummarySelect = {
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
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppSessionSelect;

const adminPushDeviceSummarySelect = {
  id: true,
  platform: true,
  enabled: true,
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

const adminNotificationPushDeviceSelect = {
  id: true,
  platform: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PushDeviceSelect;

const adminNotificationDeliverySelect = {
  id: true,
  notificationId: true,
  pushDeviceId: true,
  provider: true,
  status: true,
  response: true,
  attemptedAt: true,
  pushDevice: { select: adminNotificationPushDeviceSelect },
} satisfies Prisma.NotificationDeliverySelect;

const adminUserListPushDeviceSelect = {
  id: true,
  platform: true,
  enabled: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PushDeviceSelect;

const adminAppSessionListSelect = {
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
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      ...adminUserSummarySelect,
      customerProfile: { select: { id: true, userId: true, addresses: true } },
      providerProfile: {
        select: {
          id: true,
          displayName: true,
          status: true,
          currentLocationUpdatedAt: true,
          blockedAt: true,
        },
      },
      pushDevices: {
        orderBy: { updatedAt: 'desc' },
        take: 3,
        select: adminUserListPushDeviceSelect,
      },
    },
  },
} satisfies Prisma.AppSessionSelect;

const adminNotificationUserSelect = {
  id: true,
  phone: true,
  fullName: true,
  roles: true,
  customerProfile: { select: { id: true } },
  providerProfile: { select: { id: true, displayName: true, status: true } },
} satisfies Prisma.UserSelect;

const adminNotificationListSelect = {
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
    select: adminNotificationDeliverySelect,
  },
} satisfies Prisma.NotificationSelect;

const adminUserListSessionSelect = {
  id: true,
  userId: true,
  role: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  active: true,
  lastSeenAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AppSessionSelect;

const adminUserListSelect = {
  ...adminUserSummarySelect,
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

const adminProviderSummarySelect = {
  id: true,
  userId: true,
  displayName: true,
  status: true,
  ratingAvg: true,
  reviewCount: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  blockedAt: true,
  user: { select: adminUserSummarySelect },
} satisfies Prisma.ProviderProfileSelect;

const adminProviderPublicMediaSelect = {
  id: true,
  key: true,
  url: true,
  contentType: true,
  purpose: true,
  visibility: true,
  uploadStatus: true,
  reviewStatus: true,
  reviewedAt: true,
  reviewReason: true,
  uploadedAt: true,
  sizeBytes: true,
  createdAt: true,
} satisfies Prisma.FileAssetSelect;

const adminProviderVerificationFileSelect = {
  id: true,
  key: true,
  contentType: true,
  purpose: true,
  visibility: true,
  uploadStatus: true,
  reviewStatus: true,
  reviewedAt: true,
  reviewReason: true,
  uploadedAt: true,
  sizeBytes: true,
  url: true,
} satisfies Prisma.FileAssetSelect;

const adminProviderVerificationSummarySelect = {
  id: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  files: {
    take: 3,
    select: adminProviderVerificationFileSelect,
  },
} satisfies Prisma.ProviderVerificationSelect;

const adminProviderKycSummarySelect = {
  id: true,
  status: true,
  cccdNumberLast4: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
} satisfies Prisma.ProviderKycSelect;

const adminProviderDocumentSummarySelect = {
  id: true,
  type: true,
  status: true,
  reviewedAt: true,
  rejectionReason: true,
  fileAsset: {
    select: {
      id: true,
      key: true,
      contentType: true,
      uploadStatus: true,
      uploadedAt: true,
      sizeBytes: true,
    },
  },
} satisfies Prisma.ProviderDocumentSelect;

const adminProviderBankAccountSummarySelect = {
  id: true,
  bankName: true,
  accountNumberMasked: true,
  accountNumberLast4: true,
  accountHolderName: true,
  status: true,
  isPrimary: true,
  reviewedAt: true,
  rejectionReason: true,
} satisfies Prisma.ProviderBankAccountSelect;

const adminProviderTaxProfileSummarySelect = {
  id: true,
  status: true,
  taxCodeLast4: true,
  legalName: true,
  registeredAddress: true,
  approvedAt: true,
  rejectionReason: true,
} satisfies Prisma.ProviderTaxProfileSelect;

const adminProviderAgreementSummarySelect = {
  id: true,
  type: true,
  version: true,
  acceptedAt: true,
} satisfies Prisma.ProviderAgreementSelect;

const adminProviderReportSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  source: true,
  severity: true,
  status: true,
  category: true,
  summary: true,
  details: true,
  resolvedAt: true,
  resolutionNote: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderReportSelect;

const adminProviderSanctionSummarySelect = {
  id: true,
  providerProfileId: true,
  reportId: true,
  type: true,
  status: true,
  reason: true,
  startsAt: true,
  expiresAt: true,
  liftedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderSanctionSelect;

const adminProviderSessionSummarySelect = {
  id: true,
  deviceId: true,
  ipAddress: true,
  appVersion: true,
  loggedInAt: true,
  lastSeenAt: true,
  suspicious: true,
  suspiciousReason: true,
} satisfies Prisma.ProviderSessionSelect;

const adminProviderDeviceSummarySelect = {
  id: true,
  deviceId: true,
  platform: true,
  appVersion: true,
  enabled: true,
  lastSeenAt: true,
  blockedAt: true,
  blockReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderDeviceSelect;

const adminAuditLogSelect = {
  id: true,
  action: true,
  target: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, phone: true, fullName: true } },
} satisfies Prisma.AdminAuditLogSelect;

const adminAddressSnapshotSelect = {
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

const adminServicePayoutRuleSummarySelect = {
  id: true,
  customerPrice: true,
  providerPayoutAmount: true,
  vatBps: true,
  otherCostAmount: true,
  currency: true,
  active: true,
  notes: true,
} satisfies Prisma.ServicePayoutRuleSelect;

const adminProviderServiceSummarySelect = {
  id: true,
  price: true,
  active: true,
  service: {
    select: {
      id: true,
      name: true,
      durationMin: true,
      basePrice: true,
      priceStep: true,
      active: true,
      payoutRules: {
        where: { active: true },
        orderBy: { customerPrice: 'asc' },
        select: adminServicePayoutRuleSummarySelect,
      },
    },
  },
} satisfies Prisma.ProviderServiceSelect;

const adminBookingServiceSummarySelect = {
  id: true,
  bookingId: true,
  serviceId: true,
  quantity: true,
  price: true,
  service: {
    select: {
      id: true,
      serviceGroupKey: true,
      name: true,
      durationMin: true,
      basePrice: true,
      priceStep: true,
      active: true,
      payoutRules: {
        where: { active: true },
        orderBy: { customerPrice: 'asc' },
        select: adminServicePayoutRuleSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingServiceSelect;

const adminServiceCatalogSelect = {
  id: true,
  serviceGroupKey: true,
  name: true,
  description: true,
  durationMin: true,
  basePrice: true,
  priceStep: true,
  displayOrder: true,
  active: true,
  payoutRules: {
    orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
    select: {
      id: true,
      serviceId: true,
      customerPrice: true,
      providerPayoutAmount: true,
      vatBps: true,
      otherCostAmount: true,
      currency: true,
      active: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  providers: {
    orderBy: [{ active: 'desc' }, { price: 'asc' }],
    take: 50,
    select: {
      id: true,
      providerProfileId: true,
      serviceId: true,
      price: true,
      active: true,
      providerProfile: {
        select: {
          id: true,
          displayName: true,
          status: true,
          blockedAt: true,
        },
      },
    },
  },
  bookings: {
    orderBy: { id: 'desc' },
    take: 8,
    select: {
      id: true,
      bookingId: true,
      serviceId: true,
      quantity: true,
      price: true,
      booking: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          selectedProviderId: true,
          payment: { select: { method: true, status: true, amount: true, currency: true } },
          earning: {
            select: {
              id: true,
              grossAmount: true,
              platformFee: true,
              withholdingAmount: true,
              netAmount: true,
              status: true,
              currency: true,
            },
          },
          taxLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, withholdingAmount: true, taxableAmount: true, currency: true },
          },
          platformFeeLogs: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, platformFeeAmount: true, currency: true },
          },
          walletLedgerEntries: {
            orderBy: { createdAt: 'desc' },
            take: 3,
            select: { id: true, type: true, amount: true, currency: true },
          },
        },
      },
    },
  },
  _count: { select: { providers: true, bookings: true } },
} satisfies Prisma.MassageServiceSelect;

const adminServicePayoutRuleMutationSelect = {
  id: true,
  serviceId: true,
  customerPrice: true,
  providerPayoutAmount: true,
  vatBps: true,
  otherCostAmount: true,
  currency: true,
  active: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServicePayoutRuleSelect;

const adminServiceMutationSelect = {
  id: true,
  serviceGroupKey: true,
  name: true,
  description: true,
  durationMin: true,
  basePrice: true,
  priceStep: true,
  displayOrder: true,
  active: true,
  payoutRules: {
    orderBy: [{ active: 'desc' }, { customerPrice: 'asc' }],
    select: adminServicePayoutRuleMutationSelect,
  },
} satisfies Prisma.MassageServiceSelect;

const adminServicePayoutRuleWithServiceSelect = {
  ...adminServicePayoutRuleMutationSelect,
  service: { select: adminServiceMutationSelect },
} satisfies Prisma.ServicePayoutRuleSelect;

const adminRefundSummarySelect = {
  id: true,
  bookingId: true,
  paymentId: true,
  amount: true,
  reason: true,
  status: true,
  createdAt: true,
} satisfies Prisma.RefundSelect;

const adminRefundListSelect = {
  ...adminRefundSummarySelect,
  payment: {
    select: {
      id: true,
      bookingId: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      providerRef: true,
    },
  },
  booking: {
    select: {
      id: true,
      status: true,
      customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
      selectedProvider: { select: adminProviderSummarySelect },
    },
  },
} satisfies Prisma.RefundSelect;

const adminPaymentSummarySelect = {
  id: true,
  bookingId: true,
  method: true,
  status: true,
  amount: true,
  currency: true,
  providerRef: true,
  rawMeta: true,
  refunds: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminRefundSummarySelect,
  },
} satisfies Prisma.PaymentSelect;

const adminPaymentCallbackAttemptSummarySelect = {
  id: true,
  paymentId: true,
  method: true,
  providerRef: true,
  outcome: true,
  signatureVerified: true,
  verificationMode: true,
  providerStatus: true,
  gatewayTransactionId: true,
  callbackAmount: true,
  errorCode: true,
  errorMessage: true,
  rawPayload: true,
  createdAt: true,
} satisfies Prisma.PaymentCallbackAttemptSelect;

const adminPaymentCallbackAttemptListSelect = {
  ...adminPaymentCallbackAttemptSummarySelect,
  payment: {
    select: {
      id: true,
      bookingId: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      providerRef: true,
      booking: {
        select: {
          id: true,
          status: true,
          customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
          selectedProvider: { select: adminProviderSummarySelect },
        },
      },
    },
  },
} satisfies Prisma.PaymentCallbackAttemptSelect;

const adminPlatformFeeLogSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  policyVersionId: true,
  grossAmount: true,
  platformFeeAmount: true,
  currency: true,
  ruleSnapshot: true,
  createdAt: true,
} satisfies Prisma.ProviderPlatformFeeLogSelect;

const adminProviderTaxLogSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  taxProfileId: true,
  policyVersionId: true,
  grossAmount: true,
  taxableAmount: true,
  withholdingAmount: true,
  currency: true,
  ruleSnapshot: true,
  createdAt: true,
} satisfies Prisma.ProviderTaxLogSelect;

const adminProviderWalletLedgerEntrySummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  earningId: true,
  payoutBatchId: true,
  type: true,
  sourceKey: true,
  amount: true,
  currency: true,
  reference: true,
  notes: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderWalletLedgerEntrySelect;

const adminRecentPlatformFeeLogsSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminPlatformFeeLogSummarySelect,
  }) satisfies Prisma.ProviderPlatformFeeLogFindManyArgs;

const adminRecentProviderTaxLogsSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminProviderTaxLogSummarySelect,
  }) satisfies Prisma.ProviderTaxLogFindManyArgs;

const adminRecentProviderWalletLedgerEntriesSelect = (take: number) =>
  ({
    orderBy: { createdAt: 'desc' },
    take,
    select: adminProviderWalletLedgerEntrySummarySelect,
  }) satisfies Prisma.ProviderWalletLedgerEntryFindManyArgs;

const adminEarningSummarySelect = {
  id: true,
  providerProfileId: true,
  bookingId: true,
  grossAmount: true,
  platformFee: true,
  withholdingAmount: true,
  netAmount: true,
  currency: true,
  status: true,
  availableAt: true,
  paidAt: true,
  payoutBatchId: true,
  settlementRef: true,
  settlementNotes: true,
  settlementMethod: true,
  createdAt: true,
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(3),
  taxLogs: adminRecentProviderTaxLogsSelect(3),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(3),
} satisfies Prisma.ProviderEarningSelect;

const adminEarningDetailSelect = {
  ...adminEarningSummarySelect,
  platformFeeLogs: adminRecentPlatformFeeLogsSelect(5),
  taxLogs: adminRecentProviderTaxLogsSelect(5),
  walletLedgerEntries: adminRecentProviderWalletLedgerEntriesSelect(5),
} satisfies Prisma.ProviderEarningSelect;

const adminChatRoomPresenceSelect = {
  id: true,
  messages: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      id: true,
      createdAt: true,
      body: true,
      sender: { select: { id: true, phone: true, fullName: true, roles: true } },
    },
  },
} satisfies Prisma.ChatRoomSelect;

const adminBookingListSelect = {
  id: true,
  customerProfileId: true,
  preferredProviderId: true,
  selectedProviderId: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  openedAt: true,
  expiresAt: true,
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
      user: { select: adminUserSummarySelect },
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

const adminCustomerBookingListSelect = {
  id: true,
  customerProfileId: true,
  preferredProviderId: true,
  selectedProviderId: true,
  status: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  expiresAt: true,
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

const adminBookingOpsTaskSummarySelect = {
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

const adminChatMessageSummarySelect = {
  id: true,
  chatRoomId: true,
  senderId: true,
  body: true,
  attachments: true,
  createdAt: true,
  sender: { select: { id: true, phone: true, fullName: true, roles: true } },
} satisfies Prisma.ChatMessageSelect;

const adminCustomerNotificationSelect = {
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

const adminCustomerDetailBookingSelect = {
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
        take: 100,
        select: adminChatMessageSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingSelect;

const adminCustomerDetailSelect = {
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
    take: 25,
    select: {
      id: true,
      rating: true,
      comment: true,
      status: true,
      reportReason: true,
      createdAt: true,
      providerProfile: { select: adminProviderSummarySelect },
      booking: { select: { id: true, services: { select: adminBookingServiceSummarySelect } } },
    },
  },
} satisfies Prisma.CustomerProfileSelect;

const adminProviderDetailUserSelect = {
  ...adminUserAuthSelect,
  pushDevices: {
    orderBy: { createdAt: 'desc' },
    select: adminPushDeviceSummarySelect,
  },
  fileAssets: {
    where: {
      purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
      visibility: FileVisibility.PUBLIC,
      uploadStatus: FileUploadStatus.UPLOADED,
    },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: adminProviderPublicMediaSelect,
  },
} satisfies Prisma.UserSelect;

const adminProviderVerificationDetailSelect = {
  id: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  files: {
    select: adminProviderVerificationFileSelect,
  },
} satisfies Prisma.ProviderVerificationSelect;

const adminProviderReportDetailSelect = {
  ...adminProviderReportSummarySelect,
  booking: { select: { id: true, status: true } },
  reporterUser: { select: { phone: true, fullName: true } },
  assignedAdmin: { select: { phone: true, fullName: true } },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    select: adminProviderSanctionSummarySelect,
  },
} satisfies Prisma.ProviderReportSelect;

const adminProviderReportListSelect = {
  ...adminProviderReportSummarySelect,
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      user: { select: { phone: true, fullName: true } },
    },
  },
  booking: { select: { id: true, status: true, scheduledStartAt: true } },
  reporterUser: { select: { phone: true, fullName: true } },
  assignedAdmin: { select: { phone: true, fullName: true } },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    select: adminProviderSanctionSummarySelect,
  },
} satisfies Prisma.ProviderReportSelect;

const adminProviderSanctionDetailSelect = {
  ...adminProviderSanctionSummarySelect,
  report: { select: { id: true, category: true, severity: true, status: true, summary: true } },
  issuedBy: { select: { phone: true, fullName: true } },
  liftedBy: { select: { phone: true, fullName: true } },
} satisfies Prisma.ProviderSanctionSelect;

const adminProviderSanctionListSelect = {
  ...adminProviderSanctionSummarySelect,
  providerProfile: {
    select: {
      id: true,
      displayName: true,
      user: { select: { phone: true, fullName: true } },
    },
  },
  report: { select: { id: true, category: true, severity: true, status: true, summary: true } },
  issuedBy: { select: { phone: true, fullName: true } },
  liftedBy: { select: { phone: true, fullName: true } },
} satisfies Prisma.ProviderSanctionSelect;

const adminProviderDetailBookingSelect = {
  ...adminCustomerDetailBookingSelect,
} satisfies Prisma.BookingSelect;

const adminProviderDetailEarningSelect = {
  ...adminEarningSummarySelect,
  booking: {
    select: {
      id: true,
      status: true,
      scheduledStartAt: true,
      payment: {
        select: {
          id: true,
          method: true,
          status: true,
          amount: true,
          currency: true,
        },
      },
      services: { select: adminBookingServiceSummarySelect },
    },
  },
} satisfies Prisma.ProviderEarningSelect;

const adminProviderPayoutBatchSummarySelect = {
  id: true,
  providerProfileId: true,
  totalNetAmount: true,
  currency: true,
  status: true,
  transferRef: true,
  notes: true,
  createdAt: true,
  paidAt: true,
} satisfies Prisma.ProviderPayoutBatchSelect;

const adminLocationSnapshotSummarySelect = {
  id: true,
  bookingId: true,
  providerProfileId: true,
  lat: true,
  lng: true,
  recordedAt: true,
} satisfies Prisma.LocationSnapshotSelect;

const adminProviderVerificationLogSummarySelect = {
  id: true,
  providerProfileId: true,
  actorId: true,
  action: true,
  fromStatus: true,
  toStatus: true,
  metadata: true,
  createdAt: true,
  actor: { select: { phone: true, fullName: true } },
} satisfies Prisma.ProviderVerificationLogSelect;

const adminBookingDetailProviderSelect = {
  ...adminProviderSummarySelect,
  locationSnapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 1,
    select: adminLocationSnapshotSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

const adminBookingDetailSelect = {
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
        take: 100,
        select: adminChatMessageSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingSelect;

const adminPaymentDetailSelect = {
  ...adminPaymentSummarySelect,
  booking: { select: adminBookingDetailSelect },
  refunds: {
    orderBy: { createdAt: 'desc' },
    select: adminRefundSummarySelect,
  },
} satisfies Prisma.PaymentSelect;

const adminProviderDetailSelect = {
  id: true,
  userId: true,
  displayName: true,
  legalName: true,
  dateOfBirth: true,
  gender: true,
  facebookId: true,
  activityNickname: true,
  bio: true,
  experienceYears: true,
  specialties: true,
  languages: true,
  serviceStyle: true,
  residentialAddress: true,
  city: true,
  serviceArea: true,
  level: true,
  status: true,
  ratingAvg: true,
  reviewCount: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  nextAvailableAt: true,
  blockedAt: true,
  blockedReason: true,
  trustedAt: true,
  updatedAt: true,
  user: { select: adminProviderDetailUserSelect },
  verification: { select: adminProviderVerificationDetailSelect },
  kyc: { select: adminProviderKycSummarySelect },
  documents: {
    orderBy: { createdAt: 'desc' },
    select: adminProviderDocumentSummarySelect,
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    select: adminProviderBankAccountSummarySelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: adminProviderReportDetailSelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: adminProviderSanctionDetailSelect,
  },
  agreements: {
    orderBy: { acceptedAt: 'desc' },
    select: adminProviderAgreementSummarySelect,
  },
  services: {
    select: adminProviderServiceSummarySelect,
  },
  preferredBookings: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: adminProviderDetailBookingSelect,
  },
  selectedBookings: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: adminProviderDetailBookingSelect,
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      providerProfileId: true,
      status: true,
      distanceMeters: true,
      providerStatusAtJoin: true,
      joinedAt: true,
      respondedAt: true,
      booking: { select: adminProviderDetailBookingSelect },
    },
  },
  locationSnapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 10,
    select: adminLocationSnapshotSummarySelect,
  },
  earnings: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: adminProviderDetailEarningSelect,
  },
  payoutBatches: {
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: adminProviderPayoutBatchSummarySelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 10,
    select: adminProviderSessionSummarySelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: 10,
    select: adminProviderDeviceSummarySelect,
  },
  verificationLogs: {
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: adminProviderVerificationLogSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly earnings: EarningsService,
    private readonly notifications: NotificationsService,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly redisState: RedisStateService,
  ) {}

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: adminUserListSelect,
    });
  }

  listCustomers() {
    return this.prisma.customerProfile.findMany({
      orderBy: { id: 'desc' },
      take: ADMIN_CUSTOMER_LIST_LIMIT,
      select: {
        id: true,
        userId: true,
        addresses: true,
        user: {
          select: {
            ...adminUserSummarySelect,
            appSessions: {
              orderBy: { lastSeenAt: 'desc' },
              take: 3,
              select: adminAppSessionSummarySelect,
            },
            pushDevices: {
              orderBy: { updatedAt: 'desc' },
              take: 3,
              select: adminPushDeviceSummarySelect,
            },
          },
        },
        selectedLocations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
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
          take: 25,
          select: adminCustomerBookingListSelect,
        },
      },
    });
  }

  async getCustomerDetail(customerProfileId: string) {
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: adminCustomerDetailSelect,
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: {
        OR: [
          { target: `customer:${customerProfileId}` },
          { target: `user:${customer.userId}` },
          { metadata: { path: ['customerProfileId'], equals: customerProfileId } },
          { metadata: { path: ['customerUserId'], equals: customer.userId } },
          { metadata: { path: ['userId'], equals: customer.userId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminAuditLogSelect,
    });

    return { ...customer, auditLogs };
  }

  async addCustomerOpsNote(
    actorId: string,
    customerProfileId: string,
    input: { note?: string; preset?: string; bookingId?: string | null },
  ) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Customer operation note is required');
    }

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: { id: true, userId: true, user: { select: { id: true, phone: true, fullName: true } } },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const bookingId = normalizeNullable(input.bookingId);
    if (bookingId) {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, customerProfileId },
        select: { id: true, status: true },
      });
      if (!booking) {
        throw new BadRequestException('Booking does not belong to this customer');
      }
    }

    const auditLog = await this.writeAudit(
      actorId,
      'customer.ops_note.add',
      `customer:${customerProfileId}`,
      {
        customerProfileId,
        customerUserId: customer.userId,
        customerPhone: customer.user.phone,
        customerName: customer.user.fullName,
        bookingId,
        note: content,
        preset,
      },
    );

    return { ok: true, auditLog };
  }

  listAppSessions() {
    return this.prisma.appSession.findMany({
      orderBy: { lastSeenAt: 'desc' },
      take: ADMIN_APP_SESSION_LIST_LIMIT,
      select: adminAppSessionListSelect,
    });
  }

  listProviders(options: { compact?: boolean } = {}) {
    const compact = options.compact ?? false;
    const bookingListSelect = {
      id: true,
      preferredProviderId: true,
      selectedProviderId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
      closedAt: true,
      closedByRole: true,
      closedReason: true,
      chatRoom: { select: { id: true } },
    } satisfies Prisma.BookingSelect;

    return this.prisma.providerProfile.findMany({
      orderBy: { id: 'desc' },
      ...(compact ? { take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT } : {}),
      include: {
        user: {
          select: {
            ...adminUserSummarySelect,
            pushDevices: {
              orderBy: { createdAt: 'desc' },
              take: compact ? 2 : undefined,
              select: adminPushDeviceSummarySelect,
            },
            fileAssets: {
              where: {
                purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
                visibility: FileVisibility.PUBLIC,
                uploadStatus: FileUploadStatus.UPLOADED,
              },
              orderBy: { createdAt: 'desc' },
              take: compact ? 2 : 8,
              ...(compact ? { select: adminProviderPublicMediaSelect } : {}),
            },
          },
        },
        verification: compact
          ? { select: adminProviderVerificationSummarySelect }
          : { include: { files: true } },
        kyc: compact ? { select: adminProviderKycSummarySelect } : true,
        documents: {
          orderBy: { createdAt: 'desc' },
          take: compact ? 6 : undefined,
          ...(compact
            ? { select: adminProviderDocumentSummarySelect }
            : { include: { fileAsset: true } }),
        },
        bankAccounts: {
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
          ...(compact ? { select: adminProviderBankAccountSummarySelect } : {}),
        },
        taxProfile: compact ? { select: adminProviderTaxProfileSummarySelect } : true,
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          ...(compact ? { select: adminProviderReportSummarySelect } : {}),
        },
        sanctions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          ...(compact ? { select: adminProviderSanctionSummarySelect } : {}),
        },
        preferredBookings: {
          orderBy: { createdAt: 'desc' },
          take: compact ? ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT : 50,
          ...(compact
            ? { select: bookingListSelect }
            : {
                include: {
                  services: { include: { service: true } },
                  payment: true,
                },
              }),
        },
        selectedBookings: {
          orderBy: { createdAt: 'desc' },
          take: compact ? ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT : 100,
          ...(compact
            ? { select: bookingListSelect }
            : {
                include: {
                  services: { include: { service: true } },
                  payment: true,
                  review: true,
                },
              }),
        },
        participants: {
          orderBy: { joinedAt: 'desc' },
          take: compact ? ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT : 100,
          ...(compact
            ? {
                select: {
                  id: true,
                  status: true,
                  distanceMeters: true,
                  providerStatusAtJoin: true,
                  joinedAt: true,
                  respondedAt: true,
                  booking: { select: bookingListSelect },
                },
              }
            : {
                include: {
                  booking: {
                    include: {
                      services: { include: { service: true } },
                      payment: true,
                    },
                  },
                },
              }),
        },
        agreements: {
          orderBy: { acceptedAt: 'desc' },
          ...(compact ? { select: adminProviderAgreementSummarySelect } : {}),
        },
        services: {
          ...(compact
            ? { select: adminProviderServiceSummarySelect }
            : {
                include: {
                  service: {
                    include: {
                      payoutRules: {
                        where: { active: true },
                        orderBy: { customerPrice: 'asc' },
                      },
                    },
                  },
                },
              }),
        },
        earnings: {
          where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] } },
          orderBy: { createdAt: 'desc' },
          take: compact ? ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT : 50,
          ...(compact
            ? {
                select: {
                  id: true,
                  providerProfileId: true,
                  bookingId: true,
                  grossAmount: true,
                  platformFee: true,
                  withholdingAmount: true,
                  netAmount: true,
                  currency: true,
                  status: true,
                  availableAt: true,
                  paidAt: true,
                  payoutBatchId: true,
                  settlementRef: true,
                  settlementNotes: true,
                  settlementMethod: true,
                  createdAt: true,
                  booking: { select: { id: true, status: true, scheduledStartAt: true } },
                },
              }
            : {
                include: {
                  booking: { include: { payment: true, services: { include: { service: true } } } },
                },
              }),
        },
        sessions: {
          orderBy: { lastSeenAt: 'desc' },
          take: compact ? 3 : 10,
          ...(compact ? { select: adminProviderSessionSummarySelect } : {}),
        },
        devices: {
          orderBy: { lastSeenAt: 'desc' },
          take: compact ? 3 : 10,
          ...(compact ? { select: adminProviderDeviceSummarySelect } : {}),
        },
      },
    });
  }

  async getProviderDetail(providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: adminProviderDetailSelect,
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }

    const deviceIds = Array.from(
      new Set(
        [
          ...provider.devices.map((device) => device.deviceId),
          ...provider.sessions.map((session) => session.deviceId),
        ].filter((deviceId): deviceId is string => Boolean(deviceId)),
      ),
    );
    const sharedDeviceMatches = deviceIds.length
      ? await this.prisma.providerDevice.findMany({
          where: {
            deviceId: { in: deviceIds },
            providerProfileId: { not: provider.id },
          },
          orderBy: { lastSeenAt: 'desc' },
          take: 20,
          select: {
            id: true,
            deviceId: true,
            platform: true,
            enabled: true,
            lastSeenAt: true,
            blockedAt: true,
            providerProfile: {
              select: {
                id: true,
                displayName: true,
                user: { select: { phone: true } },
              },
            },
          },
        })
      : [];

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: {
        OR: [
          { target: `provider:${providerProfileId}` },
          { metadata: { path: ['providerProfileId'], equals: providerProfileId } },
          { metadata: { path: ['partnerProfileId'], equals: providerProfileId } },
          { metadata: { path: ['providerId'], equals: providerProfileId } },
          { metadata: { path: ['preferredProviderId'], equals: providerProfileId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 75,
      select: adminAuditLogSelect,
    });

    return { ...provider, sharedDeviceMatches, auditLogs };
  }

  async addProviderOpsNote(
    actorId: string,
    providerProfileId: string,
    input: { note?: string; preset?: string },
  ) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Partner operation note is required');
    }

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: {
        id: true,
        userId: true,
        displayName: true,
        legalName: true,
        status: true,
        user: { select: { phone: true, fullName: true } },
      },
    });
    if (!provider) {
      throw new NotFoundException('Partner not found');
    }

    const auditLog = await this.writeAudit(
      actorId,
      'provider.ops_note.add',
      `provider:${providerProfileId}`,
      {
        providerProfileId,
        providerUserId: provider.userId,
        providerPhone: provider.user.phone,
        providerName: provider.displayName ?? provider.legalName ?? provider.user.fullName,
        status: provider.status,
        note: content,
        preset,
      },
    );

    return { ok: true, auditLog };
  }

  async enablePushDevice(actorId: string, pushDeviceId: string) {
    const device = await this.prisma.pushDevice.update({
      where: { id: pushDeviceId },
      data: { enabled: true },
    });

    await this.writeAudit(actorId, 'push_device.enable', `push_device:${pushDeviceId}`, {
      pushDeviceId,
      userId: device.userId,
      platform: device.platform,
    });

    return { ok: true, pushDeviceId: device.id };
  }

  async blockProviderDevice(actorId: string, providerDeviceId: string, reason?: string) {
    const blockReason = normalizeNullable(reason);
    if (!blockReason) {
      throw new BadRequestException('Block reason is required');
    }

    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: false,
        blockedAt: new Date(),
        blockReason,
      },
    });

    await this.writeAudit(actorId, 'provider_device.block', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
      reason: blockReason,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async unblockProviderDevice(actorId: string, providerDeviceId: string) {
    const device = await this.prisma.providerDevice.update({
      where: { id: providerDeviceId },
      data: {
        enabled: true,
        blockedAt: null,
        blockReason: null,
      },
    });

    await this.writeAudit(actorId, 'provider_device.unblock', `provider_device:${providerDeviceId}`, {
      providerProfileId: device.providerProfileId,
      deviceId: device.deviceId,
    });

    return { ok: true, providerDeviceId: device.id };
  }

  async blockProviderAccount(actorId: string, providerProfileId: string, reason?: string) {
    const blockReason = normalizeNullable(reason);
    if (!blockReason) {
      throw new BadRequestException('Block reason is required');
    }

    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        status: ProviderStatus.OFFLINE,
        blockedAt: new Date(),
        blockedReason: blockReason,
      },
      select: { id: true, userId: true, status: true, blockedAt: true, blockedReason: true },
    });
    await this.redisState.setProviderStatus(provider.id, ProviderStatus.OFFLINE);

    await this.writeAudit(actorId, 'provider_account.block', `provider:${providerProfileId}`, {
      providerProfileId,
      reason: blockReason,
    });

    await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
        reason: blockReason,
        issuedById: actorId,
        metadata: toJson({ source: 'admin_account_block' }),
      },
    });

    await this.notifications.create({
      userId: provider.userId,
      type: 'provider.account.blocked',
      title: 'Partner account blocked',
      body: blockReason,
      data: { providerProfileId, reason: blockReason },
    });

    return { ok: true, providerProfileId: provider.id, blockedAt: provider.blockedAt };
  }

  async unblockProviderAccount(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        blockedAt: null,
        blockedReason: null,
      },
      select: { id: true, userId: true },
    });

    await this.writeAudit(actorId, 'provider_account.unblock', `provider:${providerProfileId}`, {
      providerProfileId,
    });

    await this.prisma.providerSanction.updateMany({
      where: {
        providerProfileId,
        type: ProviderSanctionType.ACCOUNT_BLOCK,
        status: ProviderSanctionStatus.ACTIVE,
      },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
    });

    await this.notifications.create({
      userId: provider.userId,
      type: 'provider.account.unblocked',
      title: 'Partner account unblocked',
      body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
      data: { providerProfileId },
    });

    return { ok: true, providerProfileId: provider.id };
  }

  listProviderReports() {
    return this.prisma.providerReport.findMany({
      orderBy: [{ status: 'asc' }, { severity: 'desc' }, { createdAt: 'desc' }],
      take: 250,
      select: adminProviderReportListSelect,
    });
  }

  async createProviderReport(
    actorId: string,
    input: {
      providerProfileId?: string;
      bookingId?: string | null;
      source?: ProviderReportSource;
      severity?: ProviderReportSeverity;
      category?: string;
      summary?: string;
      details?: string | null;
    },
  ) {
    const providerProfileId = normalizeNullable(input.providerProfileId);
    const category = normalizeNullable(input.category);
    const summary = normalizeNullable(input.summary);
    if (!providerProfileId) throw new BadRequestException('providerProfileId is required');
    if (!category) throw new BadRequestException('Report category is required');
    if (!summary) throw new BadRequestException('Report summary is required');
    if (input.source && !Object.values(ProviderReportSource).includes(input.source)) {
      throw new BadRequestException('Invalid report source');
    }
    if (input.severity && !Object.values(ProviderReportSeverity).includes(input.severity)) {
      throw new BadRequestException('Invalid report severity');
    }

    const report = await this.prisma.providerReport.create({
      data: {
        providerProfileId,
        bookingId: normalizeNullable(input.bookingId),
        source: input.source ?? ProviderReportSource.ADMIN,
        severity: input.severity ?? ProviderReportSeverity.MEDIUM,
        category,
        summary,
        details: normalizeNullable(input.details),
        reporterUserId: actorId,
        assignedAdminId: actorId,
      },
      select: adminProviderReportListSelect,
    });

    await this.writeAudit(actorId, 'provider_report.create', `provider_report:${report.id}`, {
      providerProfileId,
      category,
      severity: report.severity,
    });
    return report;
  }

  async updateProviderReport(
    actorId: string,
    reportId: string,
    input: {
      status?: ProviderReportStatus;
      severity?: ProviderReportSeverity;
      resolutionNote?: string | null;
    },
  ) {
    if (input.status && !Object.values(ProviderReportStatus).includes(input.status)) {
      throw new BadRequestException('Invalid report status');
    }
    if (input.severity && !Object.values(ProviderReportSeverity).includes(input.severity)) {
      throw new BadRequestException('Invalid report severity');
    }
    const report = await this.prisma.providerReport.update({
      where: { id: reportId },
      data: {
        status: input.status,
        severity: input.severity,
        resolutionNote: normalizeNullable(input.resolutionNote),
        resolvedAt:
          input.status === ProviderReportStatus.RESOLVED || input.status === ProviderReportStatus.DISMISSED
            ? new Date()
            : input.status === ProviderReportStatus.OPEN ||
                input.status === ProviderReportStatus.INVESTIGATING
              ? null
              : undefined,
      },
    });

    await this.writeAudit(actorId, 'provider_report.update', `provider_report:${reportId}`, {
      status: input.status,
      severity: input.severity,
      resolutionNote: normalizeNullable(input.resolutionNote),
    });
    return report;
  }

  listProviderSanctions() {
    return this.prisma.providerSanction.findMany({
      orderBy: [{ status: 'asc' }, { startsAt: 'desc' }],
      take: 100,
      select: adminProviderSanctionListSelect,
    });
  }

  async createProviderSanction(
    actorId: string,
    providerProfileId: string,
    input: {
      type?: ProviderSanctionType;
      reason?: string;
      reportId?: string | null;
      expiresAt?: string | null;
    },
  ) {
    const reason = normalizeNullable(input.reason);
    if (!reason) throw new BadRequestException('Sanction reason is required');
    if (input.type && !Object.values(ProviderSanctionType).includes(input.type)) {
      throw new BadRequestException('Invalid sanction type');
    }
    const type = input.type ?? ProviderSanctionType.WARNING;
    if (type === ProviderSanctionType.ACCOUNT_BLOCK) {
      await this.blockProviderAccount(actorId, providerProfileId, reason);
      const accountBlock = await this.prisma.providerSanction.findFirstOrThrow({
        where: {
          providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
          reason,
        },
        orderBy: { createdAt: 'desc' },
      });
      const updated = normalizeNullable(input.reportId)
        ? await this.prisma.providerSanction.update({
            where: { id: accountBlock.id },
            data: { reportId: normalizeNullable(input.reportId) },
          })
        : accountBlock;
      await this.writeAudit(actorId, 'provider_sanction.create', `provider_sanction:${updated.id}`, {
        providerProfileId,
        reportId: normalizeNullable(input.reportId),
        type,
      });
      return updated;
    }

    const sanction = await this.prisma.providerSanction.create({
      data: {
        providerProfileId,
        reportId: normalizeNullable(input.reportId),
        type,
        reason,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        issuedById: actorId,
      },
    });

    await this.writeAudit(actorId, 'provider_sanction.create', `provider_sanction:${sanction.id}`, {
      providerProfileId,
      reportId: normalizeNullable(input.reportId),
      type,
    });
    return sanction;
  }

  async liftProviderSanction(actorId: string, sanctionId: string) {
    const sanction = await this.prisma.providerSanction.update({
      where: { id: sanctionId },
      data: {
        status: ProviderSanctionStatus.LIFTED,
        liftedAt: new Date(),
        liftedById: actorId,
      },
    });

    if (sanction.type === ProviderSanctionType.ACCOUNT_BLOCK) {
      const remainingAccountBlocks = await this.prisma.providerSanction.count({
        where: {
          providerProfileId: sanction.providerProfileId,
          type: ProviderSanctionType.ACCOUNT_BLOCK,
          status: ProviderSanctionStatus.ACTIVE,
        },
      });

      if (remainingAccountBlocks === 0) {
        const provider = await this.prisma.providerProfile.update({
          where: { id: sanction.providerProfileId },
          data: {
            blockedAt: null,
            blockedReason: null,
          },
          select: { id: true, userId: true },
        });

        await this.notifications.create({
          userId: provider.userId,
          type: 'provider.account.unblocked',
          title: 'Partner account unblocked',
          body: 'Your HANDS partner account can sign in again. Go online only when ready to receive requests.',
          data: { providerProfileId: provider.id, sanctionId },
        });
      }
    }

    await this.writeAudit(actorId, 'provider_sanction.lift', `provider_sanction:${sanctionId}`, {
      providerProfileId: sanction.providerProfileId,
      type: sanction.type,
    });
    return sanction;
  }

  async reviewProvider(
    actorId: string,
    providerProfileId: string,
    status: VerificationStatus,
    reason?: string,
  ) {
    const verification = await this.prisma.providerVerification.upsert({
      where: { providerProfileId },
      update: {
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        reviewedAt: new Date(),
      },
      create: {
        providerProfileId,
        status,
        rejectionReason: status === VerificationStatus.REJECTED ? reason : null,
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });

    await this.writeAudit(actorId, `provider.${status.toLowerCase()}`, `provider:${providerProfileId}`, {
      reason,
    });

    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: { userId: true },
    });
    let supabaseRoleSync = null;
    if (provider) {
      await this.notifications.create({
        userId: provider.userId,
        type: `provider.verification.${status.toLowerCase()}`,
        title:
          status === VerificationStatus.APPROVED ? 'Verification approved' : 'Verification needs updates',
        body:
          status === VerificationStatus.APPROVED
            ? 'You can now receive matching jobs.'
            : (reason ?? 'Please update your documents.'),
        data: { providerProfileId, status, reason },
      });

      if (status === VerificationStatus.APPROVED) {
        supabaseRoleSync = await this.syncProviderSupabaseRole(actorId, providerProfileId);
      }
    }

    return { ...verification, supabaseRoleSync };
  }

  async syncProviderSupabaseRole(actorId: string, providerProfileId: string) {
    const provider = await this.prisma.providerProfile.findUniqueOrThrow({
      where: { id: providerProfileId },
      select: {
        id: true,
        userId: true,
        user: { select: adminUserAuthSelect },
        verification: { select: { status: true } },
      },
    });

    if (provider.verification?.status !== VerificationStatus.APPROVED) {
      const result = {
        status: 'SKIPPED' as const,
        configured: false,
        supabaseUserId: provider.user.supabaseUserId,
        reason: 'Partner must be approved before Supabase provider role sync.',
      };
      await this.writeAudit(actorId, 'provider.supabase_role_sync.skipped', `provider:${providerProfileId}`, {
        result,
      });
      return result;
    }

    const result = await this.supabaseAdmin.grantProviderRole(provider.user.supabaseUserId);
    await this.writeAudit(
      actorId,
      `provider.supabase_role_sync.${result.status.toLowerCase()}`,
      `provider:${providerProfileId}`,
      {
        result,
        userId: provider.userId,
      },
    );
    return result;
  }

  async reviewPublicProviderMedia(
    actorId: string,
    fileId: string,
    status: FileReviewStatus,
    reason?: string,
  ) {
    const file = await this.prisma.fileAsset.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        purpose: true,
        visibility: true,
        uploadStatus: true,
        ownerUserId: true,
        owner: { select: { providerProfile: { select: { id: true } } } },
      },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    if (
      file.visibility !== FileVisibility.PUBLIC ||
      (file.purpose !== FilePurpose.PROFILE_IMAGE && file.purpose !== FilePurpose.PROVIDER_GALLERY)
    ) {
      throw new BadRequestException('Only public provider media can be reviewed here');
    }
    if (file.uploadStatus !== FileUploadStatus.UPLOADED) {
      throw new BadRequestException('Only completed uploads can be reviewed');
    }
    const normalizedReason = status === FileReviewStatus.REJECTED ? normalizeNullable(reason) : null;
    if (status === FileReviewStatus.REJECTED && !normalizedReason) {
      throw new BadRequestException('Rejection reason is required');
    }

    const updated = await this.prisma.fileAsset.update({
      where: { id: fileId },
      data: {
        reviewStatus: status,
        reviewedAt: new Date(),
        reviewedById: actorId,
        reviewReason: normalizedReason,
      },
    });
    await this.writeAudit(actorId, `provider_media.${status.toLowerCase()}`, `file:${fileId}`, {
      fileId,
      purpose: file.purpose,
      ownerUserId: file.ownerUserId,
      providerProfileId: file.owner?.providerProfile?.id,
      reason: normalizedReason,
    });
    if (file.ownerUserId) {
      await this.notifications.create({
        userId: file.ownerUserId,
        type: `provider.media.${status.toLowerCase()}`,
        title:
          status === FileReviewStatus.APPROVED ? 'Profile media approved' : 'Profile media needs changes',
        body:
          status === FileReviewStatus.APPROVED
            ? 'Your public profile media is now visible to customers.'
            : (normalizedReason ?? 'Please upload a clearer public profile photo.'),
        data: { fileId, purpose: file.purpose, status, reason: normalizedReason },
      });
    }
    return { ok: true, file: updated };
  }

  listBookings() {
    return this.prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminBookingListSelect,
    });
  }

  listChatArchive() {
    return this.prisma.booking.findMany({
      where: {
        chatRoom: { isNot: null },
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        id: true,
        customerProfileId: true,
        preferredProviderId: true,
        selectedProviderId: true,
        status: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        createdAt: true,
        updatedAt: true,
        customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
        preferredProvider: { select: adminProviderSummarySelect },
        selectedProvider: { select: adminProviderSummarySelect },
        participants: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            providerProfileId: true,
            status: true,
            joinedAt: true,
            respondedAt: true,
            providerProfile: { select: adminProviderSummarySelect },
          },
        },
        services: { select: adminBookingServiceSummarySelect },
        payment: { select: adminPaymentSummarySelect },
        review: true,
        chatRoom: {
          select: {
            id: true,
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 200,
              select: {
                id: true,
                body: true,
                createdAt: true,
                sender: { select: { id: true, phone: true, fullName: true, roles: true } },
              },
            },
          },
        },
      },
    });
  }

  async getBookingDetail(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: adminBookingDetailSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: {
        OR: [
          { target: `booking:${id}` },
          { metadata: { path: ['bookingId'], equals: id } },
          {
            action: 'operational_policy.update',
            createdAt: { gte: booking.createdAt },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminAuditLogSelect,
    });

    return { ...booking, auditLogs };
  }

  async addBookingOpsNote(actorId: string, bookingId: string, input: { note?: string; preset?: string }) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Operation note is required');
    }

    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { id: true, notes: true, status: true },
    });
    const entry = `[${new Date().toISOString()}] ${content}`;
    const notes = booking.notes?.trim() ? `${booking.notes.trim()}\n${entry}` : entry;
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { notes },
    });

    await this.writeAudit(actorId, 'booking.ops_note.add', `booking:${bookingId}`, {
      bookingId,
      status: booking.status,
      note: content,
      preset,
    });

    return updated;
  }

  async repairBookingChatRoom(actorId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        selectedProviderId: true,
        chatRoom: { select: { id: true } },
      },
    });

    if (!booking.selectedProviderId) {
      throw new BadRequestException('Final partner selection is required before repairing chat room');
    }

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { chatRoom: { upsert: { create: {}, update: {} } } },
      select: adminBookingDetailSelect,
    });

    await this.writeAudit(actorId, 'booking.chat_room.repair', `booking:${bookingId}`, {
      bookingId,
      status: booking.status,
      selectedProviderId: booking.selectedProviderId,
      previousChatRoomId: booking.chatRoom?.id ?? null,
      repairedChatRoomId: updated.chatRoom?.id ?? null,
    });

    return updated;
  }

  async markBookingNoShow(actorId: string, bookingId: string, input: { reason?: string }) {
    const reason = normalizeNullable(input.reason);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        payment: { select: { id: true, status: true } },
      },
    });

    const noShowEligibleStatuses: BookingStatus[] = [
      BookingStatus.OPEN_MATCHING,
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
    ];
    if (!noShowEligibleStatuses.includes(booking.status)) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be marked as no-show`);
    }

    const noShowPolicy = await this.readOperationalPolicyValue(
      NO_SHOW_PARTNER_REPORT_POLICY_KEY,
      NO_SHOW_ADMIN_REVIEW_REQUIRED,
    );
    const policyNote =
      noShowPolicy === NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW
        ? 'Policy: evidence-assisted admin review is active; verify evidence trail before payment closeout.'
        : 'Policy: admin review required before any payment or closeout decision.';
    const entry = `[${new Date().toISOString()}] No-show marked by operations${
      reason ? `: ${reason}. ` : '. '
    }${policyNote}`;
    const notes = booking.notes?.trim() ? `${booking.notes.trim()}\n${entry}` : entry;
    const paymentReviewNote =
      reason ??
      (noShowPolicy === NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW
        ? 'No-show marked; evidence-assisted admin review active, verify evidence before closeout.'
        : 'No-show requires payment and customer communication review.');

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.NO_SHOW,
        closedAt: new Date(),
        closedByRole: Role.ADMIN,
        closedReason: 'admin_no_show',
        closedNote: paymentReviewNote,
        notes,
        opsTasks: {
          upsert: {
            where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
            update: {
              status: BookingOpsTaskStatus.BLOCKED,
              note: paymentReviewNote,
              actorId,
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: BookingOpsTaskStatus.BLOCKED,
              note: paymentReviewNote,
              actorId,
            },
          },
        },
      },
      select: adminBookingDetailSelect,
    });

    await this.writeAudit(actorId, 'booking.no_show.mark', `booking:${bookingId}`, {
      bookingId,
      previousStatus: booking.status,
      paymentStatus: booking.payment?.status,
      reason,
      noShowPolicy,
    });

    await this.notifications.create({
      userId: updated.customerProfile.userId,
      type: 'booking.no_show',
      title: 'No-show under review',
      body: 'HANDS operations marked this booking as no-show. Payment and support review is pending.',
      data: { bookingId, reason, noShowPolicy },
    });

    const partnerUserIds = new Set<string>();
    if (updated.selectedProvider?.userId) {
      partnerUserIds.add(updated.selectedProvider.userId);
    }
    if (updated.preferredProvider?.userId) {
      partnerUserIds.add(updated.preferredProvider.userId);
    }
    for (const participant of updated.participants) {
      if (participant.providerProfile.userId) {
        partnerUserIds.add(participant.providerProfile.userId);
      }
    }

    await Promise.all(
      [...partnerUserIds].map((userId) =>
        this.notifications.create({
          userId,
          type: 'booking.no_show',
          title: 'Booking marked no-show',
          body: 'HANDS operations marked this booking as no-show. Check the booking note before fee or payout follow-up.',
          data: { bookingId, reason, noShowPolicy },
        }),
      ),
    );

    return updated;
  }

  async expireBooking(actorId: string, bookingId: string, input: { reason?: string }) {
    const reason = normalizeNullable(input.reason);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (booking.status !== BookingStatus.OPEN_MATCHING) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be expired`);
    }

    const entry = `[${new Date().toISOString()}] Matching expired by operations${
      reason ? `: ${reason}` : '.'
    }`;
    const notes = booking.notes?.trim() ? `${booking.notes.trim()}\n${entry}` : entry;
    const terminalPaymentStatuses: PaymentStatus[] = [
      PaymentStatus.CAPTURED,
      PaymentStatus.REFUNDED,
      PaymentStatus.RELEASED,
    ];

    const updated = await this.prisma.$transaction(async (tx) => {
      if (booking.payment && !terminalPaymentStatuses.includes(booking.payment.status)) {
        await tx.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.RELEASED },
        });
      }

      return tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.EXPIRED,
          expiresAt: new Date(),
          closedAt: new Date(),
          closedByRole: Role.ADMIN,
          closedReason: 'admin_expired',
          closedNote: reason ?? 'Matching expired; customer communication should be confirmed.',
          notes,
          opsTasks: {
            upsert: {
              where: { bookingId_type: { bookingId, type: BookingOpsTaskType.CUSTOMER_CONTACTED } },
              update: {
                status: BookingOpsTaskStatus.PENDING,
                note: reason ?? 'Matching expired; customer communication should be confirmed.',
                actorId,
              },
              create: {
                type: BookingOpsTaskType.CUSTOMER_CONTACTED,
                status: BookingOpsTaskStatus.PENDING,
                note: reason ?? 'Matching expired; customer communication should be confirmed.',
                actorId,
              },
            },
          },
        },
        select: adminBookingDetailSelect,
      });
    });

    await this.redisState.closeMatching(bookingId);
    await this.writeAudit(actorId, 'booking.expire.manual', `booking:${bookingId}`, {
      bookingId,
      previousStatus: booking.status,
      paymentId: booking.payment?.id,
      paymentReleased: Boolean(booking.payment && !terminalPaymentStatuses.includes(booking.payment.status)),
      reason,
    });

    return updated;
  }

  async closeoutCompletedBooking(actorId: string, bookingId: string, input: { note?: string }) {
    const note = normalizeNullable(input.note);
    const booking = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: {
        id: true,
        status: true,
        notes: true,
        selectedProviderId: true,
        payment: { select: { id: true, status: true } },
      },
    });

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException(`Booking status ${booking.status} cannot be closed out as completed`);
    }
    if (!booking.selectedProviderId) {
      throw new BadRequestException('Completed booking requires a selected partner before closeout');
    }

    const capturedPayment =
      booking.payment && booking.payment.status !== PaymentStatus.CAPTURED
        ? await this.prisma.payment.update({
            where: { id: booking.payment.id },
            data: { status: PaymentStatus.CAPTURED },
          })
        : booking.payment;

    const earning = await this.earnings.createForCompletedBooking(bookingId, booking.selectedProviderId);
    const entry = `[${new Date().toISOString()}] Completed booking closeout reconciled by operations${
      note ? `: ${note}` : '.'
    }`;
    const notes = booking.notes?.trim() ? `${booking.notes.trim()}\n${entry}` : entry;

    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        notes,
        opsTasks: {
          upsert: {
            where: { bookingId_type: { bookingId, type: BookingOpsTaskType.PAYMENT_REVIEWED } },
            update: {
              status: BookingOpsTaskStatus.DONE,
              note: note ?? 'Payment, earning, tax, and wallet closeout reconciled.',
              actorId,
            },
            create: {
              type: BookingOpsTaskType.PAYMENT_REVIEWED,
              status: BookingOpsTaskStatus.DONE,
              note: note ?? 'Payment, earning, tax, and wallet closeout reconciled.',
              actorId,
            },
          },
        },
      },
      select: adminBookingDetailSelect,
    });

    await this.writeAudit(actorId, 'booking.completed.closeout', `booking:${bookingId}`, {
      bookingId,
      paymentId: capturedPayment?.id,
      paymentStatus: capturedPayment?.status,
      earningId: earning.id,
      netAmount: earning.netAmount,
      note,
    });

    return updated;
  }

  async updateBookingOpsTask(
    actorId: string,
    bookingId: string,
    input: { type: BookingOpsTaskType; status: BookingOpsTaskStatus; note?: string },
  ) {
    if (!Object.values(BookingOpsTaskType).includes(input.type)) {
      throw new BadRequestException('Invalid operation task type');
    }
    if (!Object.values(BookingOpsTaskStatus).includes(input.status)) {
      throw new BadRequestException('Invalid operation task status');
    }

    const note = normalizeNullable(input.note);
    const task = await this.prisma.bookingOpsTask.upsert({
      where: { bookingId_type: { bookingId, type: input.type } },
      update: {
        status: input.status,
        note,
        actorId,
      },
      create: {
        bookingId,
        type: input.type,
        status: input.status,
        note,
        actorId,
      },
      include: { actor: { select: { phone: true, fullName: true } } },
    });

    await this.writeAudit(actorId, 'booking.ops_task.update', `booking:${bookingId}`, {
      bookingId,
      type: input.type,
      status: input.status,
      note,
    });

    return task;
  }

  listPayments() {
    return this.prisma.payment.findMany({
      orderBy: { id: 'desc' },
      take: 100,
      select: {
        ...adminPaymentSummarySelect,
        booking: {
          select: {
            id: true,
            status: true,
            createdAt: true,
            customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
            selectedProvider: {
              select: {
                id: true,
                displayName: true,
                user: { select: adminUserSummarySelect },
              },
            },
            earning: { select: adminEarningSummarySelect },
          },
        },
        callbackAttempts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: adminPaymentCallbackAttemptSummarySelect,
        },
      },
    });
  }

  async getPaymentDetail(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: adminPaymentDetailSelect,
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const callbackAttempts = await this.prisma.paymentCallbackAttempt.findMany({
      where: {
        OR: [
          { paymentId: payment.id },
          ...(payment.providerRef ? [{ providerRef: payment.providerRef }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: adminPaymentCallbackAttemptSummarySelect,
    });

    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: {
        OR: [
          { target: `payment:${payment.id}` },
          { target: `booking:${payment.bookingId}` },
          { metadata: { path: ['paymentId'], equals: payment.id } },
          { metadata: { path: ['bookingId'], equals: payment.bookingId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 75,
      select: adminAuditLogSelect,
    });

    return { ...payment, callbackAttempts, auditLogs };
  }

  listPaymentCallbackAttempts() {
    return this.prisma.paymentCallbackAttempt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminPaymentCallbackAttemptListSelect,
    });
  }

  listRefunds() {
    return this.prisma.refund.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminRefundListSelect,
    });
  }

  listEarnings() {
    return this.earnings.listForAdmin();
  }

  listCashSettlementEarnings() {
    return this.earnings.listCashSettlementDebtForAdmin();
  }

  cashSettlementSummary() {
    return this.earnings.cashSettlementSummaryForAdmin();
  }

  earningsSummary() {
    return this.earnings.adminSummary();
  }

  listServices() {
    return this.prisma.massageService.findMany({
      orderBy: [{ displayOrder: 'asc' }, { serviceGroupKey: 'asc' }, { durationMin: 'asc' }],
      select: adminServiceCatalogSelect,
    });
  }

  async listServiceGroups() {
    return groupServiceCatalogOptions(await this.listServices());
  }

  async createService(
    actorId: string,
    input: {
      serviceGroupKey?: string;
      name?: string;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const data = normalizeServiceInput(input, true) as Prisma.MassageServiceUncheckedCreateInput;
    return this.prisma.$transaction(async (tx) => {
      await ensureServiceDurationIsUnique(tx, {
        serviceGroupKey: data.serviceGroupKey as string,
        durationMin: data.durationMin as number,
      });
      const service = await tx.massageService.create({
        data,
        select: adminServiceMutationSelect,
      });
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.create',
          target: `service:${service.id}`,
          metadata: toJson(data),
        },
      });
      return service;
    });
  }

  async createServiceDurationSet(
    actorId: string,
    input: {
      serviceGroupKey?: string;
      name?: string;
      description?: string | null;
      priceStep?: number;
      displayOrder?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      durations?: Array<{
        durationMin?: number;
        basePrice?: number;
        providerPayoutAmount?: number | null;
      }>;
    },
  ) {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('Service name is required');
    }
    const groupKey = normalizeNullable(input.serviceGroupKey) ?? slugify(name);
    const priceStep = input.priceStep ?? PRICE_STEP_UNIT_VND;
    const displayOrder = input.displayOrder ?? 100;
    const durationRows = (input.durations ?? []).filter((row) => row.basePrice !== undefined);
    if (durationRows.length === 0) {
      throw new BadRequestException('At least one duration price is required');
    }
    const durationSet = new Set<number>();
    for (const row of durationRows) {
      if (row.durationMin === undefined || durationSet.has(row.durationMin)) {
        throw new BadRequestException('Duration options must be unique and explicit');
      }
      durationSet.add(row.durationMin);
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.massageService.findMany({
        where: { serviceGroupKey: groupKey, durationMin: { in: [...durationSet] } },
        select: { id: true, durationMin: true },
      });
      if (existing.length > 0) {
        throw new BadRequestException(
          `Service duration already exists for ${groupKey}: ${existing
            .map((service) => `${service.durationMin} min`)
            .join(', ')}`,
        );
      }

      const created: string[] = [];
      for (const row of durationRows) {
        const serviceData = normalizeServiceInput(
          {
            serviceGroupKey: groupKey,
            name,
            description: input.description,
            durationMin: row.durationMin,
            basePrice: row.basePrice,
            priceStep,
            displayOrder: displayOrder + (row.durationMin ?? 0),
            active: input.active ?? true,
          },
          true,
        ) as Prisma.MassageServiceUncheckedCreateInput;
        const service = await tx.massageService.create({
          data: serviceData,
          select: adminServiceMutationSelect,
        });
        const providerPayoutAmount = row.providerPayoutAmount;
        if (providerPayoutAmount !== undefined && providerPayoutAmount !== null) {
          const payoutRuleData = normalizeServicePayoutRuleInput(
            { basePrice: service.basePrice, priceStep: service.priceStep },
            {
              customerPrice: service.basePrice,
              providerPayoutAmount,
              vatBps: input.vatBps,
              otherCostAmount: input.otherCostAmount,
              active: true,
              notes: 'Base payout rule created with the service duration set.',
            },
            true,
          );
          await tx.servicePayoutRule.create({
            data: { ...payoutRuleData, serviceId: service.id },
          });
        }
        created.push(service.id);
      }

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.duration_set.create',
          target: `service_group:${groupKey}`,
          metadata: toJson({
            groupKey,
            name,
            durationMins: [...durationSet].sort((left, right) => left - right),
            serviceIds: created,
          }),
        },
      });

      return tx.massageService.findMany({
        where: { id: { in: created } },
        orderBy: { durationMin: 'asc' },
        select: adminServiceMutationSelect,
      });
    });
  }

  async updateService(
    actorId: string,
    serviceId: string,
    input: {
      serviceGroupKey?: string | null;
      name?: string;
      description?: string | null;
      durationMin?: number;
      basePrice?: number;
      priceStep?: number;
      displayOrder?: number;
      active?: boolean;
    },
  ) {
    const existing = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const data = normalizeServiceInput(input, false, existing) as Prisma.MassageServiceUncheckedUpdateInput;
    return this.prisma.$transaction(async (tx) => {
      await ensureServiceDurationIsUnique(tx, {
        serviceGroupKey:
          typeof data.serviceGroupKey === 'string'
            ? data.serviceGroupKey
            : (existing.serviceGroupKey ?? slugify(existing.name)),
        durationMin: typeof data.durationMin === 'number' ? data.durationMin : existing.durationMin,
        excludeServiceId: serviceId,
      });
      const service = await tx.massageService.update({
        where: { id: serviceId },
        data,
        select: adminServiceMutationSelect,
      });
      let adjustedProviderPrices = 0;
      const nextBasePrice = typeof data.basePrice === 'number' ? data.basePrice : undefined;
      if (nextBasePrice !== undefined) {
        const adjusted = await tx.providerService.updateMany({
          where: { serviceId, price: { lt: nextBasePrice } },
          data: { price: nextBasePrice },
        });
        adjustedProviderPrices = adjusted.count;
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service.update',
          target: `service:${serviceId}`,
          metadata: toJson({
            before: serviceAuditSnapshot(existing),
            after: serviceAuditSnapshot(service),
            changedFields: changedFields(serviceAuditSnapshot(existing), serviceAuditSnapshot(service)),
            adjustedProviderPrices,
          }),
        },
      });
      return service;
    });
  }

  async upsertServicePayoutRule(
    actorId: string,
    serviceId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const service = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const data = normalizeServicePayoutRuleInput(service, input, true);
    const existingRule = await this.prisma.servicePayoutRule.findUnique({
      where: {
        serviceId_customerPrice: {
          serviceId,
          customerPrice: data.customerPrice,
        },
      },
      select: adminServicePayoutRuleMutationSelect,
    });
    const rule = await this.prisma.servicePayoutRule.upsert({
      where: {
        serviceId_customerPrice: {
          serviceId,
          customerPrice: data.customerPrice,
        },
      },
      update: data,
      create: {
        ...data,
        serviceId,
      },
      select: adminServicePayoutRuleMutationSelect,
    });
    await this.writeAudit(
      actorId,
      'service_payout_rule.upsert',
      `service:${serviceId}`,
      toJson({
        service: serviceAuditSnapshot(service),
        before: existingRule ? servicePayoutRuleAuditSnapshot(existingRule) : null,
        after: servicePayoutRuleAuditSnapshot(rule),
        changedFields: changedFields(
          existingRule ? servicePayoutRuleAuditSnapshot(existingRule) : {},
          servicePayoutRuleAuditSnapshot(rule),
        ),
      }),
    );
    return rule;
  }

  async bulkUpsertServicePayoutRules(
    actorId: string,
    serviceId: string,
    input: {
      rules?: Array<{
        customerPrice?: number;
        providerPayoutAmount?: number;
        vatBps?: number;
        otherCostAmount?: number;
        active?: boolean;
        notes?: string | null;
      }>;
    },
  ) {
    const service = await this.prisma.massageService.findUniqueOrThrow({
      where: { id: serviceId },
      select: adminServiceMutationSelect,
    });
    const rows = input.rules ?? [];
    if (rows.length === 0) {
      throw new BadRequestException('At least one payout rule is required');
    }
    const seenPrices = new Set<number>();
    const data = rows.map((row) => {
      const normalized = normalizeServicePayoutRuleInput(service, row, true);
      if (seenPrices.has(normalized.customerPrice)) {
        throw new BadRequestException(
          `Duplicate customer price in payout rule import: ${normalized.customerPrice}`,
        );
      }
      seenPrices.add(normalized.customerPrice);
      return normalized;
    });

    return this.prisma.$transaction(async (tx) => {
      const existingRules = await tx.servicePayoutRule.findMany({
        where: { serviceId, customerPrice: { in: data.map((row) => row.customerPrice) } },
        select: adminServicePayoutRuleMutationSelect,
      });
      const existingByPrice = new Map(existingRules.map((rule) => [rule.customerPrice, rule]));
      const saved = [];
      for (const row of data) {
        const rule = await tx.servicePayoutRule.upsert({
          where: {
            serviceId_customerPrice: {
              serviceId,
              customerPrice: row.customerPrice,
            },
          },
          update: row,
          create: {
            ...row,
            serviceId,
          },
          select: adminServicePayoutRuleMutationSelect,
        });
        saved.push(rule);
      }
      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'service_payout_rule.bulk_upsert',
          target: `service:${serviceId}`,
          metadata: toJson({
            service: serviceAuditSnapshot(service),
            ruleCount: saved.length,
            customerPrices: saved.map((rule) => rule.customerPrice).sort((left, right) => left - right),
            before: saved.map((rule) => {
              const existingRule = existingByPrice.get(rule.customerPrice);
              return existingRule ? servicePayoutRuleAuditSnapshot(existingRule) : null;
            }),
            after: saved.map(servicePayoutRuleAuditSnapshot),
            changedFieldsByPrice: saved.map((rule) => ({
              customerPrice: rule.customerPrice,
              changedFields: changedFields(
                existingByPrice.get(rule.customerPrice)
                  ? servicePayoutRuleAuditSnapshot(existingByPrice.get(rule.customerPrice)!)
                  : {},
                servicePayoutRuleAuditSnapshot(rule),
              ),
            })),
          }),
        },
      });
      return saved.sort((left, right) => left.customerPrice - right.customerPrice);
    });
  }

  async updateServicePayoutRule(
    actorId: string,
    ruleId: string,
    input: {
      customerPrice?: number;
      providerPayoutAmount?: number;
      vatBps?: number;
      otherCostAmount?: number;
      active?: boolean;
      notes?: string | null;
    },
  ) {
    const existing = await this.prisma.servicePayoutRule.findUniqueOrThrow({
      where: { id: ruleId },
      select: adminServicePayoutRuleWithServiceSelect,
    });
    const data = normalizeServicePayoutRuleInput(existing.service, input, false, existing);
    const rule = await this.prisma.servicePayoutRule.update({
      where: { id: ruleId },
      data,
      select: adminServicePayoutRuleWithServiceSelect,
    });
    await this.writeAudit(
      actorId,
      'service_payout_rule.update',
      `service_payout_rule:${ruleId}`,
      toJson({
        service: serviceAuditSnapshot(existing.service),
        before: servicePayoutRuleAuditSnapshot(existing),
        after: servicePayoutRuleAuditSnapshot(rule),
        changedFields: changedFields(
          servicePayoutRuleAuditSnapshot(existing),
          servicePayoutRuleAuditSnapshot(rule),
        ),
      }),
    );
    return rule;
  }

  async markEarningPaid(
    actorId: string,
    earningId: string,
    input: {
      settlementRef?: string | null;
      settlementNotes?: string | null;
      settlementMethod?: string | null;
    } = {},
  ) {
    const earning = await this.earnings.markPaid(earningId, input);
    await this.writeAudit(
      actorId,
      earning.netAmount < 0 ? 'earning.cash_fee_settled' : 'earning.paid',
      `earning:${earning.id}`,
      {
        bookingId: earning.bookingId,
        providerProfileId: earning.providerProfileId,
        netAmount: earning.netAmount,
        settlementRef: earning.settlementRef,
        settlementMethod: earning.settlementMethod,
      },
    );
    return earning;
  }

  listPayoutBatches() {
    return this.earnings.listPayoutBatchesForAdmin();
  }

  async createPayoutBatch(
    actorId: string,
    input: { providerProfileId: string; transferRef?: string; notes?: string },
  ) {
    const batch = await this.earnings.createProviderPayoutBatch(input);
    await this.writeAudit(actorId, 'payout_batch.create', `payout_batch:${batch.id}`, {
      providerProfileId: batch.providerProfileId,
      totalNetAmount: batch.totalNetAmount,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  async updatePayoutBatch(
    actorId: string,
    payoutBatchId: string,
    input: { status?: PayoutBatchStatus; transferRef?: string | null; notes?: string | null },
  ) {
    const batch = await this.earnings.updatePayoutBatch(payoutBatchId, input);
    await this.writeAudit(actorId, 'payout_batch.update', `payout_batch:${batch.id}`, {
      status: batch.status,
      transferRef: batch.transferRef,
      earningCount: batch.earnings.length,
    });
    return batch;
  }

  listReviews() {
    return this.prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        bookingId: true,
        customerProfileId: true,
        providerProfileId: true,
        rating: true,
        comment: true,
        status: true,
        reportReason: true,
        moderatedAt: true,
        createdAt: true,
        booking: {
          select: {
            id: true,
            services: {
              select: {
                id: true,
                service: {
                  select: {
                    id: true,
                    name: true,
                    durationMin: true,
                  },
                },
              },
            },
          },
        },
        customerProfile: { select: { id: true, user: { select: adminUserSummarySelect } } },
        providerProfile: { select: adminProviderSummarySelect },
      },
    });
  }

  async moderateReview(
    actorId: string,
    reviewId: string,
    input: { status: ReviewStatus; reportReason?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: input.status,
          reportReason: input.reportReason,
          moderatedAt: new Date(),
        },
      });

      const aggregate = await tx.review.aggregate({
        where: { providerProfileId: review.providerProfileId, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await tx.providerProfile.update({
        where: { id: review.providerProfileId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          reviewCount: aggregate._count.rating,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorId,
          action: 'review.moderate',
          target: `review:${review.id}`,
          metadata: toJson({ status: input.status, reportReason: input.reportReason }),
        },
      });

      return review;
    });
  }

  listCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { code: 'asc' },
      take: 100,
    });
  }

  async createCoupon(
    actorId: string,
    input: {
      code: string;
      description?: string;
      discount: unknown;
      active?: boolean;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    const coupon = await this.prisma.coupon.create({
      data: {
        code: input.code.trim().toUpperCase(),
        description: input.description,
        discount: toJson(input.discount),
        active: input.active ?? true,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });

    await this.writeAudit(actorId, 'coupon.create', `coupon:${coupon.id}`, { code: coupon.code });
    return coupon;
  }

  async updateCoupon(
    actorId: string,
    id: string,
    input: {
      description?: string;
      discount?: unknown;
      active?: boolean;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const coupon = await this.prisma.coupon.update({
      where: { id },
      data: {
        description: input.description,
        discount: input.discount === undefined ? undefined : toJson(input.discount),
        active: input.active,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
      },
    });

    await this.writeAudit(actorId, 'coupon.update', `coupon:${coupon.id}`, { active: coupon.active });
    return coupon;
  }

  listAuditLogs() {
    return this.prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminAuditLogSelect,
    });
  }

  async addOperationsHandoffNote(actorId: string, input: { note?: string; preset?: string; owner?: string }) {
    const note = normalizeNullable(input.note);
    const preset = normalizeNullable(input.preset);
    const owner = normalizeNullable(input.owner) ?? 'Shift handoff';
    const content = note ?? preset;
    if (!content) {
      throw new BadRequestException('Operations handoff note is required');
    }

    const auditLog = await this.writeAudit(actorId, 'operations.handoff_note.add', 'operations:handoff', {
      owner,
      note: content,
      preset,
    });

    return { ok: true, auditLog };
  }

  async listOperationalPolicySettings() {
    const savedSettings = await this.prisma.operationalPolicySetting.findMany({
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
    const savedByKey = new Map(savedSettings.map((setting) => [setting.key, setting]));

    return OPERATIONAL_POLICY_DEFINITIONS.map((definition) => {
      const saved = savedByKey.get(definition.key);
      const savedValue =
        saved && this.isOperationalPolicyValueSupported(definition, saved.value)
          ? saved.value
          : definition.value;
      return {
        ...definition,
        value: savedValue,
        recommendedValue: definition.recommendedValue,
        options: definition.options ?? null,
        requiresRestart: definition.requiresRestart ?? false,
        updatedAt: saved?.updatedAt ?? null,
        updatedBy: saved?.updatedBy ?? null,
      };
    });
  }

  async updateOperationalPolicySetting(
    actorId: string,
    key: string,
    input: { value?: unknown; reason?: string },
  ) {
    const definition = OPERATIONAL_POLICY_DEFINITIONS.find((item) => item.key === key);
    if (!definition) {
      throw new NotFoundException('Operational policy setting not found');
    }

    const value = this.validateOperationalPolicyValue(definition, input.value);
    const previous = await this.prisma.operationalPolicySetting.findUnique({ where: { key } });
    const setting = await this.prisma.operationalPolicySetting.upsert({
      where: { key },
      create: {
        key,
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: toJson(value),
        recommendedValue: toJson(definition.recommendedValue),
        options: definition.options ? toJson(definition.options) : undefined,
        requiresRestart: definition.requiresRestart ?? false,
        updatedById: actorId,
      },
      update: {
        category: definition.category,
        label: definition.label,
        description: definition.description,
        value: toJson(value),
        recommendedValue: toJson(definition.recommendedValue),
        options: definition.options ? toJson(definition.options) : Prisma.DbNull,
        requiresRestart: definition.requiresRestart ?? false,
        updatedById: actorId,
      },
      include: { updatedBy: { select: { id: true, phone: true, fullName: true } } },
    });

    await this.writeAudit(actorId, 'operational_policy.update', `operational_policy:${key}`, {
      key,
      previousValue: previous?.value ?? definition.value,
      value,
      reason: normalizeAuditReason(input.reason),
      enforced: definition.enforced,
    });

    return {
      ...definition,
      value: setting.value,
      recommendedValue: setting.recommendedValue ?? definition.recommendedValue,
      options: setting.options ?? definition.options ?? null,
      requiresRestart: setting.requiresRestart,
      updatedAt: setting.updatedAt,
      updatedBy: setting.updatedBy,
    };
  }

  private async readOperationalPolicyValue(key: string, fallback: string) {
    const setting = await this.prisma.operationalPolicySetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return typeof setting?.value === 'string' ? setting.value : fallback;
  }

  private validateOperationalPolicyValue(
    definition: (typeof OPERATIONAL_POLICY_DEFINITIONS)[number],
    value: unknown,
  ) {
    if (typeof definition.value === 'number') {
      const parsed = Number(value);
      const min = definition.min ?? Number.MIN_SAFE_INTEGER;
      const max = definition.max ?? Number.MAX_SAFE_INTEGER;
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new BadRequestException(`${definition.label} must be an integer between ${min} and ${max}`);
      }
      return parsed;
    }

    if (definition.options?.length) {
      const raw = String(value ?? '').trim();
      if (!definition.options.some((option) => option.value === raw)) {
        throw new BadRequestException(`${definition.label} has an unsupported option`);
      }
      return raw;
    }

    if (typeof definition.value === 'boolean') {
      return value === true || value === 'true';
    }

    return String(value ?? '').trim();
  }

  private isOperationalPolicyValueSupported(
    definition: (typeof OPERATIONAL_POLICY_DEFINITIONS)[number],
    value: unknown,
  ) {
    if (typeof definition.value === 'number') {
      const parsed = Number(value);
      const min = definition.min ?? Number.MIN_SAFE_INTEGER;
      const max = definition.max ?? Number.MAX_SAFE_INTEGER;
      return Number.isInteger(parsed) && parsed >= min && parsed <= max;
    }

    if (definition.options?.length) {
      const raw = String(value ?? '').trim();
      return definition.options.some((option) => option.value === raw);
    }

    if (typeof definition.value === 'boolean') {
      return value === true || value === false || value === 'true' || value === 'false';
    }

    return typeof value === 'string';
  }

  listNotifications() {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: adminNotificationListSelect,
    });
  }

  async retryNotification(actorId: string, notificationId: string) {
    const result = await this.notifications.retry(notificationId);
    await this.writeAudit(actorId, 'notification.retry', `notification:${notificationId}`, {
      notificationId,
    });
    return result;
  }

  writeAudit(actorId: string, action: string, target: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.adminAuditLog.create({
      data: {
        actorId,
        action,
        target,
        metadata,
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function serviceAuditSnapshot(
  service: Pick<
    Prisma.MassageServiceGetPayload<object>,
    'id' | 'serviceGroupKey' | 'name' | 'durationMin' | 'basePrice' | 'priceStep' | 'displayOrder' | 'active'
  >,
) {
  return {
    id: service.id,
    serviceGroupKey: service.serviceGroupKey,
    name: service.name,
    durationMin: service.durationMin,
    basePrice: service.basePrice,
    priceStep: service.priceStep,
    displayOrder: service.displayOrder,
    active: service.active,
  };
}

function servicePayoutRuleAuditSnapshot(
  rule: Pick<
    Prisma.ServicePayoutRuleGetPayload<object>,
    | 'id'
    | 'serviceId'
    | 'customerPrice'
    | 'providerPayoutAmount'
    | 'vatBps'
    | 'otherCostAmount'
    | 'currency'
    | 'active'
    | 'notes'
  >,
) {
  return {
    id: rule.id,
    serviceId: rule.serviceId,
    customerPrice: rule.customerPrice,
    providerPayoutAmount: rule.providerPayoutAmount,
    vatBps: rule.vatBps,
    otherCostAmount: rule.otherCostAmount,
    currency: rule.currency,
    active: rule.active,
    notes: rule.notes,
  };
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function normalizeNullable(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeServiceInput(
  input: {
    serviceGroupKey?: string | null;
    name?: string;
    description?: string | null;
    durationMin?: number;
    basePrice?: number;
    priceStep?: number;
    displayOrder?: number;
    active?: boolean;
  },
  creating: boolean,
  existing?: { name: string; basePrice: number; priceStep: number },
): Prisma.MassageServiceUncheckedCreateInput | Prisma.MassageServiceUncheckedUpdateInput {
  const name = input.name?.trim();
  if (creating && !name) {
    throw new BadRequestException('Service name is required');
  }
  const durationMin = input.durationMin;
  if (
    (creating || durationMin !== undefined) &&
    (!Number.isInteger(durationMin) || (durationMin ?? 0) <= 0)
  ) {
    throw new BadRequestException('Service duration must be a positive integer');
  }

  const nextPriceStep = input.priceStep ?? existing?.priceStep ?? 100000;
  if (!Number.isInteger(nextPriceStep) || nextPriceStep <= 0) {
    throw new BadRequestException('Price step must be a positive integer');
  }
  if (nextPriceStep % PRICE_STEP_UNIT_VND !== 0) {
    throw new BadRequestException(`Price step must use ${PRICE_STEP_UNIT_VND} VND increments`);
  }
  const nextBasePrice = input.basePrice ?? existing?.basePrice;
  if (
    (creating || input.basePrice !== undefined) &&
    (!Number.isInteger(nextBasePrice) || (nextBasePrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Base price must be a positive integer');
  }
  if (nextBasePrice !== undefined && nextBasePrice % nextPriceStep !== 0) {
    throw new BadRequestException(`Base price must use ${nextPriceStep} VND increments`);
  }

  const nextName = name ?? existing?.name ?? '';
  const normalizedGroupKey =
    input.serviceGroupKey === undefined
      ? creating
        ? slugify(nextName)
        : undefined
      : (normalizeNullable(input.serviceGroupKey) ?? slugify(nextName));
  return {
    serviceGroupKey: normalizedGroupKey,
    name: name ?? undefined,
    description: input.description === undefined ? undefined : normalizeNullable(input.description),
    durationMin,
    basePrice: input.basePrice,
    priceStep: input.priceStep,
    displayOrder: input.displayOrder,
    active: input.active,
  };
}

async function ensureServiceDurationIsUnique(
  tx: Prisma.TransactionClient,
  input: { serviceGroupKey: string; durationMin: number; excludeServiceId?: string },
) {
  const existing = await tx.massageService.findFirst({
    where: {
      serviceGroupKey: input.serviceGroupKey,
      durationMin: input.durationMin,
      ...(input.excludeServiceId ? { id: { not: input.excludeServiceId } } : {}),
    },
    select: { id: true, name: true, durationMin: true },
  });

  if (existing) {
    throw new BadRequestException(
      `Service duration already exists for ${input.serviceGroupKey}: ${existing.durationMin} min`,
    );
  }
}

function normalizeServicePayoutRuleInput(
  service: { basePrice: number; priceStep: number },
  input: {
    customerPrice?: number;
    providerPayoutAmount?: number;
    vatBps?: number;
    otherCostAmount?: number;
    active?: boolean;
    notes?: string | null;
  },
  creating: boolean,
  existing?: {
    customerPrice: number;
    providerPayoutAmount: number;
    vatBps: number;
    otherCostAmount: number;
    active: boolean;
    notes?: string | null;
  },
) {
  const customerPrice = input.customerPrice ?? existing?.customerPrice;
  if (
    (creating || input.customerPrice !== undefined) &&
    (!Number.isInteger(customerPrice) || (customerPrice ?? 0) <= 0)
  ) {
    throw new BadRequestException('Customer price must be a positive integer');
  }
  if (customerPrice !== undefined && customerPrice < service.basePrice) {
    throw new BadRequestException('Customer price cannot be lower than the admin minimum');
  }
  if (customerPrice !== undefined && customerPrice % service.priceStep !== 0) {
    throw new BadRequestException(`Customer price must use ${service.priceStep} VND increments`);
  }

  const providerPayoutAmount = input.providerPayoutAmount ?? existing?.providerPayoutAmount;
  if (
    (creating || input.providerPayoutAmount !== undefined) &&
    (!Number.isInteger(providerPayoutAmount) || (providerPayoutAmount ?? -1) < 0)
  ) {
    throw new BadRequestException('Partner payout amount must be zero or greater');
  }
  if (
    customerPrice !== undefined &&
    providerPayoutAmount !== undefined &&
    providerPayoutAmount > customerPrice
  ) {
    throw new BadRequestException('Partner payout amount cannot exceed customer price');
  }

  const vatBps = input.vatBps ?? existing?.vatBps ?? 0;
  if (!Number.isInteger(vatBps) || vatBps < 0 || vatBps > 10000) {
    throw new BadRequestException('VAT basis points must be between 0 and 10000');
  }
  const otherCostAmount = input.otherCostAmount ?? existing?.otherCostAmount ?? 0;
  if (!Number.isInteger(otherCostAmount) || otherCostAmount < 0) {
    throw new BadRequestException('Other cost amount must be zero or greater');
  }

  return {
    customerPrice: customerPrice as number,
    providerPayoutAmount: providerPayoutAmount as number,
    vatBps,
    otherCostAmount,
    currency: 'VND',
    active: input.active ?? existing?.active ?? true,
    notes: input.notes === undefined ? existing?.notes : normalizeNullable(input.notes),
  };
}

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || 'service';
}

function normalizeAuditReason(reason?: string) {
  const normalized = reason?.replace(/\s+/g, ' ').trim();
  return normalized ? normalized.slice(0, 500) : 'No reason provided by API caller';
}
