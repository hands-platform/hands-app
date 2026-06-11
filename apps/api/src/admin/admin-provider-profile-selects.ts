import { EarningStatus, FilePurpose, FileUploadStatus, FileVisibility, Prisma } from '@prisma/client';
import { adminAddressSnapshotSelect } from './admin-booking-selects';
import {
  adminProviderAgreementSummarySelect,
  adminProviderBankAccountSummarySelect,
  adminProviderDeviceSummarySelect,
  adminProviderDocumentSummarySelect,
  adminProviderKycSummarySelect,
  adminProviderPublicMediaSelect,
  adminProviderReportSummarySelect,
  adminProviderSanctionSummarySelect,
  adminProviderSessionSummarySelect,
  adminProviderTaxProfileSummarySelect,
  adminProviderVerificationSummarySelect,
} from './admin-provider-selects';
import { adminProviderServiceSummarySelect } from './admin-service-selects';
import { adminPushDeviceSummarySelect, adminUserSummarySelect } from './admin-user-selects';

export const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 500;
export const ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT = 3;

const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 50;
const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 30;

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
