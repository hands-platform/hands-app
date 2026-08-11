import type { AdminProvider } from '../../lib/admin-api';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import type { PartnerCommandLane } from './partner-command-center';
import {
  formatDistanceMeters,
  providerLocationStatus,
  type ProviderOpsPolicy,
} from './partner-list-ops';
import { partnerHasOpenControl, type PartnerListQueryDeps } from './partner-list-query';
import { hasHealthyPush } from './partner-list-profile';

export type PartnerDispatchHandoff = {
  headline: string;
  detail: string;
  policyLabel: string;
  links: Array<{
    title: string;
    value: string;
    detail: string;
    href: string;
    tone: PartnerCommandLane['tone'];
  }>;
};

export function buildPartnerDispatchHandoff(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerDispatchHandoff {
  const directReady = providers.filter((provider) => deps.canAcceptBookingNow(provider, opsPolicy));
  const backupReady = providers.filter(
    (provider) => deps.marketplaceEligibility(provider, opsPolicy).eligible,
  );
  const acceptanceBlocked = providers.filter((provider) => !deps.canAcceptBookingNow(provider, opsPolicy));
  const cashDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0);
  const locationRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushRepair = providers.filter((provider) => !hasHealthyPush(provider));
  const reportReview = providers.filter((provider) => partnerHasOpenControl(provider));

  return {
    headline:
      'When Bookings shows matching pressure, jump from here to the exact partner lane that can unblock dispatch.',
    detail: `Current policy: first partner response window ${opsPolicy.responseWindowMinutes}m, marketplace radius ${formatDistanceMeters(
      opsPolicy.backupRadiusMeters,
    )}, fresh location within ${opsPolicy.staleLocationMinutes}m.`,
    policyLabel: 'Edit dispatch policy',
    links: [
      {
        title: 'Matching queue',
        value: 'Open',
        detail: 'Live bookings waiting for preferred response, marketplace supply, or customer selection.',
        href: '/bookings?view=matching',
        tone: 'info',
      },
      {
        title: 'Direct ready',
        value: directReady.length.toString(),
        detail: 'Partners who can receive the first customer request immediately.',
        href: '/partners?review=ready-now',
        tone: directReady.length ? 'ok' : 'warn',
      },
      {
        title: 'Marketplace ready',
        value: backupReady.length.toString(),
        detail: 'Partners eligible to receive marketplace alerts and join the customer choice list.',
        href: '/partners?review=ready-now',
        tone: backupReady.length ? 'ok' : 'warn',
      },
      {
        title: 'Acceptance blocked',
        value: acceptanceBlocked.length.toString(),
        detail:
          'Partners blocked from direct requests by KYC, location, push, control, or wallet settlement gates.',
        href: '/partners?review=available-blocked',
        tone: acceptanceBlocked.length ? 'danger' : 'ok',
      },
      {
        title: 'Cash fee debt',
        value: cashDebt.length.toString(),
        detail:
          'Negative wallet Partners can view marketplace requests, but final acceptance, service start, and payout release wait until company fee settlement.',
        href: '/cash-settlements',
        tone: cashDebt.length ? 'danger' : 'ok',
      },
      {
        title: 'Location refresh',
        value: locationRefresh.length.toString(),
        detail: 'Partners who must reopen the app before distance-based matching uses their location.',
        href: '/partners?review=available-blocked-location',
        tone: locationRefresh.length ? 'warn' : 'ok',
      },
      {
        title: 'Push repair',
        value: pushRepair.length.toString(),
        detail: 'Partners who may miss direct or marketplace request alerts.',
        href: '/partners?review=push',
        tone: pushRepair.length ? 'warn' : 'ok',
      },
      {
        title: 'Reports desk',
        value: reportReview.length.toString(),
        detail: 'Partners with reports or account controls that should be checked before dispatch.',
        href: '/partners?review=reports',
        tone: reportReview.length ? 'danger' : 'info',
      },
    ],
  };
}
