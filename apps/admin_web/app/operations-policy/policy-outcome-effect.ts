import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { readPlainRecord } from '../../lib/admin-format';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import {
  type BookingMatchingPolicySnapshot,
  formatSnapshotPolicyValue,
  readBookingMatchingPolicySnapshot,
} from './policy-snapshot';
import { policyDisplayByKey } from './policy-value-display';
import { policyCountLabel, policyValueLabel } from './policy-copy';

type PolicyEffectStats = {
  sampleCount: number;
  matchedCount: number;
  completedCount: number;
  cancelledCount: number;
  expiredCount: number;
  noShowCount: number;
  participantCount: number;
  backupInviteCount: number;
};

type PolicyEffectRowDefinition = {
  policy: string;
  settingKey: string;
  readValue: (snapshot: BookingMatchingPolicySnapshot) => string | number | null;
  formatValue: (value: string | number) => string;
};

export type PolicyOutcomeEffectAnalysis = {
  sampleCount: number;
  metrics: Array<{ label: string; value: string; helper: string }>;
  rows: Array<{
    key: string;
    policy: string;
    value: string;
    sampleRaw: number;
    sample: string;
    matchedRate: string;
    completedRate: string;
    avgBackupInvites: string;
    avgParticipants: string;
    outcomeLabel: string;
    outcomePill: string;
    outcomeDetail: string;
    operatorRead: string;
  }>;
  cards: Array<{
    scope: string;
    title: string;
    detail: string;
    operatorAction: string;
    className: string;
    pillClass: string;
  }>;
};

export function buildPolicyOutcomeEffect(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
): PolicyOutcomeEffectAnalysis {
  const sampledBookings = bookings.filter(hasMatchingPolicySnapshot);
  const globalStats = policyEffectStatsForBookings(sampledBookings);
  const globalMatchedRate = matchedRateForStats(globalStats);
  const rows = buildPolicyEffectRowsFromDefinitions({
    settings,
    bookings: sampledBookings,
    definitions: policyEffectRowDefinitions(settings),
    globalMatchedRate,
  });

  const totalOutcomeCheckCount = closedOutcomeCountForStats(globalStats);
  const avgBackupInvites = averageLabel(globalStats.backupInviteCount, globalStats.sampleCount, 'partner');
  const currentInviteCap = policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit);
  const currentRadius = policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters);

  return {
    sampleCount: sampledBookings.length,
    metrics: buildOutcomeEffectMetrics(globalStats, totalOutcomeCheckCount, avgBackupInvites),
    rows,
    cards: buildOutcomeEffectCards({
      sampledBookingCount: sampledBookings.length,
      globalStats,
      totalOutcomeCheckCount,
      avgBackupInvites,
      currentInviteCap,
      currentRadius,
    }),
  };
}

function hasMatchingPolicySnapshot(booking: AdminBooking) {
  return Boolean(readBookingMatchingPolicySnapshot(booking));
}

function matchedRateForStats(stats: PolicyEffectStats) {
  return stats.sampleCount > 0 ? stats.matchedCount / stats.sampleCount : 0;
}

function closedOutcomeCountForStats(stats: PolicyEffectStats) {
  return stats.cancelledCount + stats.expiredCount + stats.noShowCount;
}

function policyEffectRowDefinitions(
  settings: AdminOperationalPolicySetting[],
): PolicyEffectRowDefinition[] {
  return [
    {
      policy: 'First-pick response window',
      settingKey: OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
      readValue: (snapshot) => snapshot.providerResponseWindowMinutes,
      formatValue: (value) => `${value} min`,
    },
    {
      policy: 'Marketplace policy',
      settingKey: OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      readValue: (snapshot) => snapshot.backupProviderRadiusMeters,
      formatValue: (value) => formatDistance(Number(value)),
    },
    {
      policy: 'Marketplace alert cap',
      settingKey: OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      readValue: (snapshot) => snapshot.backupProviderInvitationLimit,
      formatValue: (value) => policyValueLabel(value, 'Partner'),
    },
    {
      policy: 'Marketplace opening mode',
      settingKey: OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      readValue: (snapshot) => snapshot.backupOpenMode,
      formatValue: (value) =>
        formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode, value),
    },
    {
      policy: 'First-pick accept mode',
      settingKey: OPERATIONAL_POLICY_KEYS.preferredAcceptMode,
      readValue: (snapshot) => snapshot.preferredAcceptMode,
      formatValue: (value) =>
        formatSnapshotPolicyValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode, value),
    },
  ];
}

