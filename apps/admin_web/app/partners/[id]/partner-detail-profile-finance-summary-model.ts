import type {
  PartnerAgreementBadge,
  PartnerDetailInfoLine,
  PartnerLocationSnapshotBadge,
  PartnerRecentPayoutRecordLine,
} from './partner-detail-profile-finance-summary-section';
import {
  formatCurrency,
  formatDateOnly,
  formatJsonList,
  formatJsonSummary,
} from './partner-detail-format';

type PartnerProfileFinanceSummaryProvider = {
  readonly activityNickname?: string | null;
  readonly agreements?: readonly {
    readonly id: string;
    readonly type: string;
    readonly version: string;
  }[] | null;
  readonly city?: string | null;
  readonly dateOfBirth?: string | null;
  readonly displayName?: string | null;
  readonly earnings?: readonly {
    readonly grossAmount: number;
    readonly id: string;
    readonly netAmount: number;
    readonly settlementRef?: string | null;
    readonly status: string;
    readonly withholdingAmount: number;
  }[] | null;
  readonly experienceYears?: number | null;
  readonly facebookId?: string | null;
  readonly gender?: string | null;
  readonly id?: string;
  readonly languages?: unknown;
  readonly legalName?: string | null;
  readonly locationSnapshots?: readonly {
    readonly id: string;
    readonly recordedAt: string;
  }[] | null;
  readonly nextAvailableAt?: string | null;
  readonly residentialAddress?: string | null;
  readonly reviewCount?: number | null;
  readonly serviceArea?: unknown;
  readonly serviceStyle?: string | null;
  readonly specialties?: unknown;
  readonly status?: string;
  readonly trustedAt?: string | null;
  readonly user?: {
    readonly fullName?: string | null;
    readonly phone?: string | null;
    readonly supabaseUserId?: string | null;
  } | null;
};

export function buildPartnerBasicProfileRows(
  provider: PartnerProfileFinanceSummaryProvider,
): PartnerDetailInfoLine[] {
  return [
    { label: 'Display name', value: provider.displayName },
    { label: 'Legal name', value: provider.legalName },
    { label: 'Profile nickname', value: provider.activityNickname },
    {
      label: 'Experience',
      value:
        provider.experienceYears === null || provider.experienceYears === undefined
          ? null
          : `${provider.experienceYears} year(s)`,
    },
    { label: 'Specialties', value: formatJsonList(provider.specialties) },
    { label: 'Languages', value: formatJsonList(provider.languages) },
    { label: 'Service style', value: provider.serviceStyle },
    { label: 'Date of birth', value: formatDateOnly(provider.dateOfBirth) },
    { label: 'Gender', value: provider.gender },
    { label: 'Phone', value: provider.user?.phone },
    { label: 'Facebook', value: provider.facebookId },
    { label: 'Address', value: provider.residentialAddress },
    { label: 'Service city', value: provider.city },
    { label: 'Service area', value: formatJsonSummary(provider.serviceArea) },
    { label: 'Feedback records', value: `${provider.reviewCount ?? 0} record(s) saved` },
    { dateValue: provider.nextAvailableAt, label: 'Next available' },
    { label: 'User name', value: provider.user?.fullName },
    { label: 'Supabase user', value: provider.user?.supabaseUserId },
  ];
}

export function buildPartnerAgreementBadges(
  provider: PartnerProfileFinanceSummaryProvider,
): PartnerAgreementBadge[] {
  return (provider.agreements ?? []).map((agreement) => ({
    id: agreement.id,
    label: `${agreement.type} v${agreement.version}`,
  }));
}

export function buildPartnerRecentPayoutRecordLines(
  provider: PartnerProfileFinanceSummaryProvider,
): PartnerRecentPayoutRecordLine[] {
  return (provider.earnings ?? []).slice(0, 3).map((earning) => ({
    id: earning.id,
    label: `${earning.status}: gross ${formatCurrency(earning.grossAmount)} / withholding ${formatCurrency(
      earning.withholdingAmount,
    )} / net ${formatCurrency(earning.netAmount)}${
      earning.settlementRef ? ` / ref ${earning.settlementRef}` : ''
    }`,
  }));
}

export function buildPartnerLocationSnapshotBadges(
  provider: PartnerProfileFinanceSummaryProvider,
): PartnerLocationSnapshotBadge[] {
  return (provider.locationSnapshots ?? []).slice(0, 5).map((snapshot) => ({
    id: snapshot.id,
    label: 'Recorded location record',
    recordedAt: snapshot.recordedAt,
  }));
}
