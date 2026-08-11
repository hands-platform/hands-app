import { MoneyText } from '../../../components/money-text';
import type { ReactNode } from 'react';
import { marketplaceDisplayText } from '../../../lib/admin-copy';
import { providerDocumentLabel } from '../../../lib/admin-api';
import { buildPartnerControlDetailsHref } from '../../partner-controls/partner-control-page-load-plan';
import type { PartnerAcceptanceUnblockStep } from './partner-detail-acceptance-unblock-playbook-section';
import {
  hasApprovedRequiredKycDocuments,
  missingApprovedRequiredKycDocuments,
} from './partner-detail-kyc-evidence-model';
import {
  formatCurrency,
  formatDistance,
  locationAgeLabel,
  locationAgeMinutes,
} from './partner-detail-format';
import {
  buildProviderPayoutOps,
  cashFeeDebtAmount,
  primaryBankAccount,
  providerHasFirstRevenueSignal,
} from './partner-detail-payout-security-model';
import type {
  PartnerAcceptanceRepairCommandView,
  PartnerReadinessSnapshotBadge,
} from './partner-detail-readiness-command-section';
import type { PartnerDispatchPolicy, ProviderDetail } from './partner-detail-types';
import { partnerDetailWorkspaceHref } from './partner-detail-workspace-model';
import type { PartnerOpsTone } from './partner-detail-tone';

export type PartnerServicePricingAcceptance = {
  readonly readyCount: number;
  readonly rows: readonly unknown[];
};

export type BookingAcceptanceGate = {
  readonly action: string;
  readonly detail: string;
  readonly detailNode?: ReactNode;
  readonly label: string;
  readonly ok: boolean;
  readonly tone?: PartnerOpsTone;
};

