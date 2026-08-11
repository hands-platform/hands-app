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

type OwnerDecisionPressureStats = {
  readonly acceptedButNotFinal: readonly AdminBooking[];
  readonly activeBookings: readonly AdminBooking[];
  readonly backupInterest: readonly AdminBooking[];
  readonly currentVisibleSupply: number;
  readonly enabledPushPartners: number;
  readonly finalGatePressure: number;
  readonly onlinePartners: number;
  readonly openMatching: readonly AdminBooking[];
  readonly pushGap: number;
  readonly staleExcluded: number;
  readonly waitingFirstPick: readonly AdminBooking[];
};

export function buildOwnerDecisionPressure(
  bookings: readonly AdminBooking[],
  providers: readonly AdminProvider[],
  supplySensitivity: PolicySupplySensitivity,
  acceptanceMatrix: OwnerDecisionAcceptanceMatrix,
): OwnerDecisionPressure {
  const stats = buildOwnerDecisionPressureStats(
    bookings,
    providers,
    supplySensitivity,
    acceptanceMatrix,
  );
  const cards = buildOwnerDecisionPressureCards(stats);

  return {
    alertCount: cards.filter((card) => card.className !== 'ops-task-done').length,
    summary: buildOwnerDecisionPressureSummary(stats, supplySensitivity),
    cards,
  };
}

function buildOwnerDecisionPressureStats(
  bookings: readonly AdminBooking[],
  providers: readonly AdminProvider[],
  supplySensitivity: PolicySupplySensitivity,
  acceptanceMatrix: OwnerDecisionAcceptanceMatrix,
): OwnerDecisionPressureStats {
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
    'Final gate held in radius',
  );
  const onlinePartners = providers.filter((provider) => provider.status.startsWith('ONLINE')).length;
  const enabledPushPartners = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => device.enabled),
  ).length;
  const pushGap = Math.max(onlinePartners - enabledPushPartners, 0);
  const finalGatePressure = acceptanceMatrix.blockingCount + finalGateHeldInRadius;

  return {
    acceptedButNotFinal,
    activeBookings,
    backupInterest,
    currentVisibleSupply,
    enabledPushPartners,
    finalGatePressure,
    onlinePartners,
    openMatching,
    pushGap,
    staleExcluded,
    waitingFirstPick,
  };
}

function buildOwnerDecisionPressureCards(stats: OwnerDecisionPressureStats): OwnerDecisionPressure['cards'] {
  return [
    {
      title: 'First-pick response window',
      status: stats.waitingFirstPick.length ? 'Monitor now' : 'Stable',
      detail: stats.waitingFirstPick.length
        ? `${stats.waitingFirstPick.length} open matching booking(s) are waiting on a first-pick Partner. ${stats.acceptedButNotFinal.length} already have accepted participants awaiting final customer choice.`
        : 'No open booking is currently waiting on the first-pick response window.',
      operatorAction: stats.waitingFirstPick.length
        ? 'Review matching wait time before shortening or extending the timer.'
        : 'Keep the launch baseline unless new wait-time data changes.',
      href: '/bookings?view=matching',
      className: stats.waitingFirstPick.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: stats.waitingFirstPick.length ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Marketplace policy and supply',
      status: stats.currentVisibleSupply > 0 ? 'Supply visible' : 'Supply thin',
      detail: `${stats.currentVisibleSupply} visible Partner(s) are inside the current policy sample. ${stats.backupInterest.length} open booking(s) already show marketplace interest.`,
      operatorAction:
        stats.currentVisibleSupply > 0
          ? 'Use the sensitivity table before changing the 10km radius.'
          : 'Refresh Partner locations or consider city/service supply rules before launch.',
      href: '/partners?review=ready-now',
      className: stats.currentVisibleSupply > 0 ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: stats.currentVisibleSupply > 0 ? 'pill-success' : 'pill-danger',
    },
    {
      title: 'Location freshness rule',
      status: stats.staleExcluded ? 'Refresh needed' : 'Fresh enough',
      detail: `${stats.staleExcluded} Partner(s) are excluded only because their saved location is stale under the current freshness window.`,
      operatorAction: stats.staleExcluded
        ? 'Ask Partners to open the app and send location before loosening freshness rules.'
        : 'Current location freshness is not excluding supply in the sample.',
      href: '/partners?review=available-blocked-location',
      className: stats.staleExcluded ? 'ops-task-pending' : 'ops-task-done',
      pillClass: stats.staleExcluded ? 'pill-warn' : 'pill-success',
    },
    {
      title: 'Wallet final gate pressure',
      status: stats.finalGatePressure ? 'Gate active' : 'Clear',
      detail: `${stats.finalGatePressure} Partner final gate record(s) may require settlement, identity, withdrawal bank, or account review.`,
      operatorAction: stats.finalGatePressure
        ? 'Keep marketplace visibility open while finance and Partner controls clear final acceptance, service start, and payout release holds.'
        : 'No current sample pressure to relax marketplace gates.',
      href: stats.finalGatePressure ? '/partners?review=cash-debt' : '/partner-controls',
      className: stats.finalGatePressure ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: stats.finalGatePressure ? 'pill-danger' : 'pill-success',
    },
    {
      title: 'Partner FCM readiness',
      status: stats.pushGap ? 'Push gap' : 'Ready',
      detail: `${stats.enabledPushPartners}/${stats.onlinePartners} online Partner(s) have enabled push devices in the current snapshot.`,
      operatorAction: stats.pushGap
        ? 'Keep in-app request listing as the fallback until FCM device coverage is reliable.'
        : 'Push coverage is ready enough for production-device testing.',
      href: '/notifications?review=failed',
      className: stats.pushGap ? 'ops-task-pending' : 'ops-task-done',
      pillClass: stats.pushGap ? 'pill-warn' : 'pill-success',
    },
  ];
}

function buildOwnerDecisionPressureSummary(
  stats: OwnerDecisionPressureStats,
  supplySensitivity: PolicySupplySensitivity,
): OwnerDecisionPressure['summary'] {
  return [
    {
      label: 'Open matching',
      value: String(stats.openMatching.length),
      helper: 'Bookings where customers are waiting for Partner response or final choice.',
    },
    {
      label: 'Active service flow',
      value: String(stats.activeBookings.length),
      helper: 'Matched, on-the-way, arrived, or in-service bookings affected by operator decisions.',
    },
    {
      label: 'Visible supply',
      value: String(stats.currentVisibleSupply),
      helper: `${supplySensitivity.currentPolicyLabel} around ${supplySensitivity.referenceLabel}.`,
    },
    {
      label: 'Final gate pressure',
      value: String(stats.finalGatePressure),
      helper:
        'Wallet, identity, withdrawal bank, or account-control records that change final acceptance, service start, or payout release readiness.',
    },
  ];
}

function readSupplySummaryNumber(supplySensitivity: PolicySupplySensitivity, label: string) {
  const value = supplySensitivity.summary.find((item) => item.label === label)?.value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
