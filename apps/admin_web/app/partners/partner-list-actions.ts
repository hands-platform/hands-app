import type { AdminProvider } from '../../lib/admin-api';
import { providerDocumentLabel } from '../../lib/admin-api';
import { formatMoney as formatProviderMoney } from '../../lib/admin-format';
import {
  DEFAULT_PROVIDER_OPS_POLICY,
  providerLocationAgeLabel,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import {
  hasApprovedBankAccount,
  hasHealthyPush,
  providerPublicMediaNeedsReview,
} from './partner-list-profile';
import { missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import { partnerHasFirstRevenueSignal } from './partner-finance-readiness-facts';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import { partnerSecurityStatus } from './partner-security-facts';

export type ProviderListAction = {
  status: string;
  detail: string;
  operatorAction: string;
  tone: 'done' | 'pending' | 'blocked';
  priority: number;
};

export function nextPartnerListAction(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): ProviderListAction {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const firstRevenueSignal = partnerHasFirstRevenueSignal(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = partnerSecurityStatus(provider);
  const walletBalance = partnerUnsettledWalletBalance(provider);

  if (provider.blockedAt) {
    return {
      status: 'ACCOUNT',
      detail: `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`,
      operatorAction: 'Unblock only after identity, safety, payout, or policy issue is resolved.',
      tone: 'blocked',
      priority: 120,
    };
  }
  if (!provider.displayName?.trim() || !provider.legalName?.trim()) {
    return {
      status: 'PROFILE',
      detail: 'Basic profile is incomplete.',
      operatorAction: 'Ask partner to complete display name and legal name before approval.',
      tone: 'blocked',
      priority: 100,
    };
  }
  if (missingDocuments.length > 0) {
    return {
      status: 'DOCUMENTS',
      detail: `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      operatorAction: 'Open detail and review each typed KYC document.',
      tone: 'blocked',
      priority: 95,
    };
  }
  if (provider.kyc?.status !== 'APPROVED') {
    return {
      status: 'KYC',
      detail: `KYC status is ${provider.kyc?.status ?? 'MISSING'}.`,
      operatorAction: 'Approve or reject KYC with a clear reason.',
      tone: 'blocked',
      priority: provider.kyc?.status === 'REJECTED' ? 92 : 90,
    };
  }
  if (provider.verification?.status !== 'APPROVED') {
    return {
      status: 'VERIFY',
      detail: `Partner verification is ${provider.verification?.status ?? 'DRAFT'}.`,
      operatorAction: 'Approve partner verification when identity review is complete.',
      tone: 'blocked',
      priority: 86,
    };
  }
  if (walletBalance < 0) {
    return {
      status: 'CASH DEBT',
      detail: `Wallet is negative by ${formatProviderMoney(Math.abs(walletBalance))}.`,
      operatorAction:
        'Confirm partner fee deposit or settle the cash fee debt before marketplace alerts and participation.',
      tone: 'blocked',
      priority: 85,
    };
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return {
      status: 'MEDIA',
      detail: 'Public profile or gallery media is waiting for admin review.',
      operatorAction: 'Approve safe, original public media or reject unclear uploads with a reason.',
      tone: 'pending',
      priority: 84,
    };
  }
  if (!hasApprovedBankAccount(provider)) {
    return {
      status: 'BANK',
      detail: `Primary bank account is ${primaryBank?.status ?? 'missing'}.`,
      operatorAction: 'Approve or reject bank details before payout readiness.',
      tone: 'blocked',
      priority: primaryBank?.status === 'REJECTED' ? 82 : 80,
    };
  }
  if (firstRevenueSignal && provider.taxProfile?.status !== 'APPROVED') {
    return {
      status: 'TAX',
      detail: `Partner has first earning, but tax profile is ${provider.taxProfile?.status ?? 'missing'}.`,
      operatorAction: 'Approve/reject freelance tax profile before the partner can withdraw earnings.',
      tone: 'blocked',
      priority: provider.taxProfile?.status === 'REJECTED' ? 76 : 74,
    };
  }
  if (firstRevenueSignal && !provider.residentialAddress?.trim()) {
    return {
      status: 'TAX ADDRESS',
      detail: 'Partner has first earning, but residential/tax address is missing.',
      operatorAction: 'Ask partner to add the address needed for tax and payout records.',
      tone: 'blocked',
      priority: 72,
    };
  }
  if (firstRevenueSignal && agreementsAccepted < 5) {
    return {
      status: 'TERMS',
      detail: `Payout agreements are ${agreementsAccepted}/5.`,
      operatorAction: 'Ask partner to accept missing payout/tax/location agreements.',
      tone: 'blocked',
      priority: 70,
    };
  }
  if (securityState === 'account-blocked') {
    return {
      status: 'ACCOUNT',
      detail: 'The partner account is blocked by admin policy.',
      operatorAction: 'Open partner detail and unblock only after the recorded issue is resolved.',
      tone: 'blocked',
      priority: 69,
    };
  }
  if (securityState === 'blocked') {
    return {
      status: 'DEVICE',
      detail: 'At least one partner app device is blocked.',
      operatorAction: 'Open partner detail and decide whether to unblock or keep the device blocked.',
      tone: 'blocked',
      priority: 68,
    };
  }
  if (securityState === 'session-check' || securityState === 'shared') {
    return {
      status: 'SECURITY',
      detail:
        securityState === 'shared'
          ? 'A device appears on more than one partner profile.'
          : 'Recent partner session has a session check record.',
      operatorAction: 'Review device/session history before relying on this partner for dispatch.',
      tone: 'blocked',
      priority: 67,
    };
  }
  if (locationState !== 'recent') {
    return {
      status: 'LOCATION',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
      operatorAction: 'Ask partner to open the app and refresh current location.',
      tone: locationState === 'missing' ? 'blocked' : 'pending',
      priority: locationState === 'missing' ? 66 : 58,
    };
  }
  if (!hasHealthyPush(provider)) {
    return {
      status: 'PUSH',
      detail: 'No enabled push device is available for request alerts.',
      operatorAction: 'Ask partner to reopen the app and register alerts.',
      tone: 'pending',
      priority: 54,
    };
  }
  if (!provider.user?.supabaseUserId) {
    return {
      status: 'SUPABASE',
      detail: 'Partner is still on Nest auth only.',
      operatorAction: 'Sync/link Supabase role after Supabase OTP login is active.',
      tone: 'pending',
      priority: 35,
    };
  }
  return {
    status: 'CLEAR',
    detail: 'No partner operation blocker is visible.',
    operatorAction: 'Monitor dispatch and service quality.',
    tone: 'done',
    priority: 0,
  };
}

export function partnerListActionPillClass(tone: ProviderListAction['tone']) {
  if (tone === 'done') return 'pill-success';
  if (tone === 'blocked') return 'pill-danger';
  return 'pill-warn';
}