function buildPolicyEffectRowsFromDefinitions(input: {
  settings: AdminOperationalPolicySetting[];
  bookings: AdminBooking[];
  definitions: PolicyEffectRowDefinition[];
  globalMatchedRate: number;
}) {
  return input.definitions
    .flatMap((definition) =>
      buildPolicyEffectRows({
        ...definition,
        settings: input.settings,
        bookings: input.bookings,
        globalMatchedRate: input.globalMatchedRate,
      }),
    )
    .sort((left, right) => right.sampleRaw - left.sampleRaw || left.policy.localeCompare(right.policy))
    .slice(0, 12);
}

function buildOutcomeEffectMetrics(
  stats: PolicyEffectStats,
  totalOutcomeCheckCount: number,
  avgBackupInvites: string,
): PolicyOutcomeEffectAnalysis['metrics'] {
  return [
    {
      label: 'Matched rate',
      value: percentLabel(stats.matchedCount, stats.sampleCount),
      helper: `${stats.matchedCount}/${stats.sampleCount} sampled ${stats.sampleCount === 1 ? 'booking' : 'bookings'} reached a selected or active Partner.`,
    },
    {
      label: 'Completed rate',
      value: percentLabel(stats.completedCount, stats.sampleCount),
      helper: `${stats.completedCount}/${stats.sampleCount} sampled ${stats.sampleCount === 1 ? 'booking' : 'bookings'} completed service.`,
    },
    {
      label: 'Avg marketplace alerts',
      value: avgBackupInvites,
      helper: 'Uses stored marketplace alert traces from booking metadata, not just live partner supply.',
    },
    {
      label: 'Cancelled / expired / no-show',
      value: String(totalOutcomeCheckCount),
      helper: `${stats.cancelledCount} cancelled, ${stats.expiredCount} expired, ${stats.noShowCount} no-show.`,
    },
  ];
}

function buildOutcomeEffectCards(input: {
  sampledBookingCount: number;
  globalStats: PolicyEffectStats;
  totalOutcomeCheckCount: number;
  avgBackupInvites: string;
  currentInviteCap: string;
  currentRadius: string;
}): PolicyOutcomeEffectAnalysis['cards'] {
  return [
    {
      scope: 'Evidence',
      title: input.sampledBookingCount
        ? 'Policy snapshots are measurable'
        : 'Create more measured bookings',
      detail: input.sampledBookingCount
        ? 'Each booking opened under a saved policy can now be compared against outcome, partner participation, and marketplace alert batches.'
        : 'The dashboard needs bookings with metadata.matchingPolicy before it can compare policy outcomes.',
      operatorAction: input.sampledBookingCount
        ? 'Use these cohorts before changing response window, marketplace radius, invite cap, or accept mode.'
        : 'Create a fresh booking after policy setup, then run through accept/reject/marketplace scenarios.',
      className: input.sampledBookingCount ? 'ops-task-done' : 'ops-task-pending',
      pillClass: input.sampledBookingCount ? 'pill-success' : 'pill-warn',
    },
    {
      scope: 'Current rule',
      title: `Marketplace exposure: ${input.currentRadius}, cap ${input.currentInviteCap}`,
      detail:
        'Marketplace Partner exposure should balance speed, push cost, and customer choice clarity. A high cap can notify too many Partners; a low cap can hide useful supply.',
      operatorAction:
        input.globalStats.backupInviteCount > 0
          ? `Current sample averages ${input.avgBackupInvites} per measured booking.`
          : 'No marketplace alert batch was found in the measured sample yet.',
      className: 'ops-task-pending',
      pillClass: 'pill-info',
    },
    {
      scope: 'Outcome checks',
      title: input.totalOutcomeCheckCount
        ? 'Review closed booking cohorts before changing policy'
        : 'No closed-outcome spike in sample',
      detail: input.totalOutcomeCheckCount
        ? 'Cancelled, expired, or no-show bookings may point to response-window, supply, payment, or partner readiness problems.'
        : 'The sampled policy snapshots do not show cancelled, expired, or no-show pressure yet.',
      operatorAction: input.totalOutcomeCheckCount
        ? 'Open the booking drill-down and compare closed bookings against their saved policy snapshot.'
        : 'Keep collecting results across more districts and time bands before treating this as final.',
      className: input.totalOutcomeCheckCount ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: input.totalOutcomeCheckCount ? 'pill-danger' : 'pill-success',
    },
  ];
}

