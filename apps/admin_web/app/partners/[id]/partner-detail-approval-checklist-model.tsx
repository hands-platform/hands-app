import type { ReactNode } from 'react';

import { DateTimeText } from '../../../components/date-time-text';
import { providerDocumentLabel } from '../../../lib/admin-api';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { missingApprovedRequiredKycDocuments } from './partner-detail-kyc-evidence-model';
import {
  bankAccountStatusLabel,
  primaryBankAccount,
  providerHasFirstRevenueSignal,
} from './partner-detail-payout-security-model';
import { formatDate, locationAgeMinutes } from './partner-detail-format';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';

export type PartnerApprovalChecklistItem = {
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly label: string;
  readonly ok: boolean;
  readonly status: string;
};

export type PartnerApprovalChecklist = {
  readonly blockers: number;
  readonly items: readonly PartnerApprovalChecklistItem[];
  readonly ready: boolean;
};

export function buildPartnerApprovalChecklist(
  provider: ProviderDetail,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerApprovalChecklist {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = primaryBankAccount(provider);
  const hasRecentLocation =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const hasPushDevice = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const hasBasicProfile = Boolean(
    provider.displayName?.trim() && provider.legalName?.trim() && provider.user?.phone?.trim(),
  );
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);

  const items: PartnerApprovalChecklistItem[] = [
    {
      label: 'Account block',
      ok: !provider.blockedAt,
      status: provider.blockedAt ? 'BLOCKED' : 'CLEAR',
      detail: provider.blockedAt
        ? `Blocked reason: ${provider.blockedReason ?? 'No reason saved'}.`
        : 'Partner account is not blocked.',
    },
    {
      label: 'Basic partner identity',
      ok: hasBasicProfile,
      status: hasBasicProfile ? 'Complete' : 'Missing',
      detail: hasBasicProfile
        ? 'Display name, legal name, and phone are saved.'
        : 'Confirm display name, legal name, and phone.',
    },
    {
      label: 'KYC status',
      ok: provider.kyc?.status === 'APPROVED',
      status: provider.kyc?.status ?? 'DRAFT',
      detail:
        provider.kyc?.status === 'APPROVED'
          ? 'KYC has been approved.'
          : 'Approve CCCD/CMND and selfie review before Level 2 activity.',
    },
    {
      label: 'Required KYC documents',
      ok: missingDocuments.length === 0,
      status: missingDocuments.length === 0 ? 'Complete' : 'Missing',
      detail:
        missingDocuments.length === 0
          ? 'CCCD front, CCCD back, and selfie are approved.'
          : `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
    },
    {
      label: 'Withdrawal details',
      ok: true,
      status: primaryBank ? bankAccountStatusLabel(provider) : 'Deferred',
      detail: primaryBank
        ? `${marketplaceDisplayText(primaryBank.bankName)} / ${
            primaryBank.accountNumberMasked ?? primaryBank.accountNumberLast4 ?? 'unmasked'
          }`
        : 'Bank account is collected and approved when the Partner requests wallet withdrawal.',
    },
    {
      label: 'Withdrawal profile',
      ok:
        !hasFirstRevenue ||
        (Boolean(provider.residentialAddress?.trim()) && (provider.agreements?.length ?? 0) >= 5),
      status: !hasFirstRevenue
        ? 'DEFERRED'
        : Boolean(provider.residentialAddress?.trim()) && (provider.agreements?.length ?? 0) >= 5
          ? 'READY'
          : 'MISSING',
      detail: !hasFirstRevenue
        ? 'Withdrawal address and payout agreements stay deferred until wallet withdrawal/deposit is requested.'
        : Boolean(provider.residentialAddress?.trim()) && (provider.agreements?.length ?? 0) >= 5
          ? 'Withdrawal address and payout agreements are ready.'
          : 'Wallet payout follow-up is active, so withdrawal address and payout agreements need review before release.',
    },
    {
      label: 'Location freshness',
      ok: hasRecentLocation,
      status: hasRecentLocation ? 'RECENT' : 'STALE',
      detail: provider.currentLocationUpdatedAt
        ? `Last shared at ${formatDate(provider.currentLocationUpdatedAt)}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`
        : 'Partner app has not shared a location.',
      detailNode: provider.currentLocationUpdatedAt ? (
        <>
          Last shared at <DateTimeText fallback="Missing" value={provider.currentLocationUpdatedAt} />. Policy
          requires {dispatchPolicy.locationFreshnessMinutes}m freshness.
        </>
      ) : undefined,
    },
    {
      label: 'Push device',
      ok: hasPushDevice,
      status: hasPushDevice ? 'READY' : 'MISSING',
      detail: hasPushDevice
        ? 'At least one enabled device token exists.'
        : 'Ask partner to open the app so alerts can register.',
    },
  ];

  return {
    items,
    blockers: items.filter((item) => !item.ok).length,
    ready: items.every((item) => item.ok),
  };
}
