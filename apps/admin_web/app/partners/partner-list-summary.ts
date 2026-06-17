import type { AdminProvider } from '../../lib/admin-api';
import { partnerCashDebtMarketplaceAccessCopy } from '../../lib/booking-wallet-copy';
import {
  hasApprovedBankAccount,
  hasHealthyPush,
  providerPublicMediaNeedsReview,
} from './partner-list-profile';
import {
  missingApprovedRequiredKycDocuments,
  partnerNeedsKycReview,
} from './partner-kyc-facts';
import {
  partnerPayoutSetupNeedsReview,
  partnerTaxNeedsReview,
} from './partner-finance-readiness-facts';
import {
  partnerUnsettledWalletBalance,
} from './partner-activity-facts';
import {
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import {
  partnerHasOpenControl,
  type PartnerListQueryDeps,
} from './partner-list-query';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerSummaryItem = readonly [string, string];

export type PartnerFilterSummaryItem = {
  label: string;
  value: string;
  detail: string;
  href?: string;
};

export type PartnerReviewQueueItem = {
  label: string;
  count: number;
  href: string;
  detail: string;
};

export type PartnerReviewQueue = {
  items: PartnerReviewQueueItem[];
  totalOpen: number;
};

export function buildPartnerSummary(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerSummaryItem[] {
  const accountBlocked = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const approved = providers.filter((provider) => provider.verification?.status === 'APPROVED').length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const recentLocation = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const staleLocation = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const pushDisabled = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => !device.enabled),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const payoutSetupReview = providers.filter(partnerPayoutSetupNeedsReview).length;
  const walletDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0).length;
  const openControlItems = providers.filter((provider) => partnerHasOpenControl(provider)).length;
  const deviceFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  ).length;
  const readyNow = providers.filter((provider) => deps.dispatchReady(provider, opsPolicy)).length;

  return [
    ['Total partners', providers.length.toString()],
    ['Account blocked', accountBlocked.toString()],
    ['Approved', approved.toString()],
    ['Online now', online.toString()],
    [`Recent location <=${opsPolicy.staleLocationMinutes}m`, recentLocation.toString()],
    ['Location needs review', staleLocation.toString()],
    ['Push ready', pushReady.toString()],
    ['Push needs review', pushDisabled.toString()],
    ['Public media review', publicMediaReview.toString()],
    ['First earning setup', payoutSetupReview.toString()],
    ['Wallet debt', walletDebt.toString()],
    ['Open reports', openControlItems.toString()],
    ['Device checks', deviceFollowUp.toString()],
    ['Ready for dispatch', readyNow.toString()],
  ];
}

