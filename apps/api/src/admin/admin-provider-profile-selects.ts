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
  adminProviderListBankAccountSelect,
  adminProviderListDocumentSelect,
  adminProviderListDeviceSelect,
  adminProviderListPublicMediaSelect,
  adminProviderListReportSelect,
  adminProviderListSanctionSelect,
  adminProviderListSessionSelect,
  adminProviderListVerificationFileSelect,
  adminProviderListVerificationSelect,
  adminProviderOverviewUserSelect,
  adminProviderPushDeviceReachabilityOrder,
  adminProviderReportDetailSelect,
  adminProviderSanctionDetailSelect,
  adminProviderSessionSummarySelect,
  adminProviderSummarySelect,
  adminProviderTaxProfileSummarySelect,
  adminProviderVerificationDetailSelect,
  adminProviderVerificationSummarySelect,
} from './admin-provider-selects';
import {
  adminBookingServiceSummarySelect,
  adminProviderListServiceSelect,
  adminProviderServiceSummarySelect,
} from './admin-service-selects';
import { adminPushDeviceSummarySelect, adminUserSummarySelect } from './admin-user-selects';

export const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 50;
export const ADMIN_PROVIDER_DIRECTORY_LIST_LIMIT = 50;
export const ADMIN_PROVIDER_FILE_REVIEW_LIST_LIMIT = 50;
export const ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT = 3;
export const ADMIN_PROVIDER_OPERATIONS_HANDOFF_LIST_LIMIT = 50;
export const ADMIN_PROVIDER_OPERATIONS_POLICY_LIST_LIMIT = 50;
export const ADMIN_PROVIDER_CONTROL_LIST_LIMIT = 50;

const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 15;
const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 15;
const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 10;
const ADMIN_PROVIDER_COMPACT_WITHDRAWAL_RELATION_LIMIT = 3;
const ADMIN_PROVIDER_DETAIL_DOCUMENT_LIMIT = 50;
const ADMIN_PROVIDER_DETAIL_RELATION_LIMIT = 10;
const ADMIN_PROVIDER_DETAIL_REVIEW_SIGNAL_LIMIT = 20;
const ADMIN_PROVIDER_FILE_REVIEW_FILE_LIMIT = 20;
const ADMIN_PROVIDER_OPERATIONS_HANDOFF_RELATION_LIMIT = 15;
const ADMIN_PROVIDER_OPERATIONS_HANDOFF_SIGNAL_LIMIT = 3;
const ADMIN_PROVIDER_OPERATIONS_POLICY_DOCUMENT_LIMIT = 12;
const ADMIN_PROVIDER_OPERATIONS_POLICY_DEVICE_LIMIT = 3;
const ADMIN_PROVIDER_CONTROL_RELATION_LIMIT = 15;
const ADMIN_PROVIDER_CONTROL_REPORT_LIMIT = 5;
const ADMIN_PROVIDER_CONTROL_SANCTION_LIMIT = 5;
const ADMIN_PROVIDER_CONTROL_DEVICE_LIMIT = 5;
const ADMIN_PROVIDER_CONTROL_SESSION_LIMIT = 3;
const ADMIN_PROVIDER_OVERVIEW_DOCUMENT_LIMIT = 12;
const ADMIN_PROVIDER_OVERVIEW_RELATION_LIMIT = 5;
const ADMIN_PROVIDER_OVERVIEW_CHAT_MESSAGE_LIMIT = 8;

export const adminProviderFileReviewWhere = {
  OR: [
    { verification: { files: { some: {} } } },
    {
      user: {
        fileAssets: {
          some: {
            purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
            visibility: FileVisibility.PUBLIC,
            uploadStatus: FileUploadStatus.UPLOADED,
          },
        },
      },
    },
  ],
} satisfies Prisma.ProviderProfileWhereInput;

export const adminProviderFileReviewSelect = {
  id: true,
  displayName: true,
  status: true,
  user: {
    select: {
      id: true,
      phone: true,
      fullName: true,
      fileAssets: {
        where: {
          purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
          visibility: FileVisibility.PUBLIC,
          uploadStatus: FileUploadStatus.UPLOADED,
        },
        orderBy: { createdAt: 'desc' },
        take: ADMIN_PROVIDER_FILE_REVIEW_FILE_LIMIT,
        select: adminProviderListPublicMediaSelect,
      },
    },
  },
  verification: {
    select: {
      id: true,
      status: true,
      files: {
        orderBy: { uploadedAt: 'desc' },
        take: ADMIN_PROVIDER_FILE_REVIEW_FILE_LIMIT,
        select: adminProviderListVerificationFileSelect,
      },
    },
  },
} satisfies Prisma.ProviderProfileSelect;

