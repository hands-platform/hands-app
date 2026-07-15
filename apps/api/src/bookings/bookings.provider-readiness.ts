import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';

export const REQUIRED_BOOKING_DOCUMENT_TYPES = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
];

export const PROVIDER_ACTIVE_WORK_STATUS_VALUES = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
] as const;

const PROVIDER_ACTIVE_WORK_STATUSES = new Set<BookingStatus>(PROVIDER_ACTIVE_WORK_STATUS_VALUES);

export function assertProviderCanReceiveBooking(provider: {
  blockedAt: Date | null;
  blockedReason: string | null;
  status: ProviderStatus;
  selectedBookings?: Array<{
    id?: string;
    status: BookingStatus;
  }>;
  verification?: { status: VerificationStatus } | null;
  kyc?: { status: ProviderKycStatus } | null;
  documents?: Array<{
    type: ProviderDocumentType;
    status: ProviderDocumentStatus;
    deletedAt?: Date | null;
  }>;
  bankAccounts?: Array<{
    status: string;
    deletedAt?: Date | null;
  }>;
}) {
  if (provider.blockedAt) {
    throw new BadRequestException(
      provider.blockedReason
        ? `Partner account is blocked by admin review: ${provider.blockedReason}`
        : 'Partner account is blocked by admin review.',
    );
  }
  if (provider.status === ProviderStatus.OFFLINE) {
    throw new BadRequestException('Partner must be online before receiving bookings');
  }
  if (providerHasActiveSelectedBooking(provider)) {
    throw new BadRequestException(
      'Partner must complete the current booking before receiving or joining another booking',
    );
  }
  if (provider.verification?.status !== VerificationStatus.APPROVED) {
    throw new BadRequestException('Partner verification must be approved before receiving bookings');
  }
  if (provider.kyc?.status !== ProviderKycStatus.APPROVED) {
    throw new BadRequestException('Partner KYC must be approved before receiving bookings');
  }

  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === ProviderDocumentStatus.APPROVED && !document.deletedAt)
      .map((document) => document.type),
  );
  const missingDocuments = REQUIRED_BOOKING_DOCUMENT_TYPES.filter((type) => !approvedDocuments.has(type));
  if (missingDocuments.length > 0) {
    throw new BadRequestException(
      `Partner required KYC documents must be approved before receiving bookings: ${missingDocuments.join(', ')}`,
    );
  }
}

export function providerHasActiveSelectedBooking(provider: {
  selectedBookings?: Array<{ status: BookingStatus }>;
}) {
  return Boolean(
    provider.selectedBookings?.some((booking) => PROVIDER_ACTIVE_WORK_STATUSES.has(booking.status)),
  );
}

export function assertProviderOffersRequestedService(input: {
  providerService?: { active: boolean } | null;
  configuredServiceCount: number;
}) {
  if (input.providerService && !input.providerService.active) {
    throw new BadRequestException('Partner does not offer this service');
  }
  if (!input.providerService && input.configuredServiceCount > 0) {
    throw new BadRequestException('Partner does not offer this service');
  }
}
