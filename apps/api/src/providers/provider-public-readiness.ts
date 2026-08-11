import {
  Prisma,
  ProviderDocumentStatus,
  ProviderDocumentType,
  ProviderKycStatus,
  ProviderStatus,
  VerificationStatus,
} from '@prisma/client';

export const PUBLIC_PROVIDER_DISCOVERY_STATUSES = [
  ProviderStatus.ONLINE_AVAILABLE,
  ProviderStatus.ONLINE_AVAILABLE_SOON,
] as const;

export const REQUIRED_PUBLIC_BOOKING_DOCUMENT_TYPES = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
] as const;

export function publicProviderDiscoveryBaseWhere(): Prisma.ProviderProfileWhereInput {
  return {
    blockedAt: null,
    status: { in: [...PUBLIC_PROVIDER_DISCOVERY_STATUSES] },
    verification: { status: VerificationStatus.APPROVED },
    kyc: { status: ProviderKycStatus.APPROVED },
  };
}

export function publicProviderIdentityWhere(): Prisma.ProviderProfileWhereInput {
  return {
    blockedAt: null,
    deletedAt: null,
    verification: { status: VerificationStatus.APPROVED },
    kyc: { status: ProviderKycStatus.APPROVED },
    AND: REQUIRED_PUBLIC_BOOKING_DOCUMENT_TYPES.map((type) => ({
      documents: {
        some: {
          type,
          status: ProviderDocumentStatus.APPROVED,
          deletedAt: null,
        },
      },
    })),
  };
}

export function publicProviderDiscoveryWhere(): Prisma.ProviderProfileWhereInput {
  return {
    ...publicProviderIdentityWhere(),
    services: {
      some: {
        active: true,
        service: { active: true },
      },
    },
    currentLat: { not: null },
    currentLng: { not: null },
  };
}
