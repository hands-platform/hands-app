import type { AdminProvider } from '../../lib/admin-api';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { providerSecurityLabel } from './partner-filters';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import { partnerKycState, missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import { hasApprovedBankAccount, hasHealthyPush } from './partner-list-profile';
import { partnerHasOpenControl } from './partner-list-query';
import {
  formatDistanceMeters,
  providerLocationAgeLabel,
  providerLocationLabel,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import { buildPartnerMarketplaceEligibility } from './partner-marketplace-eligibility';
import { partnerAcceptBlockerSummary } from './partner-operation-row';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerOpsBadge = {
  label: string;
  detail: string;
  tone: 'success' | 'danger' | 'warn' | 'info' | 'neutral';
};

export type PartnerOpsBadgeDeps = {
  canAcceptBookingNow: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
};

export function buildPartnerOpsBadges(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerOpsBadgeDeps,
): PartnerOpsBadge[] {
  const walletBalance = partnerUnsettledWalletBalance(provider);
  const locationState = providerLocationStatus(provider, opsPolicy);
  const kycState = partnerKycState(provider);
  const securityState = partnerSecurityStatus(provider);
  const marketplaceEligibility = buildPartnerMarketplaceEligibility(provider, opsPolicy);
  const canAccept = deps.canAcceptBookingNow(provider, opsPolicy);
  const hasPush = hasHealthyPush(provider);
  const hasBank = hasApprovedBankAccount(provider);
  const verificationApproved = provider.verification?.status === 'APPROVED';
  const authLinked = Boolean(provider.user?.supabaseUserId);
  const hasOpenControlItem = partnerHasOpenControl(provider);
  const kycApproved =
    verificationApproved && kycState.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider);

  return [
    {
      label: canAccept ? 'Direct request ready' : 'Direct request held',
      tone: canAccept ? 'success' : 'danger',
      detail: canAccept
        ? 'Partner can receive and accept a preferred direct booking now.'
        : partnerAcceptBlockerSummary(provider, opsPolicy),
    },
    {
      label: marketplaceEligibility.eligible ? 'Marketplace ready' : 'Dispatch repair',
      tone: marketplaceEligibility.eligible ? 'success' : 'warn',
      detail: marketplaceEligibility.eligible
        ? `Can participate in marketplace matching within ${formatDistanceMeters(
            opsPolicy.backupRadiusMeters,
          )}.`
        : marketplaceEligibility.blockers.map((blocker) => blocker.label).join(', ') ||
          'Dispatch participation needs policy repair.',
    },
    {
      label: walletBalance < 0 ? 'Cash debt' : 'Wallet clear',
      tone: walletBalance < 0 ? 'danger' : 'success',
      detail:
        walletBalance < 0
          ? `Partner owes ${formatProviderMoney(
              Math.abs(walletBalance),
            )} before final acceptance, service start, and payout release.`
          : 'No negative wallet balance is gating final acceptance, service start, or payout release.',
    },
    {
      label: kycApproved ? 'KYC ok' : 'KYC needed',
      tone: kycApproved ? 'success' : 'warn',
      detail: kycApproved
        ? 'Verification, KYC, and required identity documents are approved.'
        : kycState.operatorAction,
    },
    {
      label: hasBank ? 'Withdrawal bank ok' : 'Withdrawal bank on request',
      tone: hasBank ? 'success' : 'neutral',
      detail: hasBank
        ? 'At least one approved bank account is available.'
        : 'Bank details are collected and reviewed when the Partner requests wallet withdrawal.',
    },
    {
      label: providerLocationLabel(locationState),
      tone: locationState === 'recent' ? 'success' : locationState === 'missing' ? 'neutral' : 'warn',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
    },
    {
      label: hasPush ? 'Push ready' : 'Push missing',
      tone: hasPush ? 'success' : 'info',
      detail: hasPush
        ? 'At least one enabled push device is registered.'
        : 'Ask the Partner to open the app and register alerts.',
    },
    {
      label: authLinked ? 'Supabase linked' : 'Nest auth only',
      tone: authLinked ? 'success' : 'neutral',
      detail: authLinked
        ? 'Partner user is linked to Supabase auth.'
        : 'Partner can still operate in Nest auth, but Supabase migration is pending.',
    },
    {
      label: hasOpenControlItem ? 'Report follow-up' : providerSecurityLabel(securityState),
      tone: hasOpenControlItem || !['clear', 'missing'].includes(securityState) ? 'danger' : 'success',
      detail: hasOpenControlItem
        ? 'There is an unresolved report or account-control item for this partner.'
        : providerSecurityLabel(securityState),
    },
  ];
}

export function partnerOpsBadgePillClass(tone: PartnerOpsBadge['tone']) {
  if (tone === 'success') return 'pill-success';
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-neutral';
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}