const adminFileReviewPartnerSelect = {
  id: true,
  displayName: true,
  status: true,
  user: {
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminFileReviewItemSelect = {
  id: true,
  key: true,
  url: true,
  contentType: true,
  purpose: true,
  visibility: true,
  uploadStatus: true,
  reviewStatus: true,
  reviewReason: true,
  uploadedAt: true,
  sizeBytes: true,
  providerVerificationId: true,
  createdAt: true,
  owner: {
    select: {
      providerProfile: { select: adminFileReviewPartnerSelect },
    },
  },
  providerVerification: {
    select: {
      providerProfile: { select: adminFileReviewPartnerSelect },
    },
  },
} satisfies Prisma.FileAssetSelect;

export const adminProviderOperationsPolicyPushDeviceSelect = {
  id: true,
  enabled: true,
  lastSeenAt: true,
} satisfies Prisma.PushDeviceSelect;

export const adminProviderOperationsPolicySelect = {
  id: true,
  displayName: true,
  status: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  blockedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      pushDevices: {
        orderBy: adminProviderPushDeviceReachabilityOrder,
        take: 2,
        select: adminProviderOperationsPolicyPushDeviceSelect,
      },
    },
  },
  verification: {
    select: {
      id: true,
      status: true,
    },
  },
  kyc: {
    select: {
      id: true,
      status: true,
    },
  },
  documents: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_POLICY_DOCUMENT_LIMIT,
    select: {
      id: true,
      type: true,
      status: true,
    },
  },
  bankAccounts: {
    where: { status: 'APPROVED' },
    take: 1,
    select: {
      id: true,
      status: true,
    },
  },
  sanctions: {
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: {
      id: true,
      status: true,
    },
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_POLICY_DEVICE_LIMIT,
    select: {
      id: true,
      suspicious: true,
    },
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_POLICY_DEVICE_LIMIT,
    select: {
      id: true,
      deviceId: true,
      enabled: true,
      blockedAt: true,
    },
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderOperationsHandoffSelect = {
  id: true,
  displayName: true,
  legalName: true,
  status: true,
  currentLocationUpdatedAt: true,
  blockedAt: true,
  user: {
    select: {
      id: true,
      fullName: true,
      pushDevices: {
        orderBy: adminProviderPushDeviceReachabilityOrder,
        take: 2,
        select: adminProviderOperationsPolicyPushDeviceSelect,
      },
    },
  },
  verification: {
    select: {
      id: true,
      status: true,
    },
  },
  kyc: {
    select: {
      id: true,
      status: true,
    },
  },
  bankAccounts: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_HANDOFF_SIGNAL_LIMIT,
    select: {
      id: true,
      status: true,
    },
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_HANDOFF_RELATION_LIMIT,
    select: {
      id: true,
      providerProfileId: true,
      status: true,
    },
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_HANDOFF_SIGNAL_LIMIT,
    select: {
      id: true,
      lastSeenAt: true,
      suspicious: true,
    },
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_OPERATIONS_HANDOFF_SIGNAL_LIMIT,
    select: {
      id: true,
      deviceId: true,
      enabled: true,
      lastSeenAt: true,
      blockedAt: true,
    },
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderControlSelect = {
  id: true,
  displayName: true,
  legalName: true,
  status: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  blockedAt: true,
  blockedReason: true,
  user: {
    select: {
      id: true,
      phone: true,
      fullName: true,
      pushDevices: {
        orderBy: adminProviderPushDeviceReachabilityOrder,
        take: 2,
        select: adminProviderOperationsPolicyPushDeviceSelect,
      },
    },
  },
  verification: {
    select: {
      id: true,
      status: true,
    },
  },
  kyc: {
    select: {
      id: true,
      status: true,
    },
  },
  taxProfile: {
    select: {
      id: true,
      status: true,
    },
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: {
      id: true,
      status: true,
      isPrimary: true,
    },
  },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_CONTROL_REPORT_LIMIT,
    select: adminProviderListReportSelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_CONTROL_SANCTION_LIMIT,
    select: adminProviderListSanctionSelect,
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: ADMIN_PROVIDER_CONTROL_RELATION_LIMIT,
    select: {
      id: true,
      providerProfileId: true,
      status: true,
    },
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_CONTROL_SESSION_LIMIT,
    select: {
      id: true,
      lastSeenAt: true,
      suspicious: true,
    },
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_CONTROL_DEVICE_LIMIT,
    select: {
      id: true,
      deviceId: true,
      enabled: true,
      lastSeenAt: true,
      blockedAt: true,
    },
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderListUserSelect = {
  ...adminUserSummarySelect,
  supabaseUserId: true,
  pushDevices: {
    orderBy: adminProviderPushDeviceReachabilityOrder,
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
    select: adminProviderListPublicMediaSelect,
  },
} satisfies Prisma.UserSelect;

export const adminProviderListBookingSelect = {
  id: true,
  status: true,
  scheduledStartAt: true,
  closedByRole: true,
  createdAt: true,
  updatedAt: true,
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

export const adminProviderListWalletWithdrawalRequestSelect = {
  id: true,
  providerProfileId: true,
  bankAccountId: true,
  amount: true,
  currency: true,
  status: true,
  adminNote: true,
  correctionReason: true,
  transferRef: true,
  reviewedAt: true,
  paidAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderWalletWithdrawalRequestSelect;

export const adminProviderListParticipantSelect = {
  id: true,
  providerProfileId: true,
  status: true,
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
  verification: { select: adminProviderListVerificationSelect },
  kyc: { select: adminProviderKycSummarySelect },
  documents: {
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: adminProviderListDocumentSelect,
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: adminProviderListBankAccountSelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderListReportSelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderListSanctionSelect,
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
    select: adminProviderListServiceSelect,
  },
  earnings: {
    where: { status: { in: [EarningStatus.PENDING, EarningStatus.AVAILABLE, EarningStatus.PAID] } },
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT,
    select: adminProviderListEarningSelect,
  },
  walletWithdrawalRequests: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_WITHDRAWAL_RELATION_LIMIT,
    select: adminProviderListWalletWithdrawalRequestSelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderListSessionSelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderListDeviceSelect,
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderDirectorySelect = {
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
  verification: { select: adminProviderListVerificationSelect },
  kyc: { select: adminProviderKycSummarySelect },
  documents: {
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: adminProviderListDocumentSelect,
  },
  bankAccounts: {
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    take: 3,
    select: adminProviderListBankAccountSelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderListReportSelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: adminProviderListSanctionSelect,
  },
  agreements: {
    orderBy: { acceptedAt: 'desc' },
    take: 5,
    select: adminProviderAgreementSummarySelect,
  },
  services: {
    select: adminProviderListServiceSelect,
  },
  walletWithdrawalRequests: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_COMPACT_WITHDRAWAL_RELATION_LIMIT,
    select: adminProviderListWalletWithdrawalRequestSelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderListSessionSelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: 3,
    select: adminProviderListDeviceSelect,
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
  addressText: true,
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
  city: true,
  residentialAddress: true,
  serviceArea: true,
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
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderBankAccountSummarySelect,
  },
  taxProfile: { select: adminProviderTaxProfileSummarySelect },
  reports: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_REVIEW_SIGNAL_LIMIT,
    select: adminProviderReportDetailSelect,
  },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_REVIEW_SIGNAL_LIMIT,
    select: adminProviderSanctionDetailSelect,
  },
  agreements: {
    orderBy: { acceptedAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderAgreementSummarySelect,
  },
  services: {
    select: adminProviderServiceSummarySelect,
  },
  preferredBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderDetailBookingSelect,
  },
  selectedBookings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderDetailBookingSelect,
  },
  participants: {
    orderBy: { joinedAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
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
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminLocationSnapshotSummarySelect,
  },
  earnings: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderDetailEarningSelect,
  },
  payoutBatches: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderPayoutBatchSummarySelect,
  },
  sessions: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderSessionSummarySelect,
  },
  devices: {
    orderBy: { lastSeenAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_RELATION_LIMIT,
    select: adminProviderDeviceSummarySelect,
  },
  verificationLogs: {
    orderBy: { createdAt: 'desc' },
    take: ADMIN_PROVIDER_DETAIL_REVIEW_SIGNAL_LIMIT,
    select: adminProviderVerificationLogSummarySelect,
  },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderDetailWithoutDiagnosticsSelect = Object.fromEntries(
  Object.entries(adminProviderDetailSelect).filter(([key]) => key !== 'devices' && key !== 'sessions'),
) as Prisma.ProviderProfileSelect;
