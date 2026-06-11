import { EarningStatus, FilePurpose, FileUploadStatus, FileVisibility, Prisma } from '@prisma/client';
import {
  adminAddressSnapshotSelect,
  adminChatMessageSummarySelect,
  adminCustomerDetailBookingSelect,
} from './admin-booking-selects';
import { adminEarningSummarySelect } from './admin-payment-selects';
import {
  adminProviderAgreementSummarySelect,
  adminProviderBankAccountSummarySelect,
  adminProviderDetailUserSelect,
  adminProviderDeviceSummarySelect,
  adminProviderDocumentSummarySelect,
  adminProviderKycSummarySelect,
  adminProviderOverviewUserSelect,
  adminProviderPublicMediaSelect,
  adminProviderReportDetailSelect,
  adminProviderReportSummarySelect,
  adminProviderSanctionDetailSelect,
  adminProviderSanctionSummarySelect,
  adminProviderSessionSummarySelect,
  adminProviderSummarySelect,
  adminProviderTaxProfileSummarySelect,
  adminProviderVerificationDetailSelect,
  adminProviderVerificationSummarySelect,
} from './admin-provider-selects';
import { adminBookingServiceSummarySelect, adminProviderServiceSummarySelect } from './admin-service-selects';
import { adminPushDeviceSummarySelect, adminUserSummarySelect } from './admin-user-selects';

export const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 500;
export const ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT = 3;

const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 30;
const ADMIN_PROVIDER_DETAIL_DOCUMENT_LIMIT = 50;
const ADMIN_PROVIDER_OVERVIEW_DOCUMENT_LIMIT = 12;
const ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT = 5;
const ADMIN_PROVIDER_OVERVIEW_CHAT_MESSAGE_LIMIT = 8;

export const adminProviderListUserSelect = {
  ...adminUserSummarySelect,
  supabaseUserId: true,
  pushDevices: {
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: adminPushDeviceSummarySelect,
  },
  fileAssets: {
    where: {
      purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
      visibility: FileVisibility.PUBLIC,
      uploadStatus: FileUploadStatus.UPLOADED,
    },
    orderBy: { createdAt: 'desc' },
    take: 2,
    select: adminProviderPublicMediaSelect,
  },
} satisfies Prisma.UserSelect;

export const adminProviderListBookingSelect = {
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
  address: true,
  lat: true,
  lng: true,
  addressSnapshot: { select: adminAddressSnapshotSelect },
  chatRoom: {
    select: {
      id: true,
      createdAt: true,
    },
  },
} satisfies Prisma.BookingSelect;

export const adminProviderListEarningSelect = {
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
} satisfies Prisma.ProviderEarningSelect;

export const adminProviderListParticipantSelect = {
  id: true,
  providerProfileId: true,
  status: true,
  distanceMeters: true,
  providerStatusAtJoin: true,
  joinedAt: true,
  respondedAt: true,
  booking: { select: adminProviderListBookingSelect },
} satisfies Prisma.BookingParticipantSelect;

export const adminProviderListSelect = {
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
  deletedAt: true,
  updatedAt: true,
  user: { select: adminProviderListUserSelect },
  verification: { select: adminProviderVerificationSummarySelect },
  kyc: { select: adminProviderKycSummarySelect },
  documents: {
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: adminProviderDocumentSummarySelect,
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: adminProviderBankAccountSummarySelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderReportSummarySelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderSanctionSummarySelect,
  },
  preferredBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT,
    select: adminProviderListBookingSelect,
  },
  selectedBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT,
    select: adminProviderListBookingSelect,
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT,
    select: adminProviderListParticipantSelect,
  },
  agreements: {
    orderBy: { acceptedAt: 'desc' },
    take: 5,
    select: adminProviderAgreementSummarySelect,
  },
  services: {
    select: adminProviderServiceSummarySelect,
  },
  earnings: {
    where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] } },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT,
    select: adminProviderListEarningSelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderSessionSummarySelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderDeviceSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderDetailBookingSelect = {
  ...adminCustomerDetailBookingSelect,
} satisfies Prisma.BookingSelect;

export const adminProviderOverviewBookingSelect = {
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
  customerProfile: {
    select: {
      id: true,
      user: { select: adminUserSummarySelect },
    },
  },
  services: { select: adminBookingServiceSummarySelect },
  addressSnapshot: { select: adminAddressSnapshotSelect },
  chatRoom: {
    select: {
      id: true,
      createdAt: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: ADMIN_PROVIDER_OVERVIEW_CHAT_MESSAGE_LIMIT,
        select: adminChatMessageSummarySelect,
      },
    },
  },
} satisfies Prisma.BookingSelect;

export const adminProviderDetailEarningSelect = {
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

export const adminProviderPayoutBatchSummarySelect = {
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

export const adminLocationSnapshotSummarySelect = {
  id: true,
  bookingId: true,
  providerProfileId: true,
  lat: true,
  lng: true,
  recordedAt: true,
} satisfies Prisma.LocationSnapshotSelect;

export const adminProviderVerificationLogSummarySelect = {
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

export const adminProviderOverviewSelect = {
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
  user: { select: adminProviderOverviewUserSelect },
  verification: { select: adminProviderVerificationSummarySelect },
  kyc: { select: adminProviderKycSummarySelect },
  documents: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_DOCUMENT_LIMIT,
    select: adminProviderDocumentSummarySelect,
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: adminProviderBankAccountSummarySelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  agreements: {
    orderBy: { acceptedAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: adminProviderAgreementSummarySelect,
  },
  services: {
    select: adminProviderServiceSummarySelect,
  },
  preferredBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: adminProviderOverviewBookingSelect,
  },
  selectedBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: adminProviderOverviewBookingSelect,
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: {
      id: true,
      providerProfileId: true,
      status: true,
      distanceMeters: true,
      providerStatusAtJoin: true,
      joinedAt: true,
      respondedAt: true,
      booking: { select: adminProviderOverviewBookingSelect },
    },
  },
  earnings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT,
    select: adminProviderDetailEarningSelect,
  },
  payoutBatches: {
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: adminProviderPayoutBatchSummarySelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderSessionSummarySelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderDeviceSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminBookingDetailProviderSelect = {
  ...adminProviderSummarySelect,
  locationSnapshots: {
    orderBy: { recordedAt: 'desc' },
    take: 1,
    select: adminLocationSnapshotSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderDetailSelect = {
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
    take: ADMIN_PROVIDER_DETAIL_DOCUMENT_LIMIT,
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
