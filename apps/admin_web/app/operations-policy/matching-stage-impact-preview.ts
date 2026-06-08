import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { bookingRequestOpenedAt } from '../../lib/admin-booking-time';
import {
  adminPartnerMarketplaceBlocked,
  adminWalletGateBlocksMarketplaceParticipation,
  buildAdminLiveOperationsPolicy,
} from '../../lib/operations-policy';

type MatchingStageImpactStats = {
  stage1: number;
  stage2: number;
  stage3: number;
  repair: number;
  noSupply: number;
  overdue: number;
};

export type MatchingStageImpactPreview = {
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  rows: Array<{
    scenario: string;
    value: string;
    stage1: number;
    stage2: number;
    stage3: number;
    repair: number;
    noSupply: number;
    overdue: number;
    operatorRead: string;
    pillClass: string;
  }>;
};

export function buildMatchingStageImpactPreview(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
  now = Date.now(),
): MatchingStageImpactPreview {
  const livePolicy = buildAdminLiveOperationsPolicy(settings);
  const responseWindowMinutes = livePolicy.providerResponseWindowMinutes;
  const backupRadiusMeters = livePolicy.marketplaceRadiusMeters;
  const freshnessMinutes = livePolicy.marketplaceLocationFreshnessMinutes;
  const hardWalletBlock = adminWalletGateBlocksMarketplaceParticipation(livePolicy.walletNegativeGate);
  const openBookings = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const liveHandoff = bookings.filter((booking) =>
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status),
  );
  const baseline = matchingStageImpactStats(
    bookings,
    providers,
    {
      responseWindowMinutes,
      backupRadiusMeters,
      freshnessMinutes,
      hardWalletBlock,
    },
    now,
  );
  const responseOptions = uniqueNumbers([5, responseWindowMinutes, 10, 15]).sort(
    (left, right) => left - right,
  );
  const radiusOptions = uniqueNumbers([5000, backupRadiusMeters, 10000, 15000]).sort(
    (left, right) => left - right,
  );
  const freshnessOptions = uniqueNumbers([15, freshnessMinutes, 30, 60]).sort((left, right) => left - right);

  const rows = [
    ...responseOptions.map((value) => {
      const stats = matchingStageImpactStats(
        bookings,
        providers,
        {
          responseWindowMinutes: value,
          backupRadiusMeters,
          freshnessMinutes,
          hardWalletBlock,
        },
        now,
      );
      return matchingStageImpactRow(
        'Response window',
        `${value} min`,
        stats,
        baseline,
        value === responseWindowMinutes,
      );
    }),
    ...radiusOptions.map((value) => {
      const stats = matchingStageImpactStats(
        bookings,
        providers,
        {
          responseWindowMinutes,
          backupRadiusMeters: value,
          freshnessMinutes,
          hardWalletBlock,
        },
        now,
      );
      return matchingStageImpactRow(
        'Marketplace policy',
        formatDistance(value),
        stats,
        baseline,
        value === backupRadiusMeters,
      );
    }),
    ...freshnessOptions.map((value) => {
      const stats = matchingStageImpactStats(
        bookings,
        providers,
        {
          responseWindowMinutes,
          backupRadiusMeters,
          freshnessMinutes: value,
          hardWalletBlock,
        },
        now,
      );
      return matchingStageImpactRow(
        'Location freshness',
        `${value} min`,
        stats,
        baseline,
        value === freshnessMinutes,
      );
    }),
  ];

  return {
    currentPolicyLabel: `${responseWindowMinutes}m / ${formatDistance(backupRadiusMeters)} / ${freshnessMinutes}m fresh`,
    summary: [
      {
        label: 'Open matching sample',
        value: openBookings.length.toString(),
        helper: 'Bookings currently waiting inside Stage 1, Stage 2, or Stage 3.',
      },
      {
        label: 'Current Stage 2 marketplace',
        value: baseline.stage2.toString(),
        helper: 'Open bookings with usable marketplace partner supply under the current policy.',
      },
      {
        label: 'Current no supply',
        value: baseline.noSupply.toString(),
        helper: 'Open bookings that would show customer waiting without usable marketplace supply.',
      },
      {
        label: 'Stage 4 repair',
        value: baseline.repair.toString(),
        helper: `${liveHandoff.length} matched/live booking(s) checked for missing chat handoff.`,
      },
    ],
    rows,
  };
}

