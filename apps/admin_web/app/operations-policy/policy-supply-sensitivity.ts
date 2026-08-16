import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerFinalGateHeld,
  adminPartnerMarketplaceBlocked,
  adminWalletGateBlocksFinalGate,
} from '../../lib/operations-policy';
import { policyCountLabel } from './policy-copy';

export type PolicySupplySensitivity = {
  referenceLabel: string;
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  radiusRows: Array<{
    radiusLabel: string;
    eligible: number;
    fresh: number;
    finalGateHeld: number;
    visible?: number;
    staleExcluded?: number;
    deltaVsCurrent?: number;
    operatorRead: string;
    pillClass: string;
  }>;
  freshnessRows: Array<{
    freshnessLabel: string;
    eligible: number;
    staleExcluded: number;
    visible?: number;
    finalGateHeld?: number;
    deltaVsCurrent?: number;
    operatorRead: string;
    pillClass: string;
  }>;
};

type SupplySensitivityPolicy = {
  readonly backupRadiusMeters: number;
  readonly freshnessMinutes: number;
  readonly hardWalletBlock: boolean;
};

type SupplySensitivityCandidate = {
  readonly provider: AdminProvider;
  readonly ageMinutes: number | null;
  readonly distanceMeters: number | null;
  readonly hasCoordinate: boolean;
  readonly marketplaceBlocked: boolean;
  readonly finalGateHeld: boolean;
  readonly online: boolean;
};

export function buildPolicySupplySensitivity(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
  now = Date.now(),
): PolicySupplySensitivity {
  const policy = readSupplySensitivityPolicy(settings);
  const reference = referenceBookingCoordinate(bookings);
  const candidates = buildSupplySensitivityCandidates(providers, reference, policy.hardWalletBlock, now);

  const radiusOptions = uniqueNumbers([5000, 10000, policy.backupRadiusMeters, 15000, 20000]).sort(
    (left, right) => left - right,
  );
  const freshnessOptions = uniqueNumbers([10, 30, policy.freshnessMinutes, 60, 120]).sort(
    (left, right) => left - right,
  );
  const currentEligible = candidates.filter((item) => isCurrentlyVisibleSupply(item, policy)).length;

  return {
    referenceLabel: reference.label,
    currentPolicyLabel: `${formatDistance(policy.backupRadiusMeters)} / ${policy.freshnessMinutes}m fresh`,
    summary: buildSupplySensitivitySummary(candidates, providers.length, policy),
    radiusRows: radiusOptions.map((radius) => buildRadiusSensitivityRow(candidates, radius, policy, currentEligible)),
    freshnessRows: freshnessOptions.map((freshness) =>
      buildFreshnessSensitivityRow(candidates, freshness, policy, currentEligible),
    ),
  };
}

function readSupplySensitivityPolicy(
  settings: AdminOperationalPolicySetting[],
): SupplySensitivityPolicy {
  const backupRadiusMeters =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const freshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const walletGate =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate;

  return {
    backupRadiusMeters,
    freshnessMinutes,
    hardWalletBlock: adminWalletGateBlocksFinalGate(walletGate),
  };
}

function buildSupplySensitivityCandidates(
  providers: AdminProvider[],
  reference: { readonly lat: number; readonly lng: number },
  hardWalletBlock: boolean,
  now: number,
): SupplySensitivityCandidate[] {
  return providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt, now);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(reference.lat, reference.lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
        hasCoordinate: Boolean(coordinate),
        marketplaceBlocked: adminPartnerMarketplaceBlocked(provider, { hardWalletBlock }),
        finalGateHeld: adminPartnerFinalGateHeld(provider, { hardWalletBlock }),
        online: provider.status === 'ONLINE_AVAILABLE',
      };
    })
    .filter((item) => item.hasCoordinate && item.distanceMeters !== null);
}

function buildSupplySensitivitySummary(
  candidates: readonly SupplySensitivityCandidate[],
  providerCount: number,
  policy: SupplySensitivityPolicy,
): PolicySupplySensitivity['summary'] {
  const currentVisibleSupply = candidates.filter((item) => isCurrentlyVisibleSupply(item, policy));
  const currentFinalGateHeld = candidates.filter(
    (item) => item.finalGateHeld && (item.distanceMeters ?? Infinity) <= policy.backupRadiusMeters,
  );
  const currentStaleExcluded = candidates.filter((item) => isStaleExcluded(item, policy));

  return [
    {
      label: 'Coordinate sample',
      value: candidates.length.toString(),
      helper: `${policyCountLabel(providerCount, 'total Partner')}, ${policyCountLabel(candidates.length, 'Partner')} with saved coordinates.`,
    },
    {
      label: 'Current visible supply',
      value: currentVisibleSupply.length.toString(),
      helper: 'Online, marketplace eligible, inside radius, and fresh enough.',
    },
    {
      label: 'Final gate held in radius',
      value: currentFinalGateHeld.length.toString(),
      helper:
        'Final acceptance, service start, or payout release may wait for settlement, identity, or account controls.',
    },
    {
      label: 'Stale excluded',
      value: currentStaleExcluded.length.toString(),
      helper: 'Could become usable by opening the Partner app and refreshing location.',
    },
  ];
}