export function buildProviderBookingAcceptance(
  provider: ProviderDetail,
  pricing: PartnerServicePricingAcceptance,
  dispatchPolicy: PartnerDispatchPolicy,
) {
  const cashDebt = cashFeeDebtAmount(provider);
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const hasPushDevice = (provider.user?.pushDevices ?? []).some((device) => device.enabled);
  const hasRecentLocation =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const primaryBank = primaryBankAccount(provider);
  const pricingReady = pricing.readyCount > 0;
  const hasRequiredDocuments = hasApprovedRequiredKycDocuments(provider);
  const hasAccountBlock = Boolean(provider.blockedAt);

  const gates: BookingAcceptanceGate[] = [
    {
      label: 'Wallet and cash debt',
      ok: cashDebt <= 0,
      tone: cashDebt > 0 ? 'pending' : 'done',
      detail:
        cashDebt > 0
          ? `Partner owes HANDS ${formatCurrency(cashDebt)} from cash fee/tax settlement.`
          : 'No open negative wallet debt is visible.',
      detailNode:
        cashDebt > 0 ? (
          <>
            Partner owes HANDS <MoneyText amount={cashDebt} /> from cash fee/tax settlement.
          </>
        ) : undefined,
      action:
        cashDebt > 0
          ? 'Record Partner deposit or admin offset before final acceptance, service start, and payout release resume.'
          : 'Clear',
    },
    {
      label: 'Account controls',
      ok: !hasAccountBlock && activeSanctions.length === 0,
      detail: hasAccountBlock
        ? `Account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`
        : activeSanctions.length > 0
          ? `${activeSanctions.length} active account control(s) require review.`
          : 'No account block or active account control is visible.',
      action: hasAccountBlock || activeSanctions.length > 0 ? 'Review reports desk' : 'Clear',
    },
    {
      label: 'Identity and approval',
      ok:
        provider.verification?.status === 'APPROVED' &&
        provider.kyc?.status === 'APPROVED' &&
        hasRequiredDocuments,
      detail:
        provider.verification?.status !== 'APPROVED'
          ? `Verification is ${provider.verification?.status ?? 'DRAFT'}.`
          : provider.kyc?.status !== 'APPROVED'
            ? `KYC is ${provider.kyc?.status ?? 'DRAFT'}.`
            : !hasRequiredDocuments
              ? `Missing approved documents: ${missingApprovedRequiredKycDocuments(provider)
                  .map(providerDocumentLabel)
                  .join(', ')}.`
              : 'Verification, KYC, and required documents are approved.',
      action:
        provider.verification?.status === 'APPROVED' &&
        provider.kyc?.status === 'APPROVED' &&
        hasRequiredDocuments
          ? 'Clear'
          : 'Finish review',
    },
    {
      label: 'Withdrawal details',
      ok: true,
      detail:
        primaryBank?.status === 'APPROVED'
          ? `Approved bank is available: ${marketplaceDisplayText(primaryBank.bankName)}.`
          : 'Bank details are collected and approved when the Partner requests wallet withdrawal.',
      action: primaryBank?.status === 'APPROVED' ? 'Clear' : 'Review on withdrawal request',
    },
    {
      label: 'Online and reachable',
      ok: provider.status === 'ONLINE_AVAILABLE' && hasPushDevice,
      detail:
        provider.status !== 'ONLINE_AVAILABLE'
          ? `Partner status is ${provider.status}.`
          : !hasPushDevice
            ? 'No enabled push device is registered for booking alerts.'
            : 'Partner is online and has an enabled alert device.',
      action: provider.status === 'ONLINE_AVAILABLE' && hasPushDevice ? 'Clear' : 'Ask partner to open app',
    },
    {
      label: 'Location freshness',
      ok: hasRecentLocation,
      detail: hasRecentLocation
        ? `Last location is ${locationAgeLabel(provider.currentLocationUpdatedAt)}.`
        : `Last location is ${locationAgeLabel(
            provider.currentLocationUpdatedAt,
          )}. Policy requires ${dispatchPolicy.locationFreshnessMinutes}m freshness.`,
      action: hasRecentLocation ? 'Clear' : 'Refresh location',
    },
    {
      label: 'Bookable services',
      ok: pricingReady,
      detail: pricingReady
        ? `${pricing.readyCount} service price option(s) can be booked.`
        : 'No active partner service has a valid payout rule and customer price.',
      action: pricingReady ? 'Clear' : 'Fix service pricing',
    },
  ];

  const blockers = gates.filter((gate) => !gate.ok);
  const marketplaceBlockers = blockers.filter((gate) => gate.label !== 'Wallet and cash debt');
  const hasSettlementWarning = cashDebt > 0;
  const directFirstPickBlockers = blockers.filter((gate) => gate.label !== 'Wallet and cash debt');
  const primaryReason =
    marketplaceBlockers[0]?.detail ??
    (hasSettlementWarning
      ? 'Cash fee debt is a settlement warning before final acceptance, service start, or payout release.'
      : 'All marketplace participation gates are clear.');
  const directFirstPickReason =
    directFirstPickBlockers[0]?.detail ??
    (cashDebt > 0
      ? 'Wallet debt does not block direct first-pick or already-matched service flow.'
      : 'Direct first-pick gates are clear.');
  const canJoinMarketplace = marketplaceBlockers.length === 0;

  return {
    canJoinMarketplace,
    canDirectFirstPick: directFirstPickBlockers.length === 0,
    status: canJoinMarketplace
      ? hasSettlementWarning
        ? 'SETTLEMENT WARNING'
        : 'CAN ACCEPT'
      : `${marketplaceBlockers.length} BLOCKER(S)`,
    tone: canJoinMarketplace
      ? hasSettlementWarning
        ? ('pending' as const)
        : ('done' as const)
      : ('blocked' as const),
    primaryReason,
    directFirstPickReason,
    cashDebt,
    locationAge: locationAgeLabel(provider.currentLocationUpdatedAt),
    bookableServices: `${pricing.readyCount}/${pricing.rows.length}`,
    gates,
  };
}

export type PartnerBookingAcceptance = ReturnType<typeof buildProviderBookingAcceptance>;