function matchingStageImpactStats(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  policy: {
    responseWindowMinutes: number;
    backupRadiusMeters: number;
    freshnessMinutes: number;
    hardWalletBlock: boolean;
  },
  now: number,
): MatchingStageImpactStats {
  return bookings.reduce<MatchingStageImpactStats>(
    (stats, booking) => {
      const accepted = (booking.participants ?? []).filter(
        (participant) => participant.status === 'ACCEPTED' || participant.status === 'SELECTED',
      ).length;

      if (
        ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'].includes(booking.status) &&
        !booking.chatRoom
      ) {
        stats.repair += 1;
        return stats;
      }

      if (booking.status !== 'OPEN_MATCHING') {
        return stats;
      }

      if (accepted > 0 && !booking.selectedProvider && !booking.selectedProviderId) {
        stats.stage3 += 1;
        return stats;
      }

      const eligibleBackup = eligibleBackupPartnersForBooking(booking, providers, policy, now);
      const overdue = bookingOpenAgeMinutes(booking, now) > policy.responseWindowMinutes;
      if (overdue) {
        stats.overdue += 1;
      }

      if (eligibleBackup > 0) {
        stats.stage2 += 1;
      } else {
        stats.stage1 += 1;
        stats.noSupply += 1;
      }
      return stats;
    },
    { stage1: 0, stage2: 0, stage3: 0, repair: 0, noSupply: 0, overdue: 0 },
  );
}

function matchingStageImpactRow(
  scenario: string,
  value: string,
  stats: MatchingStageImpactStats,
  baseline: MatchingStageImpactStats,
  current: boolean,
) {
  return {
    scenario,
    value,
    stage1: stats.stage1,
    stage2: stats.stage2,
    stage3: stats.stage3,
    repair: stats.repair,
    noSupply: stats.noSupply,
    overdue: stats.overdue,
    operatorRead: matchingStageImpactRead(stats, baseline, current),
    pillClass: current
      ? 'pill-info'
      : stats.noSupply > baseline.noSupply || stats.overdue > baseline.overdue
        ? 'pill-warn'
        : 'pill-neutral',
  };
}

function matchingStageImpactRead(
  stats: MatchingStageImpactStats,
  baseline: MatchingStageImpactStats,
  current: boolean,
) {
  if (current) {
    return 'Current live policy baseline. Compare other rows against this before saving a change.';
  }
  if (stats.noSupply > baseline.noSupply) {
    return 'More bookings lose usable marketplace supply. Improve partner location/push readiness before choosing this.';
  }
  if (stats.overdue > baseline.overdue) {
    return 'More first-pick windows become overdue. Customer wait anxiety and manual dispatch work may rise.';
  }
  if (stats.stage2 > baseline.stage2 && stats.noSupply <= baseline.noSupply) {
    return 'More bookings can expose marketplace partner supply without increasing empty waiting screens.';
  }
  if (stats.noSupply < baseline.noSupply) {
    return 'Fewer bookings look supply-starved, but confirm distance quality and stale pins before widening.';
  }
  return 'Operational shape is similar to the current policy. Use real outcome cohorts before changing.';
}

function eligibleBackupPartnersForBooking(
  booking: AdminBooking,
  providers: AdminProvider[],
  policy: {
    backupRadiusMeters: number;
    freshnessMinutes: number;
    hardWalletBlock: boolean;
  },
  now: number,
) {
  const coordinate = bookingCoordinate(booking);
  if (!coordinate) {
    return 0;
  }
  const preferredId = booking.preferredProvider?.id ?? booking.preferredProviderId;
  return providers.filter((provider) => {
    if (provider.id === preferredId || provider.status !== 'ONLINE_AVAILABLE') {
      return false;
    }
    if (adminPartnerMarketplaceBlocked(provider, { hardWalletBlock: policy.hardWalletBlock })) {
      return false;
    }
    const providerCoordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
    if (!providerCoordinate) {
      return false;
    }
    const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt, now);
    if (ageMinutes === null || ageMinutes > policy.freshnessMinutes) {
      return false;
    }
    return (
      haversineDistanceMeters(
        coordinate.lat,
        coordinate.lng,
        providerCoordinate.lat,
        providerCoordinate.lng,
      ) <= policy.backupRadiusMeters
    );
  }).length;
}

function bookingCoordinate(booking: AdminBooking) {
  return parseCoordinatePair(
    booking.lat ?? booking.addressSnapshot?.latitude,
    booking.lng ?? booking.addressSnapshot?.longitude,
  );
}

function bookingOpenAgeMinutes(booking: AdminBooking, now: number) {
  const openedAt = Date.parse(bookingRequestOpenedAt(booking) ?? '');
  if (!Number.isFinite(openedAt)) {
    return 0;
  }
  return Math.max(0, Math.round((now - openedAt) / 60000));
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const fromLatRadians = degreesToRadians(fromLat);
  const toLatRadians = degreesToRadians(toLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLatRadians) * Math.cos(toLatRadians) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value: string | null | undefined, now: number) {
  if (!value) {
    return null;
  }
  const updatedAt = Date.parse(value);
  if (!Number.isFinite(updatedAt)) {
    return null;
  }
  return Math.max(0, Math.round((now - updatedAt) / 60000));
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${Math.round(meters / 1000)} km`;
  }
  return `${meters} m`;
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}
