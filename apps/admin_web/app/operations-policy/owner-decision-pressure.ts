import type { AdminBooking, AdminProvider } from '../../lib/admin-api';
import type { PolicySupplySensitivity } from './policy-supply-sensitivity';

export type OwnerDecisionPressure = {
  readonly alertCount: number;
  readonly summary: readonly { readonly label: string; readonly value: string; readonly helper: string }[];
  readonly cards: readonly {
    readonly title: string;
    readonly status: string;
    readonly detail: string;
    readonly operatorAction: string;
    readonly href: string;
    readonly className: string;
    readonly pillClass: string;
  }[];
};

type OwnerDecisionAcceptanceMatrix = {
  readonly blockingCount: number;
};

export function buildOwnerDecisionPressure(
  bookings: readonly AdminBooking[],
  providers: readonly AdminProvider[],
  supplySensitivity: PolicySupplySensitivity,
  acceptanceMatrix: OwnerDecisionAcceptanceMatrix,
): OwnerDecisionPressure {
  const activeStatuses = new Set([
    'OPEN_MATCHING',
    'MATCHED',
    'PROVIDER_ON_THE_WAY',
    'ARRIVED',
    'IN_SERVICE',
  ]);
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const activeBookings = bookings.filter((booking) => activeStatuses.has(booking.status));
  const waitingFirstPick = openMatching.filter(
    (booking) => booking.preferredProvider && !booking.selectedProvider,
  );
  const acceptedButNotFinal = openMatching.filter(
    (booking) =>
      !booking.selectedProvider &&
      (booking.participants ?? []).some((participant) => participant.status === 'ACCEPTED'),
  );
  const backupInterest = openMatching.filter((booking) =>
    (booking.participants ?? []).some(
      (participant) =>
        participant.status !== 'REJECTED' &&
        participant.providerProfile?.id &&
        participant.providerProfile.id !== booking.preferredProvider?.id,
    ),
  );
  const currentVisibleSupply = readSupplySummaryNumber(supplySensitivity, 'Current visible supply');
  const staleExcluded = readSupplySummaryNumber(supplySensitivity, 'Stale excluded');
  const finalGateHeldInRadius = readSupplySummaryNumber(
    supplySensitivity,
    'Marketplace/payout held in radius',
  );
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE')).length;
  const enabledPushPartners = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const pushGap = Math.max(onlinePartners - enabledPushPartners, 0);
  const finalGatePressure = acceptanceMatrix.blockingCount + finalGateHeldInRadius;

  const cards = [
    {
      title: 'First-pick response window',
      status: waitingFirstPick.length ? 'Monitor now' : 'Stable',
      detail: waitingFirstPick.length
        ? `${waitingFirstPick.length} open matching booking(s) are waiting on a first-pick Partner. ${acceptedButNotFinal.length} already have accepted participants awaiting final customer choice.`
        : 'No open booking is currently waiting on the first-pick response window.',
      operatorAction: waitingFirstPick.length
        ? 'Review matching wait time before shortening or extending the timer.'
        : 'Keep the launch baseline unless new wait-time data changes.',
      href: '/bookings?view=matching',
      className: waitingFirstPick.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: waitingFirstPick.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Marketplace policy and supply',
      status: currentVisibleSupply > 0 ? 'Supply visible' : 'Supply thin',
      detail: `${currentVisibleSupply} visible Partner(s) are inside the current policy sample. ${backupInterest.length} open booking(s) already show marketplace interest.`,
      operatorAction:
        currentVisibleSupply > 0
          ? 'Use the sensitivity table before changing the 10km radius.'
          : 'Refresh Partner locations or consider city/service supply rules before launch.',
      href: '/partners?review=marketplace-ready',
      className: currentVisibleSupply > 0 ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: currentVisibleSupply > 0 ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Location freshness rule',
      status: staleExcluded ? 'Refresh needed' : 'Fresh enough',
      detail: `${staleExcluded} Partner(s) are excluded only because their saved location is stale under the current freshness window.`,
      operatorAction: staleExcluded
        ? 'Ask Partners to open the app and send location before loosening freshness rules.'
        : 'Current location freshness is not excluding supply in the sample.',
      href: '/partners?review=location',
      className: staleExcluded ? 'ops-task-pending' : 'ops-task-done',
      pillClass: staleExcluded ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Wallet and marketplace holds',
      status: finalGatePressure ? 'Gate active' : 'Clear',
      detail: `${finalGatePressure} Partner marketplace/payout record(s) may require settlement, identity, bank, or account review.`,
      operatorAction: finalGatePressure
        ? 'Keep marketplace visibility open while finance and Partner controls clear marketplace and payout holds.'
        : 'No current sample pressure to relax marketplace gates.',
      href: finalGatePressure ? '/partners?review=marketplace-held' : '/partner-controls',
      className: finalGatePressure ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: finalGatePressure ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Partner FCM readiness',
      status: pushGap ? 'Push gap' : 'Ready',
      detail: `${enabledPushPartners}/${onlinePartners} online Partner(s) have enabled push devices in the current snapshot.`,
      operatorAction: pushGap
        ? 'Keep in-app request listing as the fallback until FCM device coverage is reliable.'
        : 'Push coverage is ready enough for production-device testing.',
      href: '/notifications?review=failed',
      className: pushGap ? 'ops-task-pending' : 'ops-task-done',
      pillClass: pushGap ? 'pill-warn' : 'pill-success',
    },
  ];

  return {
    alertCount: cards.filter((card) => card.className !== 'ops-task-done').length,
    summary: [
      {
        label: 'Open matching',
        value: String(openMatching.length),
        helper: 'Bookings where customers are waiting for Partner response or final choice.',
      },
      {
        label: 'Active service flow',
        value: String(activeBookings.length),
        helper: 'Matched, on-the-way, arrived, or in-service bookings affected by operator decisions.',
      },
      {
        label: 'Visible supply',
        value: String(currentVisibleSupply),
        helper: `${supplySensitivity.currentPolicyLabel} around ${supplySensitivity.referenceLabel}.`,
      },
      {
        label: 'Marketplace/payout holds',
        value: String(finalGatePressure),
        helper:
          'Wallet, identity, bank, or account-control records that change marketplace or payout readiness.',
      },
    ],
    cards,
  };
}

function readSupplySummaryNumber(supplySensitivity: PolicySupplySensitivity, label: string) {
  const value = supplySensitivity.summary.find((item) => item.label === label)?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
