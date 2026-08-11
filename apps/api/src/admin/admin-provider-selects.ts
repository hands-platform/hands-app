import { FilePurpose, FileUploadStatus, FileVisibility, Prisma } from '@prisma/client';
import {
  adminPushDeviceSummarySelect,
  adminUserAuthSelect,
  adminUserIdentitySelect,
  adminUserSummarySelect,
} from './admin-user-selects';

export const adminProviderPushDeviceReachabilityOrder = [
  { enabled: 'desc' },
  { updatedAt: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.PushDeviceOrderByWithRelationInput[];

export const adminProviderSummarySelect = {
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

export const adminProviderBookingListSummarySelect = {
  id: true,
  userId: true,
  displayName: true,
  status: true,
  currentLat: true,
  currentLng: true,
  currentLocationUpdatedAt: true,
  user: { select: adminUserIdentitySelect },
} satisfies Prisma.ProviderProfileSelect;

export const adminProviderPublicMediaSelect = {
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
  sortOrder: true,
  createdAt: true,
} satisfies Prisma.FileAssetSelect;

export const adminProviderListPublicMediaSelect = {
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
  createdAt: true,
} satisfies Prisma.FileAssetSelect;

export const adminProviderVerificationFileSelect = {
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

export const adminProviderVerificationSummarySelect = {
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

export const adminProviderListVerificationFileSelect = {
  id: true,
  key: true,
  contentType: true,
  purpose: true,
  visibility: true,
  uploadStatus: true,
  reviewStatus: true,
  reviewReason: true,
  uploadedAt: true,
  sizeBytes: true,
} satisfies Prisma.FileAssetSelect;

export const adminProviderListVerificationSelect = {
  id: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  files: {
    take: 3,
    select: adminProviderListVerificationFileSelect,
  },
} satisfies Prisma.ProviderVerificationSelect;

export const adminProviderDetailUserSelect = {
  ...adminUserAuthSelect,
  pushDevices: {
    orderBy: adminProviderPushDeviceReachabilityOrder,
    select: adminPushDeviceSummarySelect,
  },
  fileAssets: {
    where: {
      purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
      visibility: FileVisibility.PUBLIC,
      uploadStatus: FileUploadStatus.UPLOADED,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 12,
    select: adminProviderPublicMediaSelect,
  },
} satisfies Prisma.UserSelect;

export const adminProviderOverviewUserSelect = {
  ...adminUserAuthSelect,
  pushDevices: {
    orderBy: adminProviderPushDeviceReachabilityOrder,
    take: 3,
    select: adminPushDeviceSummarySelect,
  },
  fileAssets: {
    where: {
      purpose: { in: [FilePurpose.PROFILE_IMAGE, FilePurpose.PROVIDER_GALLERY] },
      visibility: FileVisibility.PUBLIC,
      uploadStatus: FileUploadStatus.UPLOADED,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: 3,
    select: adminProviderPublicMediaSelect,
  },
} satisfies Prisma.UserSelect;

export const adminProviderVerificationDetailSelect = {
  id: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
  files: {
    select: adminProviderVerificationFileSelect,
  },
} satisfies Prisma.ProviderVerificationSelect;

export const adminProviderKycSummarySelect = {
  id: true,
  status: true,
  cccdNumberLast4: true,
  submittedAt: true,
  reviewedAt: true,
  rejectionReason: true,
} satisfies Prisma.ProviderKycSelect;

export const adminProviderDocumentSummarySelect = {
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

export const adminProviderBankAccountSummarySelect = {
  id: true,
  bankName: true,
  accountNumberMasked: true,
  accountNumberLast4: true,
  accountHolderName: true,
  status: true,
  isPrimary: true,
  reviewedAt: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderBankAccountSelect;

export const adminProviderTaxProfileSummarySelect = {
  id: true,
  status: true,
  taxCodeLast4: true,
  legalName: true,
  registeredAddress: true,
  approvedAt: true,
  rejectionReason: true,
} satisfies Prisma.ProviderTaxProfileSelect;

export const adminProviderAgreementSummarySelect = {
  id: true,
  type: true,
  version: true,
  acceptedAt: true,
} satisfies Prisma.ProviderAgreementSelect;

export const adminProviderReportSummarySelect = {
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

export const adminProviderSanctionSummarySelect = {
  id: true,
  providerProfileId: true,
  reportId: true,
  type: true,
  status: true,
  reason: true,
  startsAt: true,
  expiresAt: true,
  liftedAt: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderSanctionSelect;

export const adminProviderListDocumentSelect = {
  id: true,
  type: true,
  status: true,
  fileAsset: {
    select: {
      id: true,
      key: true,
      contentType: true,
      uploadedAt: true,
      sizeBytes: true,
    },
  },
} satisfies Prisma.ProviderDocumentSelect;

export const adminProviderListBankAccountSelect = {
  id: true,
  bankName: true,
  accountNumberMasked: true,
  accountHolderName: true,
  status: true,
  isPrimary: true,
  reviewedAt: true,
} satisfies Prisma.ProviderBankAccountSelect;

export const adminProviderListReportSelect = {
  id: true,
  category: true,
  summary: true,
  details: true,
  severity: true,
  status: true,
  createdAt: true,
} satisfies Prisma.ProviderReportSelect;

export const adminProviderListSanctionSelect = {
  id: true,
  type: true,
  status: true,
  reason: true,
  createdAt: true,
} satisfies Prisma.ProviderSanctionSelect;

export const adminProviderReportDetailSelect = {
  ...adminProviderReportSummarySelect,
  booking: { select: { id: true, status: true } },
  reporterUser: { select: { phone: true, fullName: true } },
  assignedAdmin: { select: { phone: true, fullName: true } },
  sanctions: {
    orderBy: { createdAt: 'desc' },
    select: adminProviderSanctionSummarySelect,
  },
} satisfies Prisma.ProviderReportSelect;

export const adminProviderReportListSelect = {
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

export const adminProviderSanctionDetailSelect = {
  ...adminProviderSanctionSummarySelect,
  report: { select: { id: true, category: true, severity: true, status: true, summary: true } },
  issuedBy: { select: { phone: true, fullName: true } },
  liftedBy: { select: { phone: true, fullName: true } },
} satisfies Prisma.ProviderSanctionSelect;

export const adminProviderSanctionListSelect = {
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

export const adminProviderSessionSummarySelect = {
  id: true,
  deviceId: true,
  ipAddress: true,
  appVersion: true,
  loggedInAt: true,
  lastSeenAt: true,
  suspicious: true,
  suspiciousReason: true,
} satisfies Prisma.ProviderSessionSelect;

export const adminProviderListSessionSelect = {
  id: true,
  deviceId: true,
  ipAddress: true,
  loggedInAt: true,
  lastSeenAt: true,
  suspicious: true,
} satisfies Prisma.ProviderSessionSelect;

export const adminProviderDeviceSummarySelect = {
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

export const adminProviderListDeviceSelect = {
  id: true,
  deviceId: true,
  platform: true,
  enabled: true,
  lastSeenAt: true,
  blockedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProviderDeviceSelect;
