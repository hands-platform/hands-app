import { providerDocumentLabel } from '../../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../../lib/operations-policy';
import { jsonStringList } from './partner-detail-format';

type PartnerRegistrationDossierProvider = {
  readonly activityNickname?: string | null;
  readonly agreements?: readonly unknown[] | null;
  readonly bankAccounts?: readonly { readonly status: string }[] | null;
  readonly bio?: string | null;
  readonly blockedAt?: string | null;
  readonly city?: string | null;
  readonly currentLat?: number | string | null;
  readonly currentLng?: number | string | null;
  readonly dateOfBirth?: string | null;
  readonly devices?: readonly { readonly blockedAt?: string | null }[] | null;
  readonly displayName?: string | null;
  readonly documents?: readonly { readonly status: string; readonly type: string }[] | null;
  readonly earnings?: readonly { readonly status: string }[] | null;
  readonly experienceYears?: number | null;
  readonly gender?: string | null;
  readonly kyc?: { readonly status?: string | null } | null;
  readonly languages?: unknown;
  readonly legalName?: string | null;
  readonly residentialAddress?: string | null;
  readonly serviceArea?: unknown;
  readonly serviceStyle?: string | null;
  readonly sessions?: readonly { readonly suspicious: boolean }[] | null;
  readonly specialties?: unknown;
  readonly taxProfile?: { readonly status?: string | null } | null;
  readonly user?: { readonly phone?: string | null } | null;
};

export type PartnerRegistrationDossierItem = {
  readonly detail: string;
  readonly label: string;
  readonly ok: boolean;
  readonly operatorAction: string;
  readonly status: string;
};

export type PartnerRegistrationDossier = {
  readonly blockers: number;
  readonly items: PartnerRegistrationDossierItem[];
  readonly ready: boolean;
};

export function buildProviderRegistrationDossier(
  provider: PartnerRegistrationDossierProvider,
): PartnerRegistrationDossier {
  const specialties = jsonStringList(provider.specialties);
  const languages = jsonStringList(provider.languages);
  const hasProfileQuality =
    (provider.experienceYears ?? 0) > 0 &&
    specialties.length > 0 &&
    languages.length > 0 &&
    Boolean(provider.serviceStyle?.trim());
  const profileComplete = Boolean(
    provider.legalName?.trim() &&
      provider.dateOfBirth &&
      provider.gender?.trim() &&
      provider.user?.phone?.trim() &&
      provider.displayName?.trim(),
  );
  const publicProfileComplete = Boolean(
    provider.activityNickname?.trim() ||
      (provider.bio?.trim() &&
        (provider.documents ?? []).some((document) => document.type === 'PROFILE_PHOTO')) ||
      hasProfileQuality,
  );
  const serviceAreaComplete =
    Boolean(provider.serviceArea) || Boolean(provider.currentLat && provider.currentLng);
  const identityComplete =
    provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider);
  const securityClear =
    !provider.blockedAt &&
    !(provider.devices ?? []).some((device) => device.blockedAt) &&
    !(provider.sessions ?? []).some((session) => session.suspicious);

  const items: PartnerRegistrationDossierItem[] = [
    {
      label: 'Basic identity',
      ok: profileComplete,
      status: profileComplete ? 'READY' : 'MISSING',
      detail: profileComplete
        ? 'Legal name, date of birth, gender, phone, and display name are present.'
        : 'Real name, date of birth, gender, phone, and public display name should be collected before approval.',
      operatorAction: profileComplete
        ? 'Continue KYC and public profile review.'
        : 'Ask partner to complete basic profile fields in the Partner app.',
    },
    {
      label: 'Public working profile',
      ok: publicProfileComplete,
      status: publicProfileComplete ? 'READY' : 'DRAFT',
      detail: publicProfileComplete
        ? `Partner has public-facing profile material for customer review. Quality fields: ${
            hasProfileQuality
              ? `${provider.experienceYears} year(s), ${specialties.length} specialty, ${languages.length} language.`
              : 'partial quality profile.'
          }`
        : 'Activity nickname, introduction, profile photo, and work photos should be reviewed before customer launch.',
      operatorAction: publicProfileComplete
        ? 'Check whether photos, service style, specialties, and bio are suitable for the HANDS customer app.'
        : 'Keep as draft until public profile content is ready.',
    },
    {
      label: 'Address and service area',
      ok: serviceAreaComplete,
      status: serviceAreaComplete ? 'READY' : 'MISSING',
      detail:
        serviceAreaComplete
          ? 'Service area/location data is available for dispatch review.'
          : 'GPS location or service area still needs confirmation before dispatch.',
      operatorAction:
        serviceAreaComplete
          ? 'Use location freshness before dispatching.'
          : 'Ask partner to open the app for location sync.',
    },
    {
      label: 'KYC evidence',
      ok: identityComplete,
      status: identityComplete ? 'APPROVED' : (provider.kyc?.status ?? 'DRAFT'),
      detail: identityComplete
        ? 'CCCD/CMND and selfie evidence are approved.'
        : `KYC requires approved CCCD front/back and selfie. Missing: ${
            missingApprovedRequiredKycDocuments(provider).map(providerDocumentLabel).join(', ') ||
            'KYC decision'
          }.`,
      operatorAction: identityComplete
        ? 'Identity gate is clear.'
        : 'Review all submitted details and documents, then approve or put KYC on hold.',
    },
    {
      label: 'Device and session',
      ok: securityClear,
      status: securityClear ? 'CLEAR' : 'CHECK',
      detail: securityClear
        ? 'No account block, blocked partner device, or session check is active.'
        : 'A block, device issue, or session check needs admin review.',
      operatorAction: securityClear
        ? 'Continue normal monitoring.'
        : 'Review device/session section and reports desk before approval or payout.',
    },
  ];

  return {
    items,
    blockers: items.filter((item) => !item.ok).length,
    ready: items.every((item) => item.ok),
  };
}

function hasApprovedRequiredKycDocuments(provider: PartnerRegistrationDossierProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function missingApprovedRequiredKycDocuments(provider: PartnerRegistrationDossierProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}
