import type { AdminProvider } from '../../lib/admin-api';
import { cashFeeDebtBlocksMarketplaceAlertsParticipationCopy } from '../../lib/booking-wallet-copy';
import {
  hasApprovedBankAccount,
  hasHealthyPush,
  providerPublicMediaNeedsReview,
} from './partner-list-profile';
import { partnerPayoutSetupNeedsReview, partnerTaxNeedsReview } from './partner-finance-readiness-facts';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import { providerLocationStatus, type ProviderOpsPolicy } from './partner-list-ops';
import { partnerHasOpenControl, type PartnerListQueryDeps } from './partner-list-query';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerCommandLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};

export function buildPartnerCommandCenter(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerCommandLane[] {
  const verificationReview = providers.filter(
    (provider) => provider.verification?.status !== 'APPROVED',
  ).length;
  const kycReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED', 'MISSING'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const readyNow = providers.filter((provider) => deps.dispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const locationFresh = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const bankReview = providers.filter(
    (provider) => Boolean(provider.bankAccounts?.length) && !hasApprovedBankAccount(provider),
  ).length;
  const payoutSetupReview = providers.filter(partnerPayoutSetupNeedsReview).length;
  const taxReview = providers.filter(partnerTaxNeedsReview).length;
  const walletDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0).length;
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const openControlItems = providers.filter((provider) => partnerHasOpenControl(provider)).length;
  const deviceFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  ).length;
  const supabasePending = providers.filter((provider) => !provider.user?.supabaseUserId).length;

  return [
    {
      title: 'Onboarding pipeline',
      status: verificationReview + kycReview + documentsReview > 0 ? 'Review needed' : 'Clean',
      tone: verificationReview > 0 || kycReview > 0 ? 'warn' : documentsReview > 0 ? 'info' : 'ok',
      detail:
        verificationReview + kycReview + documentsReview > 0
          ? 'Partners are waiting for identity, verification, or document decisions.'
          : 'No filtered partner is blocked by onboarding review.',
      href: verificationReview > 0 ? '/partners?review=kyc' : '/partners?review=documents',
      metrics: [
        partnerCommandMetric('verification', verificationReview),
        partnerCommandMetric('KYC', kycReview),
        partnerCommandMetric('documents', documentsReview),
        partnerCommandMetric('media', publicMediaReview),
      ],
    },
    {
      title: 'Dispatch readiness',
      status: `${readyNow}/${providers.length} ready`,
      tone: readyNow === providers.length ? 'ok' : readyNow > 0 ? 'info' : 'warn',
      detail:
        readyNow > 0
          ? 'Some partners can receive requests now; keep location and push freshness high.'
          : 'No partner in this filtered list is fully ready for dispatch.',
      href: readyNow > 0 ? '/partners?readiness=ready' : '/partners?review=location',
      metrics: [
        partnerCommandMetric('online', online),
        partnerCommandMetric(`fresh <=${opsPolicy.staleLocationMinutes}m`, locationFresh),
        partnerCommandMetric('push ready', pushReady),
        partnerCommandMetric('Supabase pending', supabasePending),
      ],
    },
    {
      title: 'Withdrawal profile',
      status: walletDebt > 0 || payoutSetupReview > 0 ? 'Finance action' : 'Stable',
      tone: walletDebt > 0 ? 'danger' : payoutSetupReview > 0 || taxReview > 0 ? 'warn' : 'ok',
      detail:
        walletDebt > 0
          ? cashFeeDebtBlocksMarketplaceAlertsParticipationCopy
          : 'Wallet withdrawal address, submitted bank details, and payout agreements are under control.',
      href: walletDebt > 0 ? '/partners?review=cash-debt' : '/partners?review=payout-setup',
      metrics: [
        partnerCommandMetric('submitted bank', bankReview),
        partnerCommandMetric('legacy tax', taxReview),
        partnerCommandMetric('first earning', payoutSetupReview),
        partnerCommandMetric('wallet debt', walletDebt),
      ],
    },
    {
      title: 'Reports and devices',
      status: accountBlocks > 0 || openControlItems > 0 || deviceFollowUp > 0 ? 'Investigate' : 'Clear',
      tone: accountBlocks > 0 || openControlItems > 0 ? 'danger' : deviceFollowUp > 0 ? 'warn' : 'ok',
      detail:
        accountBlocks > 0 || openControlItems > 0
          ? 'Account blocks, reports, or active account controls need operator attention.'
          : 'No filtered partner has open reports, active account controls, or device follow-up items.',
      href: openControlItems > 0 ? '/partners?review=reports' : '/partners?review=security',
      metrics: [
        partnerCommandMetric('blocked', accountBlocks),
        partnerCommandMetric('open reports', openControlItems),
        partnerCommandMetric('device checks', deviceFollowUp),
        partnerCommandMetric(
          'shared device',
          providers.filter((provider) => partnerSecurityStatus(provider) === 'shared').length,
        ),
      ],
    },
  ];
}

function partnerCommandMetric(label: string, value: number) {
  return { label, value: value.toString() };
}
