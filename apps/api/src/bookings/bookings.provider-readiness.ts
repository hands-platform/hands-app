import { BadRequestException } from '@nestjs/common';
import {
  ProviderBankAccountStatus,
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

export function assertProviderCanReceiveBooking(provider: {
  blockedAt: Date | null;
  blockedReason: string | null;
  status: ProviderStatus;
  verification?: { status: VerificationStatus } | null;
  kyc?: { status: ProviderKycStatus } | null;
  documents?: Array<{
    type: ProviderDocumentType;
    status: ProviderDocumentStatus;
    deletedAt?: Date | null;
  }>;
  bankAccounts?: Array<{
    status: ProviderBankAccountStatus;
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

  const hasApprovedBank = (provider.bankAccounts ?? []).some(
    (account) => account.status === ProviderBankAccountStatus.APPROVED && !account.deletedAt,
  );
  if (!hasApprovedBank) {
    throw new BadRequestException('Partner bank account must be approved before receiving bookings');
  }
}
