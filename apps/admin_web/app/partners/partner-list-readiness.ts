import type { AdminProvider } from '../../lib/admin-api';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { adminCountLabel } from '../../lib/admin-copy';
import {
  DEFAULT_PROVIDER_OPS_POLICY,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import {
  hasHealthyPush,
  providerPublicMedia,
  providerPublicMediaNeedsReview,
} from './partner-list-profile';
import { missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import {
  partnerHasFirstRevenueSignal,
  partnerTaxNeedsReview,
} from './partner-finance-readiness-facts';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import { buildPartnerMarketplaceEligibility } from './partner-marketplace-eligibility';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerReviewIssue = {
  readonly label: string;
  readonly severity: 'high' | 'medium';
};

export function providerActionHint(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
  if (provider.blockedAt) {
    return 'This partner account is blocked and cannot go online, update location, or appear to customers.';
  }
  if (provider.verification?.status !== 'APPROVED') {
    return 'Review verification before this partner can safely take customer requests.';
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return 'Approve public profile media before customers can see the latest uploaded images.';
  }
  const walletBalance = partnerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    return `Partner wallet is negative by ${formatProviderMoney(
      Math.abs(walletBalance),
    )}. Marketplace visibility and participation stay open as a warning state, but final acceptance, service start, and payout release wait for settlement.`;
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    return 'Partner is approved but not currently online for direct or marketplace requests.';
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
  if (locationState === 'missing') {
    return 'Partner is online, but no location has been saved yet. Ask them to reopen the Partner app.';
  }
  if (locationState === 'expired') {
    return 'Partner has an old saved location. They should go online again before dispatch.';
  }
  if (locationState === 'stale') {
    return `Partner is live, but the last location is older than ${opsPolicy.staleLocationMinutes} minutes. Confirm before dispatch.`;
  }
  if (!hasHealthyPush(provider)) {
    return 'Partner is live, but push registration should be checked before relying on alerts.';
  }
  const securityState = partnerSecurityStatus(provider);
  if (securityState !== 'clear') {
    return 'Partner has a device/session follow-up item. Review it before dispatching customer bookings.';
  }
  if (!provider.user?.supabaseUserId) {
    return 'Partner is operational in Nest auth. Supabase role sync will become available after Supabase OTP login links this phone.';
  }
  return 'Partner is ready for direct requests and marketplace matching.';
}

export function partnerBackupMatchingEligibility(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
  return buildPartnerMarketplaceEligibility(provider, opsPolicy);
}

export function providerDispatchReady(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
  return (
    !partnerHasHardAcceptanceBlocker(provider) &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
    partnerSecurityStatus(provider) === 'clear' &&
    hasHealthyPush(provider)
  );
}

export function partnerHasHardAcceptanceBlocker(provider: AdminProvider) {
  return (
    Boolean(provider.blockedAt) ||
    provider.verification?.status !== 'APPROVED' ||
    provider.kyc?.status !== 'APPROVED' ||
    !hasApprovedRequiredKycDocuments(provider) ||
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider))
  );
}

export function partnerCanAcceptBookingNow(provider: AdminProvider, opsPolicy: ProviderOpsPolicy) {
  return (
    !partnerHasHardAcceptanceBlocker(provider) &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
    hasHealthyPush(provider)
  );
}

export function providerReviewIssues(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): PartnerReviewIssue[] {
  const issues: PartnerReviewIssue[] = [];
  const kycStatus = provider.kyc?.status ?? 'MISSING';
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';

  if (provider.blockedAt) {
    issues.push({ label: 'account blocked', severity: 'high' });
  }
  if (provider.verification?.status !== 'APPROVED') {
    issues.push({ label: 'verification review', severity: 'high' });
  }
  if (providerPublicMedia(provider).some((file) => file.reviewStatus === 'REJECTED')) {
    issues.push({ label: 'media rejected', severity: 'medium' });
  } else if (providerPublicMediaNeedsReview(provider)) {
    issues.push({ label: 'media pending', severity: 'medium' });
  }
  if (kycStatus !== 'APPROVED') {
    issues.push({ label: `KYC ${kycStatus}`, severity: kycStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  const missingRequiredDocuments = missingApprovedRequiredKycDocuments(provider);
  if (missingRequiredDocuments.length > 0) {
    issues.push({
      label: `identity docs ${missingRequiredDocuments.length}/3 missing`,
      severity: 'high',
    });
  }
  if ((provider.documents ?? []).some((document) => document.status === 'REJECTED')) {
    issues.push({ label: 'document rejected', severity: 'high' });
  } else if ((provider.documents ?? []).some((document) => document.status === 'PENDING_REVIEW')) {
    issues.push({ label: 'document pending', severity: 'medium' });
  }
  if (partnerTaxNeedsReview(provider)) {
    issues.push({ label: `tax record ${taxStatus}`, severity: 'medium' });
  }
  if (partnerHasFirstRevenueSignal(provider) && !provider.residentialAddress?.trim()) {
    issues.push({ label: 'withdrawal address missing', severity: 'high' });
  }
  if (partnerHasFirstRevenueSignal(provider) && (provider.agreements?.length ?? 0) < 5) {
    issues.push({ label: `terms ${(provider.agreements?.length ?? 0).toString()}/5`, severity: 'high' });
  }
  const walletBalance = partnerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    issues.push({ label: `cash debt ${formatProviderMoney(Math.abs(walletBalance))}`, severity: 'high' });
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
  if (locationState !== 'recent') {
    issues.push({
      label: `location ${locationState}`,
      severity: locationState === 'missing' ? 'high' : 'medium',
    });
  }
  const securityState = partnerSecurityStatus(provider);
  if (securityState === 'blocked') {
    issues.push({ label: 'device blocked', severity: 'high' });
  } else if (securityState === 'session-check') {
    issues.push({ label: 'session check', severity: 'high' });
  } else if (securityState === 'shared') {
    issues.push({ label: 'shared device', severity: 'high' });
  } else if (securityState === 'missing') {
    issues.push({ label: 'device missing', severity: 'medium' });
  }
  if (!hasHealthyPush(provider)) {
    issues.push({ label: 'push missing', severity: 'medium' });
  }
  if (!provider.user?.supabaseUserId) {
    issues.push({ label: 'Supabase role pending', severity: 'medium' });
  }
  const openReports = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter(
    (sanction) => sanction.status === 'ACTIVE',
  ).length;
  if (openReports > 0) {
    issues.push({ label: adminCountLabel(openReports, 'open report'), severity: 'high' });
  }
  if (activeSanctions > 0) {
    issues.push({ label: adminCountLabel(activeSanctions, 'active control'), severity: 'high' });
  }

  return issues;
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}
