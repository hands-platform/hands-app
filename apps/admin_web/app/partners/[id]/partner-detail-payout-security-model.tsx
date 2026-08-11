import { DateTimeText } from '../../../components/date-time-text';
import { MoneyText } from '../../../components/money-text';
import { displaySessionCheckText } from './partner-detail-device-session-model';
import {
  amountValue,
  formatCurrency,
  formatDate,
  locationAgeMinutes,
} from './partner-detail-format';
import type {
  ProviderBankAccount,
  ProviderDetail,
  ProviderOpsCard,
} from './partner-detail-types';

export function buildProviderPayoutOps(provider: ProviderDetail) {
  const earnings = provider.earnings ?? [];
  const payoutBatches = provider.payoutBatches ?? [];
  const payoutHold = activePayoutHold(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const hasFirstRevenue = providerHasFirstRevenueSignal(provider);
  const hasAddress = Boolean(provider.residentialAddress?.trim());
  const bankApproved = hasApprovedBankAccount(provider);
  const agreementsReady = agreementsAccepted >= 5;
  const payoutReady = hasFirstRevenue && bankApproved && hasAddress && agreementsReady && !payoutHold;
  const blockers = hasFirstRevenue ? payoutBlockers(provider) : [];
  const unpaidEarnings = earnings.filter(
    (earning) => !['PAID', 'CANCELLED', 'REFUNDED'].includes(earning.status),
  );
  const unpaidNetAmount = unpaidEarnings.reduce(
    (sum, earning) => sum + amountValue(earning.netAmount),
    0,
  );
  const withholdingAmount = earnings.reduce(
    (sum, earning) => sum + amountValue(earning.withholdingAmount),
    0,
  );
  const latestBatch = payoutBatches[0];

  const status = payoutHold ? 'HELD' : payoutReady ? 'UNLOCKED' : hasFirstRevenue ? 'BLOCKED' : 'DEFERRED';
  const tone: ProviderOpsCard['tone'] = payoutReady
    ? 'done'
    : payoutHold || hasFirstRevenue
      ? 'blocked'
      : 'pending';

  const cards: ProviderOpsCard[] = [
    {
      action: unpaidEarnings.length
        ? 'Eligible only after all payout gates are clear.'
        : 'No unpaid earning record.',
      detail: formatCurrency(unpaidNetAmount),
      detailNode: <MoneyText amount={unpaidNetAmount} />,
      status: unpaidEarnings.length ? `${unpaidEarnings.length} ITEM(S)` : '0 ITEM',
      title: 'Unpaid net',
      tone: unpaidEarnings.length ? (payoutReady ? 'done' : 'pending') : 'pending',
    },
    {
      action: earnings.length
        ? 'Fee and withholding records are preserved for accounting.'
        : 'No first earning yet.',
      detail: formatCurrency(withholdingAmount),
      detailNode: <MoneyText amount={withholdingAmount} />,
      status: earnings.length ? 'TRACKED' : 'NONE',
      title: 'Withholding',
      tone: earnings.length ? 'done' : 'pending',
    },
    {
      action: latestBatch?.paidAt
        ? `Last paid ${formatDate(latestBatch.paidAt)}.`
        : 'Open payouts to create or process batch.',
      actionNode: latestBatch?.paidAt ? (
        <>
          Last paid <DateTimeText fallback="Missing" value={latestBatch.paidAt} />.
        </>
      ) : undefined,
      detail: latestBatch
        ? `${latestBatch.status} / ${formatCurrency(latestBatch.totalNetAmount)}`
        : 'No batch created yet.',
      detailNode: latestBatch ? (
        <>
          {latestBatch.status} / <MoneyText amount={latestBatch.totalNetAmount} />
        </>
      ) : undefined,
      status: payoutBatches.length ? `${payoutBatches.length} RECENT` : 'NONE',
      title: 'Payout batches',
      tone: latestBatch?.status === 'PAID' ? 'done' : 'pending',
    },
    {
      action: payoutHold
        ? 'Resolve the finance or account-control reason before lifting the hold.'
        : payoutReady
          ? 'Partner may be paid when an eligible batch exists.'
          : hasFirstRevenue
            ? 'Clear blockers before payment.'
            : 'No payout request should be approved yet.',
      detail: payoutHold
        ? `Active hold: ${payoutHold.reason}`
        : payoutReady
          ? 'Bank, address, agreements, and first service are complete.'
          : hasFirstRevenue
            ? blockers.join(' ')
            : 'Deferred until first earning.',
      status,
      title: 'Payout gate',
      tone,
    },
  ];

  return {
    blockers,
    cards,
    hold: payoutHold,
    status,
    tone,
  };
}

export function buildProviderSecuritySummary(provider: ProviderDetail) {
  const sessions = provider.sessions ?? [];
  const devices = provider.devices ?? [];
  const sharedDeviceMatches = provider.sharedDeviceMatches ?? [];
  const sessionCheckSessions = sessions.filter((session) => session.suspicious);
  const blockedDevices = devices.filter((device) => device.blockedAt || !device.enabled);
  const mostRecentSession = sessions[0];
  const mostRecentDevice = devices[0];
  const lastSeenMinutes = Math.min(
    locationAgeMinutes(mostRecentSession?.lastSeenAt),
    locationAgeMinutes(mostRecentDevice?.lastSeenAt),
  );
  const staleAppActivity = lastSeenMinutes > 24 * 60;

  const cards: ProviderOpsCard[] = [
    {
      action: provider.blockedAt
        ? 'Unblock only after identity, safety, payout, or policy issue is resolved.'
        : 'No account block action.',
      detail: provider.blockedAt
        ? `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`
        : 'Partner account is not blocked.',
      status: provider.blockedAt ? 'BLOCKED' : 'CLEAR',
      title: 'Account block',
      tone: provider.blockedAt ? 'blocked' : 'done',
    },
    {
      action:
        devices.length || sessions.length
          ? staleAppActivity
            ? 'Ask partner to open the app before dispatching work.'
            : 'Partner app activity is visible.'
          : 'Partner should sign in on the real app once onboarding starts.',
      detail:
        devices.length || sessions.length
          ? `Latest partner app record is ${Number.isFinite(lastSeenMinutes) ? `${lastSeenMinutes}m old` : 'missing'}.`
          : 'No partner app device or session has been recorded yet.',
      status: devices.length || sessions.length ? (staleAppActivity ? 'STALE' : 'RECENT') : 'MISSING',
      title: 'Partner app activity',
      tone: devices.length || sessions.length ? (staleAppActivity ? 'pending' : 'done') : 'pending',
    },
    {
      action: blockedDevices.length ? 'Review whether the device can be safely unblocked.' : 'No action.',
      detail: blockedDevices.length
        ? 'One or more partner devices are disabled or blocked from use.'
        : 'No partner app device is currently blocked.',
      status: blockedDevices.length ? `${blockedDevices.length} BLOCKED` : 'CLEAR',
      title: 'Blocked devices',
      tone: blockedDevices.length ? 'blocked' : 'done',
    },
    {
      action: sessionCheckSessions.length
        ? 'Confirm identity and review recent app/device activity.'
        : 'No action.',
      detail: sessionCheckSessions.length
        ? sessionCheckSessions
            .map((session) => displaySessionCheckText(session.suspiciousReason ?? 'Session check'))
            .join(' ')
        : 'No session check record is currently saved.',
      status: sessionCheckSessions.length ? `${sessionCheckSessions.length} CHECK` : 'CLEAR',
      title: 'Session checks',
      tone: sessionCheckSessions.length ? 'blocked' : 'done',
    },
    {
      action: sharedDeviceMatches.length
        ? 'Check for multi-account behavior before approval or payout.'
        : 'No action.',
      detail: sharedDeviceMatches.length
        ? 'The same device identifier appears on another partner profile.'
        : 'No cross-partner device match is visible.',
      status: sharedDeviceMatches.length ? `${sharedDeviceMatches.length} MATCH` : 'CLEAR',
      title: 'Shared device record',
      tone: sharedDeviceMatches.length ? 'blocked' : 'done',
    },
  ];

  return {
    cards,
    followUpNeeded: cards.some((card) => card.tone === 'blocked'),
  };
}

export function payoutBlockers(provider: ProviderDetail) {
  const blockers: string[] = [];
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const payoutHold = activePayoutHold(provider);

  if (payoutHold) {
    blockers.push(`Active payout hold: ${payoutHold.reason}.`);
  }
  if (!hasApprovedBankAccount(provider)) {
    blockers.push(`Bank ${bankAccountStatusLabel(provider)}.`);
  }
  if (!provider.residentialAddress?.trim()) {
    blockers.push('Residential address missing.');
  }
  if (agreementsAccepted < 5) {
    blockers.push(`Agreements ${agreementsAccepted}/5.`);
  }
  return blockers.length ? blockers : ['Payout gate needs admin refresh.'];
}

export function approvedBankAccount(provider: ProviderDetail) {
  return (provider.bankAccounts ?? []).find((bankAccount) => bankAccount.status === 'APPROVED') ?? null;
}

export function primaryBankAccount(provider: ProviderDetail): ProviderBankAccount | null {
  return (
    (provider.bankAccounts ?? []).find((bankAccount) => bankAccount.isPrimary) ??
    approvedBankAccount(provider) ??
    provider.bankAccounts?.[0] ??
    null
  );
}

export function hasApprovedBankAccount(provider: ProviderDetail) {
  return Boolean(approvedBankAccount(provider));
}

export function bankAccountStatusLabel(provider: ProviderDetail) {
  return approvedBankAccount(provider)?.status ?? provider.bankAccounts?.[0]?.status ?? 'MISSING';
}

export function providerHasFirstRevenueSignal(provider: ProviderDetail) {
  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

export function cashFeeDebtAmount(provider: ProviderDetail) {
  return (provider.earnings ?? [])
    .filter(
      (earning) =>
        earning.netAmount < 0 &&
        earning.booking?.payment?.method === 'CASH' &&
        earning.status !== 'PAID',
    )
    .reduce((total, earning) => total + Math.abs(amountValue(earning.netAmount)), 0);
}

export function activePayoutHold(provider: ProviderDetail) {
  const now = Date.now();
  return (provider.sanctions ?? []).find((sanction) => {
    if (sanction.type !== 'PAYOUT_HOLD' || sanction.status !== 'ACTIVE') {
      return false;
    }
    if (!sanction.expiresAt) {
      return true;
    }
    const expiresAt = Date.parse(sanction.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > now;
  });
}