export function buildPartnerFilterSummary(
  providers: AdminProvider[],
  allProviders: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  activeFilterCount: number,
  deps: PartnerListQueryDeps,
): PartnerFilterSummaryItem[] {
  const directReady = providers.filter((provider) => deps.canAcceptBookingNow(provider, opsPolicy)).length;
  const backupReady = providers.filter(
    (provider) => deps.marketplaceEligibility(provider, opsPolicy).eligible,
  ).length;
  const walletDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0).length;
  const locationNeedsRefresh = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) !== 'recent',
  ).length;
  const kycOrDocumentWork = providers.filter(
    (provider) =>
      partnerNeedsKycReview(provider) ||
      missingApprovedRequiredKycDocuments(provider).length > 0 ||
      (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;

  return [
    {
      label: 'Filtered rows',
      value: `${providers.length}/${allProviders.length}`,
      detail:
        activeFilterCount > 0
          ? `${activeFilterCount} active filter(s) are narrowing the partner list`
          : 'No active filters, full partner list is available for export',
    },
    {
      label: 'Direct ready',
      value: directReady.toString(),
      detail: 'Can receive a direct customer request with current policy gates',
      href: '/partners?review=direct-ready',
    },
    {
      label: 'Marketplace ready',
      value: backupReady.toString(),
      detail: 'Can participate in open marketplace matching under current operating policy',
      href: '/partners?review=marketplace-ready',
    },
    {
      label: 'Wallet settlement',
      value: walletDebt.toString(),
      detail: 'Negative wallet balance blocks marketplace alerts and participation',
      href: '/partners?review=cash-debt',
    },
    {
      label: 'Location refresh',
      value: locationNeedsRefresh.toString(),
      detail: `Location older than ${opsPolicy.staleLocationMinutes}m, expired, or missing`,
      href: '/partners?review=location',
    },
    {
      label: 'KYC/doc work',
      value: kycOrDocumentWork.toString(),
      detail: 'Identity, selfie, or required document items needing completion or review',
      href: '/partners?review=kyc',
    },
    {
      label: 'Push reachable',
      value: pushReady.toString(),
      detail: 'Partners with an enabled push device for request alerts',
      href: '/partners?review=push',
    },
  ];
}

export function buildPartnerReviewQueue(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerReviewQueue {
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const kycNeedsReview = providers.filter(partnerNeedsKycReview).length;
  const documentNeedsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaNeedsReview = providers.filter(providerPublicMediaNeedsReview).length;
  const bankNeedsReview = providers.filter((provider) => !hasApprovedBankAccount(provider)).length;
  const payoutSetupNeedsReview = providers.filter(partnerPayoutSetupNeedsReview).length;
  const cashDebtNeedsReview = providers.filter(
    (provider) => partnerUnsettledWalletBalance(provider) < 0,
  ).length;
  const taxNeedsReview = providers.filter(partnerTaxNeedsReview).length;
  const locationNeedsReview = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushNeedsReview = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const securityNeedsReview = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  ).length;
  const reportNeedsReview = providers.filter((provider) => partnerHasOpenControl(provider)).length;
  const directReady = providers.filter((provider) => deps.canAcceptBookingNow(provider, opsPolicy)).length;
  const backupReady = providers.filter(
    (provider) => deps.marketplaceEligibility(provider, opsPolicy).eligible,
  ).length;
  const acceptanceBlocked = providers.filter(
    (provider) => !deps.canAcceptBookingNow(provider, opsPolicy),
  ).length;

  const items: PartnerReviewQueueItem[] = [
    {
      label: 'Direct request held',
      count: acceptanceBlocked,
      href: '/partners?review=acceptance-blocked',
      detail:
        'Partners who cannot receive direct requests now because identity, bank, location, push, or control gates are not satisfied.',
    },
    {
      label: 'Account blocks',
      count: accountBlocks,
      href: '/partners?review=blocked',
      detail:
        'Partners blocked by admin cannot go online, refresh location, or appear in customer discovery.',
    },
    {
      label: 'KYC updates',
      count: kycNeedsReview,
      href: '/partners?review=kyc',
      detail:
        'Partners with missing, pending, rejected, or document-blocked identity verification need admin review.',
    },
    {
      label: 'Document review',
      count: documentNeedsReview,
      href: '/partners?review=documents',
      detail: 'Typed CCCD, selfie, or portfolio documents are waiting for approval or rejection handling.',
    },
    {
      label: 'Public media review',
      count: publicMediaNeedsReview,
      href: '/partners?review=public-media',
      detail: 'Uploaded public profile and gallery images must be approved before customers can see them.',
    },
    {
      label: 'Bank payout review',
      count: bankNeedsReview,
      href: '/partners?review=bank',
      detail: 'At least one bank account must be approved before partners can receive paid booking work.',
    },
    {
      label: 'First earning payout setup',
      count: payoutSetupNeedsReview,
      href: '/partners?review=payout-setup',
      detail:
        'Partners with first revenue who still need tax profile, tax address, or payout agreements before withdrawal.',
    },
    {
      label: 'Cash fee debt',
      count: cashDebtNeedsReview,
      href: '/partners?review=cash-debt',
      detail: partnerCashDebtMarketplaceAccessCopy,
    },
    {
      label: 'Tax profile review',
      count: taxNeedsReview,
      href: '/partners?review=tax',
      detail: 'Freelance tax profiles should be approved only after MST and registered address are checked.',
    },
    {
      label: 'Device/session review',
      count: securityNeedsReview,
      href: '/partners?review=security',
      detail: 'Blocked, shared, or checked partner app devices need operator review.',
    },
    {
      label: 'Reports and account controls',
      count: reportNeedsReview,
      href: '/partners?review=reports',
      detail:
        'Open reports or active account controls should be reviewed before dispatch and profile review changes.',
    },
    {
      label: 'Location freshness',
      count: locationNeedsReview,
      href: '/partners?review=location',
      detail: `Partners with missing, expired, or older-than-${opsPolicy.staleLocationMinutes}m locations should reopen the Partner app before dispatch.`,
    },
    {
      label: 'Push alert readiness',
      count: pushNeedsReview,
      href: '/partners?review=push',
      detail:
        'Partners without enabled push devices may miss direct requests and marketplace matching alerts.',
    },
    {
      label: 'Direct request ready',
      count: directReady,
      href: '/partners?review=direct-ready',
      detail: 'Partners who can receive and accept a preferred direct booking right now.',
    },
    {
      label: 'Marketplace ready',
      count: backupReady,
      href: '/partners?review=marketplace-ready',
      detail:
        'Partners who can receive marketplace alerts and join customer choice lists under current policy.',
    },
  ];

  const totalOpen = items
    .filter((item) => !['Direct request ready', 'Marketplace ready'].includes(item.label))
    .reduce((sum, item) => sum + item.count, 0);

  return { items, totalOpen };
}
