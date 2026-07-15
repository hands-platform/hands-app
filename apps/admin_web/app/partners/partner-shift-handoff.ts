import type { AdminProvider } from '../../lib/admin-api';
import { partnerUnsettledWalletBalance } from './partner-activity-facts';
import type { PartnerCommandLane } from './partner-command-center';
import { partnerPayoutSetupNeedsReview } from './partner-finance-readiness-facts';
import { partnerKycState } from './partner-kyc-facts';
import type { PartnerListQueryDeps } from './partner-list-query';
import { hasHealthyPush, providerPublicMediaNeedsReview } from './partner-list-profile';
import { providerLocationStatus, type ProviderOpsPolicy } from './partner-list-ops';
import { partnerSecurityStatus } from './partner-security-facts';

export type PartnerShiftHandoff = {
  tone: PartnerCommandLane['tone'];
  label: string;
  headline: string;
  detail: string;
  primaryAction: { label: string; href: string };
  stats: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    tone: PartnerCommandLane['tone'];
  }>;
  actions: Array<{
    title: string;
    scope: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: PartnerCommandLane['tone'];
    samples: string[];
  }>;
};

export function buildPartnerShiftHandoff(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  deps: PartnerListQueryDeps,
): PartnerShiftHandoff {
  const acceptReady = providers.filter((provider) => deps.canAcceptBookingNow(provider, opsPolicy));
  const backupReady = providers.filter(
    (provider) => deps.marketplaceEligibility(provider, opsPolicy).eligible,
  );
  const hardBlocked = providers.filter(deps.hasHardAcceptanceBlocker);
  const cashDebt = providers.filter((provider) => partnerUnsettledWalletBalance(provider) < 0);
  const readyKyc = providers.filter((provider) => partnerKycState(provider).readyToApprove);
  const kycBlocked = providers.filter((provider) => {
    const kycState = partnerKycState(provider);
    return (
      kycState.blockedByDocuments || kycState.rejectedDocuments > 0 || provider.kyc?.status === 'REJECTED'
    );
  });
  const locationRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushMissing = providers.filter((provider) => !hasHealthyPush(provider));
  const payoutSetup = providers.filter(partnerPayoutSetupNeedsReview);
  const accountControlFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(partnerSecurityStatus(provider)),
  );
  const publicMedia = providers.filter(providerPublicMediaNeedsReview);

  const actions = [
    cashDebt.length
      ? {
          title: 'Collect cash-fee debt before more bookings',
          scope: 'Finance gate',
          detail: `${cashDebt.length} partner(s) have negative wallet balance from cash-service fee or tax debt.`,
          operatorAction:
            'Collect company fee deposit, record evidence, or offset from available earnings before final acceptance, service start, or payout release resumes.',
          href: '/partners?review=cash-debt',
          tone: 'danger' as const,
          samples: partnerSampleNames(cashDebt, deps),
        }
      : null,
    readyKyc.length
      ? {
          title: 'Approve KYC records that are ready',
          scope: 'KYC review',
          detail: `${readyKyc.length} partner(s) have required CCCD/selfie evidence ready for admin decision.`,
          operatorAction:
            'Open each detail page, verify evidence, then approve or reject with a clear reason.',
          href: '/partners?review=kyc',
          tone: 'warn' as const,
          samples: partnerSampleNames(readyKyc, deps),
        }
      : null,
    kycBlocked.length
      ? {
          title: 'Request KYC resubmission where evidence is blocked',
          scope: 'Identity blocker',
          detail: `${kycBlocked.length} partner(s) cannot move forward because identity evidence is missing or rejected.`,
          operatorAction:
            'Use rejection reasons and resubmission guidance before the partner can become dispatch-ready.',
          href: '/partners?review=documents',
          tone: 'warn' as const,
          samples: partnerSampleNames(kycBlocked, deps),
        }
      : null,
    payoutSetup.length
      ? {
          title: 'Finish first-earning payout profile',
          scope: 'Payout gate',
          detail: `${payoutSetup.length} partner(s) have revenue records but still need withdrawal address or agreement readiness.`,
          operatorAction:
            'Ask for withdrawal address and terms only after first revenue, then review before withdrawal.',
          href: '/partners?review=payout-setup',
          tone: 'warn' as const,
          samples: partnerSampleNames(payoutSetup, deps),
        }
      : null,
    accountControlFollowUp.length
      ? {
          title: 'Review device or account controls before dispatch',
          scope: 'Control gate',
          detail: `${accountControlFollowUp.length} partner(s) have blocked devices, session checks, shared devices, or account block state.`,
          operatorAction: 'Open partner control history before relying on them for customer bookings.',
          href: '/partners?review=security',
          tone: 'danger' as const,
          samples: partnerSampleNames(accountControlFollowUp, deps),
        }
      : null,
    locationRefresh.length
      ? {
          title: 'Refresh partner locations for dispatch accuracy',
          scope: 'Location',
          detail: `${locationRefresh.length} partner(s) need a current location before direct request or marketplace matching.`,
          operatorAction: `Ask partners to open the app; location must be fresh within ${opsPolicy.staleLocationMinutes} minutes.`,
          href: '/partners?review=location',
          tone: acceptReady.length ? ('info' as const) : ('warn' as const),
          samples: partnerSampleNames(locationRefresh, deps),
        }
      : null,
    pushMissing.length
      ? {
          title: 'Repair request alert readiness',
          scope: 'Alerts',
          detail: `${pushMissing.length} partner(s) have no enabled push device, so urgent booking alerts may be missed.`,
          operatorAction:
            'Ask partners to reopen the app and register notifications before relying on push outreach.',
          href: '/partners?review=push',
          tone: 'info' as const,
          samples: partnerSampleNames(pushMissing, deps),
        }
      : null,
    publicMedia.length
      ? {
          title: 'Moderate public partner media',
          scope: 'Profile',
          detail: `${publicMedia.length} partner(s) have profile/gallery media waiting for admin review.`,
          operatorAction:
            'Approve original, safe media or reject unclear uploads before final visual redesign.',
          href: '/partners?review=public-media',
          tone: 'info' as const,
          samples: partnerSampleNames(publicMedia, deps),
        }
      : null,
    acceptReady.length
      ? {
          title: 'Keep ready partners warm for live requests',
          scope: 'Dispatch supply',
          detail: `${acceptReady.length} partner(s) can receive direct bookings now; ${backupReady.length} are also marketplace-ready.`,
          operatorAction: 'Use these partners first when matching demand spikes or customer wait time rises.',
          href: '/partners?review=direct-ready',
          tone: 'ok' as const,
          samples: partnerSampleNames(acceptReady, deps),
        }
      : null,
  ].filter((item): item is PartnerShiftHandoff['actions'][number] => Boolean(item));

  const topAction =
    actions.find((item) => item.tone === 'danger') ??
    actions.find((item) => item.tone === 'warn') ??
    actions[0];
  const tone =
    cashDebt.length || accountControlFollowUp.length
      ? 'danger'
      : hardBlocked.length || readyKyc.length || payoutSetup.length
        ? 'warn'
        : acceptReady.length
          ? 'ok'
          : 'info';

  return {
    tone,
    label:
      tone === 'danger'
        ? 'Immediate check'
        : tone === 'warn'
          ? 'Action needed'
          : tone === 'ok'
            ? 'Dispatch ready'
            : 'Monitor',
    headline: topAction?.title ?? 'No urgent partner operation item',
    detail:
      topAction?.operatorAction ??
      'The active filters have no immediate Partner blocker. Keep monitoring booking demand, location freshness, and cash debt.',
    primaryAction: {
      label: topAction ? 'Open partner work queue' : 'Open dispatch-ready partners',
      href: topAction?.href ?? '/partners?review=direct-ready',
    },
    stats: [
      {
        label: 'Direct request ready',
        value: acceptReady.length.toString(),
        detail: `${backupReady.length} marketplace-ready within current policy gates.`,
        href: '/partners?review=direct-ready',
        tone: acceptReady.length ? 'ok' : 'warn',
      },
      {
        label: 'Hard blocked',
        value: hardBlocked.length.toString(),
        detail:
          'Account, KYC, device/session, identity, or wallet settlement blockers for direct partner work.',
        href: '/partners?review=acceptance-blocked',
        tone: hardBlocked.length ? 'danger' : 'ok',
      },
      {
        label: 'Cash debt',
        value: cashDebt.length.toString(),
        detail: 'Negative wallet blocks final acceptance, service start, and payout release.',
        href: '/partners?review=cash-debt',
        tone: cashDebt.length ? 'danger' : 'ok',
      },
      {
        label: 'KYC ready',
        value: readyKyc.length.toString(),
        detail: 'Identity evidence ready for admin decision.',
        href: '/partners?review=kyc',
        tone: readyKyc.length ? 'warn' : 'ok',
      },
      {
        label: 'Location refresh',
        value: locationRefresh.length.toString(),
        detail: `Fresh location policy is ${opsPolicy.staleLocationMinutes} minutes.`,
        href: '/partners?review=location',
        tone: locationRefresh.length ? 'warn' : 'ok',
      },
      {
        label: 'Payout profile',
        value: payoutSetup.length.toString(),
        detail: 'First-revenue address and payout agreement review.',
        href: '/partners?review=payout-setup',
        tone: payoutSetup.length ? 'warn' : 'ok',
      },
    ],
    actions: actions.slice(0, 6),
  };
}

export function partnerShiftCardClass(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'ops-task-blocked';
  if (tone === 'warn') return 'ops-task-pending';
  return 'ops-task-done';
}

export function partnerShiftPillClass(tone: PartnerCommandLane['tone']) {
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-success';
}

function partnerSampleNames(providers: AdminProvider[], deps: PartnerListQueryDeps, limit = 4) {
  return providers.slice(0, limit).map(deps.displayName);
}