export function buildPartnerAcceptanceRepairCommand(
  provider: ProviderDetail,
  bookingAcceptance: PartnerBookingAcceptance,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerAcceptanceRepairCommandView {
  const blockedGates = bookingAcceptance.gates.filter((gate) => !gate.ok);
  const hardBlockedGates = blockedGates.filter((gate) => gate.label !== 'Wallet and cash debt');
  const walletWarningGate = blockedGates.find((gate) => gate.label === 'Wallet and cash debt');
  const status = hardBlockedGates.length
    ? `${hardBlockedGates.length} REPAIR STEP(S)`
    : walletWarningGate
      ? 'SETTLEMENT WARNING'
      : 'MARKETPLACE READY';
  const partnerAppMessage = partnerAppBlockMessage(
    provider,
    bookingAcceptance,
    payoutOps,
    dispatchPolicy,
  );
  const hasWalletBlock = Boolean(walletWarningGate);
  const hasHardVisibilityBlock = hardBlockedGates.some((gate) =>
    ['Account controls', 'Identity and approval'].includes(gate.label),
  );
  const customerImpact =
    bookingAcceptance.canJoinMarketplace && !hasWalletBlock
      ? 'Can appear in customer booking flow and final partner choice.'
      : hasWalletBlock && !hardBlockedGates.length
        ? 'Customer balances are unaffected; this wallet warning keeps visibility open, but final acceptance and service start wait for settlement.'
        : hasHardVisibilityBlock
          ? 'Hide or avoid this partner for direct booking and marketplace shortlist until hard blockers are cleared.'
          : 'Partner may remain visible only after operator confirms freshness, reachability, and pricing.';
  const operatorDecision =
    bookingAcceptance.canJoinMarketplace && !hasWalletBlock
      ? 'No manual repair required. Monitor service quality and response speed.'
      : hasWalletBlock && !hardBlockedGates.length
        ? 'Finance must clear cash debt before final acceptance, service start, or payout release.'
        : `Start with ${hardBlockedGates[0]?.label ?? 'the first visible blocker'} before considering dispatch.`;
  const marketplaceRouting =
    bookingAcceptance.canJoinMarketplace && !hasWalletBlock
      ? `Eligible for first-pick and marketplace participation within ${formatDistance(
          dispatchPolicy.backupRadiusMeters,
        )}.`
      : hasWalletBlock && !hardBlockedGates.length
        ? 'Partner can view and participate in marketplace requests as a warning state; final acceptance, service start, and payout release wait for settlement.'
        : 'Route urgent demand to direct-ready or marketplace-ready partners while this repair queue is open.';

  const steps = hardBlockedGates.map((gate) => partnerAcceptanceRepairStep(provider, gate));
  if (walletWarningGate) {
    steps.push(partnerAcceptanceRepairStep(provider, walletWarningGate));
  }
  if (!steps.length) {
    steps.push({
      owner: 'Ops',
      blocker: 'No active blocker',
      reason: 'All direct and marketplace readiness gates are currently clear for this partner.',
      operatorAction: 'Keep monitoring customer feedback records, response speed, and location freshness.',
      href: `/partners/${provider.id}`,
      actionLabel: 'Open profile',
      tone: 'done',
    });
  }

  if (providerHasFirstRevenueSignal(provider) && payoutOps.status !== 'UNLOCKED') {
    steps.push({
      owner: 'Finance',
      blocker: 'Payout-only withdrawal profile',
      reason:
        payoutOps.blockers[0] ??
        'First earning exists, so address, agreements, bank details, and payout holds must be reviewed before withdrawal.',
      operatorAction:
        'Do not block the first job retroactively, but keep payout locked until withdrawal requirements are complete.',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#payout'),
      actionLabel: 'Open payout gate',
      tone: 'pending',
    });
  }

  return {
    status,
    tone: hardBlockedGates.length ? 'blocked' : walletWarningGate ? 'pending' : 'done',
    partnerAppMessage,
    customerImpact,
    operatorDecision,
    marketplaceRouting,
    steps,
  };
}

export function buildPartnerAcceptanceUnblockPlaybook(
  provider: ProviderDetail,
  bookingAcceptance: PartnerBookingAcceptance,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
): PartnerAcceptanceUnblockStep[] {
  const gate = (label: string) => bookingAcceptance.gates.find((item) => item.label === label);
  const walletGate = gate('Wallet and cash debt');
  const accountGate = gate('Account controls');
  const identityGate = gate('Identity and approval');
  const bankGate = gate('Withdrawal details');
  const locationGate = gate('Location freshness');
  const reachableGate = gate('Online and reachable');
  const serviceGate = gate('Bookable services');
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const payoutReady = payoutOps.status === 'UNLOCKED';
  const payoutGateOpen = !hasFirstRevenue || payoutReady;

  const steps: PartnerAcceptanceUnblockStep[] = [
    {
      id: 'cash-debt',
      step: '1',
      owner: 'Finance',
      title: 'Clear wallet and cash fee debt',
      status: walletGate?.ok ? 'CLEAR' : 'SETTLEMENT WARNING',
      detail: walletGate?.detail ?? 'Wallet gate was not evaluated.',
      bookingImpact: walletGate?.ok
        ? 'Partner has no settlement warning on final acceptance, service start, or payout release.'
        : 'Marketplace visibility and participation stay open; final acceptance, service start, and payout release wait for settlement.',
      payoutImpact: 'Finance should not release payout while HANDS fee/tax debt is still open.',
      action: walletGate?.ok ? 'Open cash settlement history' : 'Record settlement',
      href: '/cash-settlements',
      tone: walletGate?.ok ? 'done' : 'pending',
      bookingBlocked: false,
    },
    {
      id: 'account-controls',
      step: '2',
      owner: 'Account',
      title: 'Resolve account controls',
      status: accountGate?.ok ? 'CLEAR' : 'CONTROL HOLD',
      detail: accountGate?.detail ?? 'Account gate was not evaluated.',
      bookingImpact: accountGate?.ok
        ? 'No account-level restriction is blocking work.'
        : 'Partner must stay hidden from customer selection and marketplace participation until account-control review is resolved.',
      payoutImpact: 'Active account controls can hold payout until support closes the case.',
      action: accountGate?.ok ? 'Open partner report history' : 'Open reports',
      href: buildPartnerControlDetailsHref(accountGate?.ok ? 'reports' : 'sanctions', {
        q: provider.id,
      }),
      tone: accountGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !accountGate?.ok,
    },
    {
      id: 'identity-activity',
      step: '3',
      owner: 'KYC',
      title: 'Finish KYC and Level 2 activity readiness',
      status: identityGate?.ok ? 'READY' : 'REVIEW',
      detail: identityGate?.detail ?? 'Identity gate missing.',
      bookingImpact: identityGate?.ok
        ? 'Partner meets the Level 2 active-work gate.'
        : 'Holds preferred direct requests and marketplace participation until identity evidence and activity readiness are approved.',
      payoutImpact: bankGate?.ok
        ? 'Bank account is approved for future withdrawal requests.'
        : 'Bank details are reviewed later when the Partner requests wallet withdrawal.',
      action: identityGate?.ok ? 'Review KYC evidence' : 'Finish KYC review',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#kyc'),
      tone: identityGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !identityGate?.ok,
    },
    {
      id: 'location',
      step: '4',
      owner: 'Dispatch',
      title: 'Refresh location for 10km matching',
      status: locationGate?.ok ? 'FRESH' : 'STALE',
      detail: locationGate?.detail ?? 'Location gate was not evaluated.',
      bookingImpact: locationGate?.ok
        ? 'Partner location is usable for distance sorting and marketplace radius checks.'
        : 'Partner may be excluded from nearby marketplace matching or show unreliable distance.',
      payoutImpact: 'No direct payout impact, but location history can support dispute review.',
      action: locationGate?.ok ? 'Open location history' : 'Ask partner to open app',
      href: partnerDetailWorkspaceHref(provider.id, 'access', '#location'),
      tone: locationGate?.ok ? 'done' : 'pending',
      bookingBlocked: !locationGate?.ok,
    },
    {
      id: 'contactability',
      step: '5',
      owner: 'Ops',
      title: 'Confirm app reachability',
      status: reachableGate?.ok ? 'REACHABLE' : 'CONTACT GAP',
      detail: reachableGate?.detail ?? 'Reachability gate was not evaluated.',
      bookingImpact: reachableGate?.ok
        ? 'Partner should receive direct booking alerts during the response window.'
        : 'Partner may miss the 10 minute first-pick window or marketplace invite.',
      payoutImpact: 'No direct payout impact.',
      action: reachableGate?.ok ? 'Open app activity' : 'Check app activity',
      href: partnerDetailWorkspaceHref(provider.id, 'access', '#partner-access-section'),
      tone: reachableGate?.ok ? 'done' : 'pending',
      bookingBlocked: !reachableGate?.ok,
    },
    {
      id: 'service-pricing',
      step: '6',
      owner: 'Ops',
      title: 'Confirm bookable service pricing',
      status: serviceGate?.ok ? 'BOOKABLE' : 'PRICE GAP',
      detail: serviceGate?.detail ?? 'Service pricing gate was not evaluated.',
      bookingImpact: serviceGate?.ok
        ? 'At least one service option can be shown to customers.'
        : 'Customer app should hide partner services until the exact payout rule exists.',
      payoutImpact: 'Correct payout rules protect partner net, HANDS fee, tax, and cash debt calculations.',
      action: serviceGate?.ok ? 'Open service pricing' : 'Fix service pricing',
      href: '/services',
      tone: serviceGate?.ok ? 'done' : 'blocked',
      bookingBlocked: !serviceGate?.ok,
    },
    {
      id: 'tax-after-first-earning',
      step: '7',
      owner: 'Finance',
      title: 'Review withdrawal profile when requested',
      status: payoutGateOpen ? (hasFirstRevenue ? 'PAYOUT READY' : 'DEFERRED') : 'PAYOUT GATE',
      detail: hasFirstRevenue
        ? (payoutOps.blockers[0] ??
          'Wallet payout follow-up is active; verify withdrawal address, payout agreements, bank details, and payout holds.')
        : 'Do not force bank or tax profile during initial signup. Collect withdrawal details when wallet withdrawal/deposit is requested.',
      bookingImpact: 'This should not block the partner from receiving the first booking.',
      payoutImpact: payoutGateOpen
        ? 'No withdrawal profile blocker is currently visible.'
        : 'Blocks manual withdrawal/deposit release until address, bank, required agreements, and holds are complete.',
      action: hasFirstRevenue ? 'Open payout gate' : 'Review payout policy',
      href: hasFirstRevenue
        ? partnerDetailWorkspaceHref(provider.id, 'dossier', '#payout')
        : '/cash-settlements',
      tone: payoutGateOpen ? 'done' : 'pending',
      bookingBlocked: false,
    },
  ];

  return steps.filter((step) => step.tone !== 'done' || step.bookingBlocked);
}

export function buildPartnerDetailOpsBadges(
  provider: ProviderDetail,
  bookingAcceptance: PartnerBookingAcceptance,
  dispatchPolicy: PartnerDispatchPolicy,
): PartnerReadinessSnapshotBadge[] {
  const cashDebt = cashFeeDebtAmount(provider);
  const enabledPushCount = (provider.user?.pushDevices ?? []).filter((device) => device.enabled).length;
  const locationFresh =
    locationAgeMinutes(provider.currentLocationUpdatedAt) <= dispatchPolicy.locationFreshnessMinutes;
  const gate = (label: string) => bookingAcceptance.gates.find((item) => item.label === label);
  const identityGate = gate('Identity and approval');
  const onlineGate = gate('Online and reachable');
  const serviceGate = gate('Bookable services');

  return [
    {
      label: bookingAcceptance.canDirectFirstPick
        ? 'Direct first-pick ready'
        : 'Direct first-pick repair',
      tone: bookingAcceptance.canDirectFirstPick ? 'done' : 'blocked',
      detail: bookingAcceptance.directFirstPickReason,
    },
    {
      label: bookingAcceptance.canJoinMarketplace
        ? cashDebt > 0
          ? 'Marketplace participation warning'
          : 'Marketplace participation ready'
        : 'Marketplace participation blocked',
      tone: bookingAcceptance.canJoinMarketplace ? (cashDebt > 0 ? 'pending' : 'done') : 'blocked',
      detail:
        bookingAcceptance.canJoinMarketplace && cashDebt <= 0
          ? `Can participate in marketplace bookings inside ${formatDistance(
              dispatchPolicy.backupRadiusMeters,
            )} during the ${dispatchPolicy.responseWindowMinutes}m response window.`
          : cashDebt > 0 && bookingAcceptance.canJoinMarketplace
            ? 'Marketplace visibility and participation stay open; final acceptance, service start, and payout release wait for settlement.'
            : 'Marketplace participation uses account, identity, reachability, location, and pricing gates.',
    },
    {
      label: cashDebt > 0 ? 'Cash debt warning' : 'Wallet clear',
      tone: cashDebt > 0 ? 'pending' : 'done',
      detail:
        cashDebt > 0
          ? `Partner owes HANDS ${formatCurrency(
              cashDebt,
            )} from cash settlement before final acceptance, service start, or payout release.`
          : 'No cash-settlement debt is open.',
      detailNode:
        cashDebt > 0 ? (
          <>
            Partner owes HANDS <MoneyText amount={cashDebt} /> from cash settlement before final
            acceptance, service start, or payout release.
          </>
        ) : undefined,
    },
    {
      label: identityGate?.ok ? 'KYC and docs ok' : 'KYC/doc review',
      tone: identityGate?.ok ? 'done' : 'blocked',
      detail: identityGate?.detail ?? 'Identity gate has not been evaluated.',
    },
    {
      label: locationFresh ? 'Location fresh' : 'Refresh location',
      tone: locationFresh ? 'done' : 'pending',
      detail: `Last location is ${locationAgeLabel(
        provider.currentLocationUpdatedAt,
      )}; policy is ${dispatchPolicy.locationFreshnessMinutes}m.`,
    },
    {
      label: enabledPushCount > 0 ? 'Push ready' : 'Push missing',
      tone: enabledPushCount > 0 ? 'done' : 'pending',
      detail:
        enabledPushCount > 0
          ? `${enabledPushCount} enabled push device(s) can receive booking alerts.`
          : (onlineGate?.detail ?? 'No enabled push device is registered.'),
    },
    {
      label: serviceGate?.ok ? 'Services bookable' : 'Pricing needed',
      tone: serviceGate?.ok ? 'done' : 'blocked',
      detail: serviceGate?.detail ?? 'Service pricing gate has not been evaluated.',
    },
  ];
}

function partnerAcceptanceRepairStep(
  provider: ProviderDetail,
  gate: BookingAcceptanceGate,
): PartnerAcceptanceRepairCommandView['steps'][number] {
  const map: Record<
    string,
    {
      owner: string;
      href: string;
      actionLabel: string;
      tone: PartnerOpsTone;
    }
  > = {
    'Wallet and cash debt': {
      owner: 'Finance',
      href: '/cash-settlements',
      actionLabel: 'Open settlement',
      tone: 'pending',
    },
    'Account controls': {
      owner: 'Account',
      href: buildPartnerControlDetailsHref('sanctions', { q: provider.id }),
      actionLabel: 'Open reports',
      tone: 'blocked',
    },
    'Identity and approval': {
      owner: 'KYC',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#kyc'),
      actionLabel: 'Open KYC',
      tone: 'blocked',
    },
    'Bank account': {
      owner: 'Finance',
      href: partnerDetailWorkspaceHref(provider.id, 'dossier', '#bank'),
      actionLabel: 'Open bank',
      tone: 'blocked',
    },
    'Online and reachable': {
      owner: 'Ops',
      href: partnerDetailWorkspaceHref(provider.id, 'access', '#partner-access-section'),
      actionLabel: 'Open app activity',
      tone: 'pending',
    },
    'Location freshness': {
      owner: 'Dispatch',
      href: partnerDetailWorkspaceHref(provider.id, 'access', '#location'),
      actionLabel: 'Open location',
      tone: 'pending',
    },
    'Bookable services': {
      owner: 'Ops',
      href: '/services',
      actionLabel: 'Open services',
      tone: 'blocked',
    },
  };
  const config = map[gate.label] ?? {
    owner: 'Ops',
    href: `/partners/${provider.id}`,
    actionLabel: 'Open partner',
    tone: 'pending' as const,
  };

  return {
    owner: config.owner,
    blocker: gate.label,
    reason: gate.detail,
    operatorAction: gate.action,
    href: config.href,
    actionLabel: config.actionLabel,
    tone: config.tone,
  };
}

function partnerAppBlockMessage(
  provider: ProviderDetail,
  bookingAcceptance: PartnerBookingAcceptance,
  payoutOps: ReturnType<typeof buildProviderPayoutOps>,
  dispatchPolicy: PartnerDispatchPolicy,
) {
  if (bookingAcceptance.cashDebt > 0) {
    return 'Unpaid HANDS fees must be settled before final acceptance, service start, or payout release.';
  }
  if (bookingAcceptance.canJoinMarketplace) {
    return 'Partner is clear for direct first-pick and marketplace participation.';
  }
  if (provider.blockedAt || (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE')) {
    return 'Account requires admin review before receiving work.';
  }
  if (provider.verification?.status !== 'APPROVED' || provider.kyc?.status !== 'APPROVED') {
    return 'Identity verification must be approved before receiving paid work.';
  }
  if (locationAgeMinutes(provider.currentLocationUpdatedAt) > dispatchPolicy.locationFreshnessMinutes) {
    return 'Open the app to refresh location before receiving requests.';
  }
  if (!(provider.user?.pushDevices ?? []).some((device) => device.enabled)) {
    return 'Open the app and enable alerts to receive booking requests.';
  }
  if (payoutOps.hold) {
    return 'Payout is held by admin review; booking may require operator confirmation.';
  }
  return 'Partner needs operator review before final acceptance, service start, or payout release.';
}
