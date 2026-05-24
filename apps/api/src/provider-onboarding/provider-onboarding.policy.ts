import { ProviderAgreementType, ProviderDocumentType, ProviderLevel } from '@prisma/client';

export const REQUIRED_KYC_DOCUMENT_TYPES = [
  ProviderDocumentType.CCCD_FRONT,
  ProviderDocumentType.CCCD_BACK,
  ProviderDocumentType.SELFIE,
] as const;

export const OPTIONAL_PROVIDER_DOCUMENT_TYPES = [
  ProviderDocumentType.PROFILE_PHOTO,
  ProviderDocumentType.WORK_PHOTO,
  ProviderDocumentType.BANK_QR,
] as const;

export const REQUIRED_PAYOUT_AGREEMENTS = [
  ProviderAgreementType.TERMS,
  ProviderAgreementType.PRIVACY,
  ProviderAgreementType.LOCATION,
  ProviderAgreementType.PAYOUT,
  ProviderAgreementType.TAX,
] as const;

export const PROVIDER_AGREEMENT_VERSION = process.env.PROVIDER_AGREEMENT_VERSION?.trim() || '2026-05';

export const PROVIDER_LEVEL_REQUIREMENTS = {
  [ProviderLevel.LEVEL_1_SIGNUP]: ['Phone login linked', 'Basic public profile started'],
  [ProviderLevel.LEVEL_2_ACTIVE]: ['KYC or legacy verification approved', 'Bank account approved'],
  [ProviderLevel.LEVEL_3_PAYOUT_ENABLED]: [
    'At least one completed service',
    'Tax profile approved',
    'Residential address saved',
    'Payout agreements accepted',
  ],
  [ProviderLevel.LEVEL_4_TRUSTED]: [
    'Admin trust review completed',
    'Experience and profile evidence reviewed',
  ],
} as const;
