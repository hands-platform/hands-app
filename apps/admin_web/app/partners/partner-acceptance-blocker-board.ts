import type { AdminProvider } from '../../lib/admin-api';
import { cashFeeDebtBlocksMarketplaceAlertsParticipationCopy } from '../../lib/booking-wallet-copy';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import type { PartnerCommandLane } from './partner-command-center';
import { partnerPayoutSetupNeedsReview } from './partner-finance-readiness-facts';
import { missingApprovedRequiredKycDocuments } from './partner-kyc-facts';
import { providerLocationStatus, type ProviderOpsPolicy } from './partner-list-ops';
import type { PartnerListQueryDeps } from './partner-list-query';
import { hasHealthyPush } from './partner-list-profile';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerAcceptanceBlockerBoard = {
  hardBlocked: number;
  eligibleNow: number;
  marketplaceBlocked: number;
  cards: Array<{
    title: string;
    count: number;
    status: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: PartnerCommandLane['tone'];
    samples: string[];
  }>;
};

export function buildPartnerAcceptanceBlockerBoard(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerAcceptanceBlockerBoard {
  const cashDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0);
  const accountOrSecurity = providers.filter(
    (provider) =>
      Boolean(provider.blockedAt) ||
      ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  );
  const locationHold = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushHold = providers.filter((provider) => !hasHealthyPush(provider));
  const onboardingHold = providers.filter(
    (provider) =>
      provider.verification?.status !== 'APPROVED' ||
      provider.kyc?.status !== 'APPROVED' ||
      !hasApprovedRequiredKycDocuments(provider),
  );
  const firstEarningPayoutGate = providers.filter(partnerPayoutSetupNeedsReview);
  const hardBlocked = providers.filter(deps.hasHardAcceptanceBlocker).length;
  const eligibleNow = providers.filter((provider) => deps.canAcceptBookingNow(provider, opsPolicy)).length;
  const marketplaceBlocked = providers.filter(
    (provider) => !deps.marketplaceEligibility(provider, opsPolicy).eligible,
  ).length;

  return {
    hardBlocked,
    eligibleNow,
    marketplaceBlocked,
    cards: [
      {
        title: 'Cash fee settlement',
        count: cashDebt.length,
        status: cashDebt.length ? 'Blocks marketplace' : 'Clear',
        detail: cashFeeDebtBlocksMarketplaceAlertsParticipationCopy,
        operatorAction:
          'Open the cash debt queue and confirm settlement before allowing marketplace participation.',
        href: '/partners?review=cash-debt',
        tone: cashDebt.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(cashDebt, deps),
      },
      {
        title: 'Account and device controls',
        count: accountOrSecurity.length,
        status: accountOrSecurity.length ? 'Do not dispatch' : 'Clear',
        detail:
          'Blocked accounts, blocked devices, shared devices, or session checks must stay out of matching.',
        operatorAction:
          'Resolve account controls from the Partners security review before overriding any booking decision.',
        href: '/partners?review=security',
        tone: accountOrSecurity.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(accountOrSecurity, deps),
      },
      {
        title: 'Location freshness',
        count: locationHold.length,
        status: locationHold.length ? 'Needs app open' : 'Fresh',
        detail: `Marketplace matching uses the last location. Partners older than ${opsPolicy.staleLocationMinutes} minutes need an app-open refresh before 10km dispatch.`,
        operatorAction:
          'Ask partners to open the app so location refreshes before they receive or join requests.',
        href: '/partners?review=available-blocked-location',
        tone: locationHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(locationHold, deps),
      },
      {
        title: 'Push alert reachability',
        count: pushHold.length,
        status: pushHold.length ? 'Alert gap' : 'Ready',
        detail:
          'Partners without enabled push devices may miss first-pick and marketplace participation prompts.',
        operatorAction:
          'Use in-app refresh, token registration, or direct contact before relying on them for demand.',
        href: '/partners?review=push',
        tone: pushHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(pushHold, deps),
      },
      {
        title: 'Identity and onboarding',
        count: onboardingHold.length,
        status: onboardingHold.length ? 'Review needed' : 'Approved',
        detail:
          'Partners should not receive paid jobs until verification, KYC, and required identity documents are approved.',
        operatorAction: 'Review KYC, documents, public media, and partner approval status in one queue.',
        href: '/partners?review=kyc',
        tone: onboardingHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(onboardingHold, deps),
      },
      {
        title: 'First earning payout gate',
        count: firstEarningPayoutGate.length,
        status: firstEarningPayoutGate.length ? 'Payout locked' : 'Deferred',
        detail:
          'Withdrawal details are requested after first earning, not before Level 2 approval, to reduce onboarding drop-off.',
        operatorAction:
          'Keep booking work possible, but review withdrawal details when the partner requests wallet payout.',
        href: '/notifications?review=payout-setup',
        tone: firstEarningPayoutGate.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(firstEarningPayoutGate, deps),
      },
    ],
  };
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function partnerBlockerSamples(providers: AdminProvider[], deps: PartnerListQueryDeps) {
  return providers.slice(0, 3).map(deps.displayName);
}
