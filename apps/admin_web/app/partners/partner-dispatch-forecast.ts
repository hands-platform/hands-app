import type { AdminProvider } from '../../lib/admin-api';
import type { PartnerCommandLane } from './partner-command-center';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import { partnerPayoutSetupNeedsReview } from './partner-finance-readiness-facts';
import { type ProviderOpsPolicy, providerLocationStatus } from './partner-list-ops';
import { hasHealthyPush } from './partner-list-profile';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerDispatchForecast = {
  totals: Array<{
    label: string;
    value: string;
    detail: string;
    tone: PartnerCommandLane['tone'];
    href: string;
  }>;
  blockers: Array<{
    label: string;
    count: number;
    detail: string;
    href: string;
    tone: PartnerCommandLane['tone'];
  }>;
  supplyLanes: Array<{
    city: string;
    total: number;
    ready: number;
    online: number;
    locationNeedsRefresh: number;
    blocked: number;
  }>;
};

type PartnerDispatchForecastDeps = {
  dispatchReady: (provider: AdminProvider, opsPolicy: ProviderOpsPolicy) => boolean;
  hasHardAcceptanceBlocker: (provider: AdminProvider) => boolean;
};

export function buildPartnerDispatchForecast(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerDispatchForecastDeps,
): PartnerDispatchForecast {
  const readyNow = providers.filter((provider) => deps.dispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const bookingBase = providers.filter((provider) => !deps.hasHardAcceptanceBlocker(provider)).length;
  const locationNeedsRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushMissing = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const walletDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0).length;
  const deviceSessionFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  ).length;
  const hardBlocked = providers.filter(deps.hasHardAcceptanceBlocker).length;
  const payoutLocked = providers.filter(partnerPayoutSetupNeedsReview).length;
  const approvedOffline = providers.filter(
    (provider) => !deps.hasHardAcceptanceBlocker(provider) && provider.status !== 'ONLINE_AVAILABLE',
  ).length;
  const recoverableNow = providers.filter((provider) => {
    if (deps.dispatchReady(provider, opsPolicy)) return false;
    if (deps.hasHardAcceptanceBlocker(provider)) return false;
    if (!['clear', 'missing'].includes(partnerSecurityStatus(provider))) return false;
    return (
      provider.status !== 'ONLINE_AVAILABLE' ||
      providerLocationStatus(provider, opsPolicy) !== 'recent' ||
      !hasHealthyPush(provider)
    );
  }).length;

  return {
    totals: [
      {
        label: 'Ready now',
        value: `${readyNow}/${providers.length}`,
        detail: 'Approved, online, fresh location, clear device checks, and push-ready partners.',
        tone: readyNow > 0 ? 'ok' : 'warn',
        href: '/partners?review=ready-now',
      },
      {
        label: 'Recoverable today',
        value: recoverableNow.toString(),
        detail:
          'Approved partners likely recoverable by going online, refreshing location, or enabling push.',
        tone: recoverableNow > 0 ? 'info' : 'ok',
        href: recoverableNow > 0 ? '/partners?verification=APPROVED&providerStatus=OFFLINE&kyc=APPROVED' : '/partners',
      },
      {
        label: 'Online capacity',
        value: `${online}/${bookingBase}`,
        detail:
          'Partners currently online versus the pool that has passed identity and account gates.',
        tone: online > 0 ? 'info' : bookingBase > 0 ? 'warn' : 'danger',
        href: '/partners?providerStatus=ONLINE_AVAILABLE',
      },
      {
        label: 'Hard blockers',
        value: hardBlocked.toString(),
        detail:
          'Identity, account, or device/session blockers that should not be bypassed by dispatch.',
        tone: hardBlocked > 0 ? 'danger' : 'ok',
        href: hardBlocked > 0 ? '/partners?review=available-blocked' : '/partners?review=security',
      },
    ],
    blockers: [
      {
        label: 'Location refresh',
        count: locationNeedsRefresh,
        detail: `Partner location is missing, expired, or older than ${opsPolicy.staleLocationMinutes} minutes.`,
        href: '/partners?review=available-blocked-location',
        tone: locationNeedsRefresh > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Push alerts missing',
        count: pushMissing,
        detail: 'Direct booking and marketplace matching alerts may not reach these partners.',
        href: '/partners?review=push',
        tone: pushMissing > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Approved but offline',
        count: approvedOffline,
        detail: 'Approved partners who can become useful supply once they open the Partner app.',
        href: '/partners?verification=APPROVED&providerStatus=OFFLINE&kyc=APPROVED',
        tone: approvedOffline > 0 ? 'info' : 'ok',
      },
      {
        label: 'Wallet debt',
        count: walletDebt,
        detail:
          'Cash fee debt may keep demand visible, but final acceptance, service start, and payout release wait for settlement.',
        href: '/partners?review=cash-debt',
        tone: walletDebt > 0 ? 'danger' : 'ok',
      },
      {
        label: 'Wallet setup',
        count: payoutLocked,
        detail: 'First-earning partners who still need wallet withdrawal/deposit follow-up or agreement completion.',
        href: '/notifications?review=payout-setup',
        tone: payoutLocked > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Device/session review',
        count: deviceSessionFollowUp,
        detail: 'Blocked, shared, checked, or account-blocked partner devices/sessions.',
        href: '/partners?review=security',
        tone: deviceSessionFollowUp > 0 ? 'danger' : 'ok',
      },
    ],
    supplyLanes: buildPartnerSupplyLanes(providers, opsPolicy, deps),
  };
}

function buildPartnerSupplyLanes(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerDispatchForecastDeps,
) {
  const lanes = new Map<string, PartnerDispatchForecast['supplyLanes'][number]>();

  for (const provider of providers) {
    const city = provider.city?.trim() || 'Unknown city';
    const lane = lanes.get(city) ?? {
      city,
      total: 0,
      ready: 0,
      online: 0,
      locationNeedsRefresh: 0,
      blocked: 0,
    };

    lane.total += 1;
    if (deps.dispatchReady(provider, opsPolicy)) {
      lane.ready += 1;
    }
    if (provider.status === 'ONLINE_AVAILABLE') {
      lane.online += 1;
    }
    if (providerLocationStatus(provider, opsPolicy) !== 'recent') {
      lane.locationNeedsRefresh += 1;
    }
    if (
      provider.blockedAt ||
      provider.verification?.status !== 'APPROVED' ||
      partnerUnsettledWalletBalance(provider) < 0 ||
      ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider))
    ) {
      lane.blocked += 1;
    }
    lanes.set(city, lane);
  }

  return Array.from(lanes.values())
    .sort((left, right) => {
      if (left.ready !== right.ready) return right.ready - left.ready;
      if (left.online !== right.online) return right.online - left.online;
      if (left.total !== right.total) return right.total - left.total;
      return left.city.localeCompare(right.city);
    })
    .slice(0, 6);
}