function buildRadiusSensitivityRow(
  candidates: readonly SupplySensitivityCandidate[],
  radius: number,
  policy: SupplySensitivityPolicy,
  currentEligible: number,
): PolicySupplySensitivity['radiusRows'][number] {
  const insideRadius = candidates.filter((item) => (item.distanceMeters ?? Infinity) <= radius);
  const eligible = insideRadius.filter(
    (item) =>
      item.online &&
      !item.marketplaceBlocked &&
      (item.ageMinutes ?? Infinity) <= policy.freshnessMinutes,
  );
  const fresh = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= policy.freshnessMinutes);
  const finalGateHeld = insideRadius.filter((item) => item.finalGateHeld);
  const visible = insideRadius.filter((item) => item.online && !item.marketplaceBlocked);
  return {
    radiusLabel: formatDistance(radius),
    eligible: eligible.length,
    fresh: fresh.length,
    finalGateHeld: finalGateHeld.length,
    visible: visible.length,
    staleExcluded: Math.max(0, visible.length - eligible.length),
    deltaVsCurrent: eligible.length - currentEligible,
    operatorRead: radiusSensitivityRead(radius, policy.backupRadiusMeters, eligible.length),
    pillClass:
      radius === policy.backupRadiusMeters
        ? 'pill-info'
        : radius < policy.backupRadiusMeters
          ? 'pill-warn'
          : 'pill-neutral',
  };
}

function buildFreshnessSensitivityRow(
  candidates: readonly SupplySensitivityCandidate[],
  freshness: number,
  policy: SupplySensitivityPolicy,
  currentEligible: number,
): PolicySupplySensitivity['freshnessRows'][number] {
  const insideRadius = candidates.filter(
    (item) =>
      item.online &&
      !item.marketplaceBlocked &&
      (item.distanceMeters ?? Infinity) <= policy.backupRadiusMeters,
  );
  const eligible = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= freshness);
  const staleExcluded = insideRadius.length - eligible.length;
  return {
    freshnessLabel: `${freshness} min`,
    eligible: eligible.length,
    staleExcluded,
    visible: insideRadius.length,
    finalGateHeld: candidates.filter(
      (item) => item.finalGateHeld && (item.distanceMeters ?? Infinity) <= policy.backupRadiusMeters,
    ).length,
    deltaVsCurrent: eligible.length - currentEligible,
    operatorRead: freshnessSensitivityRead(
      freshness,
      policy.freshnessMinutes,
      eligible.length,
      staleExcluded,
    ),
    pillClass:
      freshness === policy.freshnessMinutes
        ? 'pill-info'
        : freshness < policy.freshnessMinutes
          ? 'pill-warn'
          : 'pill-neutral',
  };
}

function isCurrentlyVisibleSupply(
  candidate: SupplySensitivityCandidate,
  policy: SupplySensitivityPolicy,
) {
  return (
    candidate.online &&
    !candidate.marketplaceBlocked &&
    (candidate.distanceMeters ?? Infinity) <= policy.backupRadiusMeters &&
    (candidate.ageMinutes ?? Infinity) <= policy.freshnessMinutes
  );
}

function isStaleExcluded(
  candidate: SupplySensitivityCandidate,
  policy: SupplySensitivityPolicy,
) {
  return (
    candidate.online &&
    !candidate.marketplaceBlocked &&
    (candidate.distanceMeters ?? Infinity) <= policy.backupRadiusMeters &&
    (candidate.ageMinutes === null || candidate.ageMinutes > policy.freshnessMinutes)
  );
}

function policyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalNumber(policyRawValue(settings, key));
}

function policyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalString(policyRawValue(settings, key));
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readOptionalString(value: unknown) {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function referenceBookingCoordinate(bookings: AdminBooking[]) {
  const withCoordinate = bookings
    .filter((booking) => parseCoordinatePair(booking.lat, booking.lng))
    .sort(byNewestBooking)[0];
  const coordinate = withCoordinate ? parseCoordinatePair(withCoordinate.lat, withCoordinate.lng) : null;
  if (withCoordinate && coordinate) {
    return {
      lat: coordinate.lat,
      lng: coordinate.lng,
      label: `Booking ${shortId(withCoordinate.id)}`,
    };
  }
  return {
    lat: 10.7769,
    lng: 106.7009,
    label: 'Demo Ho Chi Minh City',
  };
}

function byNewestBooking(left: AdminBooking, right: AdminBooking) {
  return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = readOptionalNumber(lat);
  const parsedLng = readOptionalNumber(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const startLat = degreesToRadians(fromLat);
  const endLat = degreesToRadians(toLat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value: string | null | undefined, now: number) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((now - timestamp) / 60000));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}

function radiusSensitivityRead(radius: number, currentRadius: number, eligibleCount: number) {
  if (eligibleCount === 0) {
    return 'No usable marketplace supply at this radius. Operators should improve partner location/push readiness before relying on it.';
  }
  if (radius < currentRadius) {
    return 'Tighter radius improves arrival quality but can create empty customer waiting screens in thin cities.';
  }
  if (radius > currentRadius) {
    return 'Wider radius increases customer options, but operators should watch late arrivals and ignored alerts.';
  }
  return 'Current live radius. Use this as the baseline before changing matching policy.';
}

function freshnessSensitivityRead(
  freshness: number,
  currentFreshness: number,
  eligibleCount: number,
  staleExcluded: number,
) {
  if (eligibleCount === 0) {
    return 'No visible partner remains under this freshness rule. Ask partners to reopen the app or loosen only with caution.';
  }
  if (freshness < currentFreshness) {
    return 'Stricter freshness improves distance confidence, but may hide partners before the 30 minute active-booking refresh window.';
  }
  if (freshness > currentFreshness) {
    return 'Looser freshness exposes more supply, but stale pins can create bad arrival expectations.';
  }
  return staleExcluded
    ? 'Current live freshness. Stale partners can be recovered by opening the Partner app.'
    : 'Current live freshness. No stale partner is being excluded in this sample.';
}