function buildPolicyEffectRows(input: {
  policy: string;
  settings: AdminOperationalPolicySetting[];
  bookings: AdminBooking[];
  settingKey: string;
  readValue: (snapshot: BookingMatchingPolicySnapshot) => string | number | null;
  formatValue: (value: string | number) => string;
  globalMatchedRate: number;
}) {
  const groups = new Map<string, { value: string; bookings: AdminBooking[] }>();
  for (const booking of input.bookings) {
    const snapshot = readBookingMatchingPolicySnapshot(booking);
    if (!snapshot) {
      continue;
    }
    const rawValue = input.readValue(snapshot);
    if (rawValue === null || rawValue === undefined) {
      continue;
    }
    const value = input.formatValue(rawValue);
    const key = `${input.policy}:${value}`;
    const group = groups.get(key) ?? { value, bookings: [] };
    group.bookings.push(booking);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const stats = policyEffectStatsForBookings(group.bookings);
    const matchedRateValue = stats.sampleCount > 0 ? stats.matchedCount / stats.sampleCount : 0;
    const closedOutcomeCount = stats.cancelledCount + stats.expiredCount + stats.noShowCount;
    const sampleTooSmall = stats.sampleCount < 5;
    const belowAverage = matchedRateValue + 0.05 < input.globalMatchedRate;
    const needsOutcomeReview = closedOutcomeCount > 0 || belowAverage;
    const liveValue = policyDisplayByKey(input.settings, input.settingKey);

    return {
      key,
      policy: input.policy,
      value: group.value,
      sampleRaw: stats.sampleCount,
      sample: policyCountLabel(stats.sampleCount, 'booking'),
      matchedRate: percentLabel(stats.matchedCount, stats.sampleCount),
      completedRate: percentLabel(stats.completedCount, stats.sampleCount),
      avgBackupInvites: averageLabel(stats.backupInviteCount, stats.sampleCount, 'Partner'),
      avgParticipants: averageLabel(stats.participantCount, stats.sampleCount, 'Partner'),
      outcomeLabel: sampleTooSmall ? 'Low sample' : needsOutcomeReview ? 'Check outcomes' : 'On track',
      outcomePill: sampleTooSmall ? 'pill-warn' : needsOutcomeReview ? 'pill-danger' : 'pill-success',
      outcomeDetail: `${policyCountLabel(closedOutcomeCount, 'closed outcome')} to review / live value now ${liveValue}.`,
      operatorRead: sampleTooSmall
        ? 'Keep collecting data before deciding. This cohort is useful for debugging, not final policy choice.'
        : belowAverage
          ? 'Matched rate is below the measured average. Check partner supply, alert delivery, and customer wait before expanding this value.'
          : needsOutcomeReview
            ? 'Closed outcome records need review. Check the booking detail snapshots before changing this policy again.'
            : 'This cohort is currently performing at or above the measured average in the sampled bookings.',
    };
  });
}

function policyEffectStatsForBookings(bookings: AdminBooking[]): PolicyEffectStats {
  return bookings.reduce<PolicyEffectStats>(
    (stats, booking) => {
      stats.sampleCount += 1;
      if (bookingHasMatchedPartner(booking)) {
        stats.matchedCount += 1;
      }
      if (booking.status === 'COMPLETED') {
        stats.completedCount += 1;
      }
      if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
        stats.cancelledCount += 1;
      }
      if (booking.status === 'EXPIRED') {
        stats.expiredCount += 1;
      }
      if (booking.status === 'NO_SHOW') {
        stats.noShowCount += 1;
      }
      stats.participantCount += booking.participants?.length ?? 0;
      stats.backupInviteCount += bookingBackupInviteCount(booking);
      return stats;
    },
    {
      sampleCount: 0,
      matchedCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      expiredCount: 0,
      noShowCount: 0,
      participantCount: 0,
      backupInviteCount: 0,
    },
  );
}

function bookingHasMatchedPartner(booking: AdminBooking) {
  return (
    Boolean(booking.selectedProvider || booking.selectedProviderId) ||
    ['MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE', 'COMPLETED'].includes(booking.status)
  );
}

function bookingBackupInviteCount(booking: AdminBooking) {
  const metadata = readPlainRecord(booking.metadata);
  const traces = Array.isArray(metadata?.backupNotificationTraces) ? metadata.backupNotificationTraces : [];
  return traces.reduce((total, value) => {
    const trace = readPlainRecord(value);
    return total + (readOptionalNumber(trace?.notifiedCount) ?? 0);
  }, 0);
}

function percentLabel(count: number, total: number) {
  if (total <= 0) {
    return '0%';
  }
  return `${Math.round((count / total) * 100)}%`;
}

function averageLabel(total: number, count: number, unit: string) {
  if (count <= 0) {
    return policyValueLabel(0, unit);
  }
  return policyValueLabel(
    (total / count).toLocaleString('en', { maximumFractionDigits: 1 }),
    unit,
  );
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${Math.round(meters / 1000)} km`;
  }
  return `${meters} m`;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
