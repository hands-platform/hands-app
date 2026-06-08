import type { AdminProvider } from '../../lib/admin-api';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../lib/operations-policy';
import { hasApprovedBankAccount, hasHealthyPush } from './partner-list-profile';
import {
  DEFAULT_PROVIDER_OPS_POLICY,
  formatDistanceMeters,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';

export type PartnerMarketplaceBlocker = {
  label: string;
  severity: 'hard' | 'soft';
};

export type PartnerMarketplaceEligibility = {
  eligible: boolean;
  canViewMarketplace: boolean;
  canReceiveMarketplaceAlerts: boolean;
  canParticipateInMarketplace: boolean;
  blockers: PartnerMarketplaceBlocker[];
  walletBalance: number;
  detail: string;
  operatorAction: string;
  partnerAppMessage: string | null;
};

export function buildPartnerMarketplaceEligibility(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): PartnerMarketplaceEligibility {
  const blockers = partnerMarketplaceBlockers(provider, opsPolicy);
  const eligible = blockers.length === 0;
  const walletBalance = providerUnsettledWalletBalance(provider);

  return {
    eligible,
    canViewMarketplace: !provider.blockedAt,
    canReceiveMarketplaceAlerts: eligible,
    canParticipateInMarketplace: eligible,
    blockers,
    walletBalance,
    detail: eligible
      ? `Can receive marketplace alerts and join eligible bookings within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} during the ${opsPolicy.responseWindowMinutes}m first-pick window.`
      : `Marketplace matching needs the listed blockers resolved. Negative wallet blocks marketplace alerts and participation until the HANDS fee debt is settled. Distance is still checked per booking within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )}.`,
    operatorAction: eligible
      ? 'For a live booking, confirm the booking address is inside radius before asking this partner to join.'
      : 'Fix identity, account, location, wallet, or alert blockers before relying on this partner for marketplace participation or customer choice list recovery.',
    partnerAppMessage:
      walletBalance < 0
        ? 'Unpaid HANDS fees must be settled before you can participate in marketplace bookings.'
        : null,
  };
}

export function partnerMarketplaceBlockers(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): PartnerMarketplaceBlocker[] {
  const blockers: PartnerMarketplaceBlocker[] = [];
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);

  if (provider.blockedAt) {
    blockers.push({ label: 'account blocked', severity: 'hard' });
  }
  if (provider.verification?.status !== 'APPROVED') {
    blockers.push({ label: `verification ${provider.verification?.status ?? 'DRAFT'}`, severity: 'hard' });
  }
  if (provider.kyc?.status !== 'APPROVED') {
    blockers.push({ label: `KYC ${provider.kyc?.status ?? 'MISSING'}`, severity: 'hard' });
  }
  if (!hasApprovedRequiredKycDocuments(provider)) {
    blockers.push({ label: 'identity documents', severity: 'hard' });
  }
  if (!hasApprovedBankAccount(provider)) {
    blockers.push({ label: 'bank account', severity: 'hard' });
  }
  if (providerUnsettledWalletBalance(provider) < 0) {
    blockers.push({ label: 'cash fee debt', severity: 'hard' });
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    blockers.push({ label: 'not online available', severity: 'soft' });
  }
  if (locationState !== 'recent') {
    blockers.push({
      label: `location ${locationState}`,
      severity: locationState === 'missing' ? 'hard' : 'soft',
    });
  }
  if (!hasHealthyPush(provider)) {
    blockers.push({ label: 'push missing', severity: 'soft' });
  }
  if (!['clear', 'missing'].includes(securityState)) {
    blockers.push({ label: providerSecurityLabel(securityState).toLowerCase(), severity: 'hard' });
  }

  return blockers;
}

export function providerUnsettledWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status) && !earning.payoutBatchId)
    .reduce((sum, earning) => sum + numberValue(earning.netAmount), 0);
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.every((type) => approvedDocuments.has(type));
}

type ProviderSecurityState =
  | 'clear'
  | 'account-blocked'
  | 'blocked'
  | 'session-check'
  | 'shared'
  | 'missing';

function providerSecurityStatus(provider: AdminProvider): ProviderSecurityState {
  if (provider.blockedAt) {
    return 'account-blocked';
  }
  if ((provider.devices ?? []).some((device) => Boolean(device.blockedAt))) {
    return 'blocked';
  }
  if ((provider.sessions ?? []).some((session) => session.suspicious)) {
    return 'session-check';
  }
  if ((provider.sharedDeviceMatches ?? []).some((match) => Boolean(match.deviceId))) {
    return 'shared';
  }
  if (!(provider.devices ?? []).length && !(provider.sessions ?? []).length) {
    return 'missing';
  }
  return 'clear';
}

function providerSecurityLabel(status: ProviderSecurityState) {
  if (status === 'account-blocked') return 'Account blocked';
  if (status === 'blocked') return 'Device blocked';
  if (status === 'session-check') return 'Session check';
  if (status === 'shared') return 'Shared device';
  if (status === 'missing') return 'No app device';
  return 'Device clear';
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}
